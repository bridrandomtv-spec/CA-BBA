// المساعد الذكي — conversation PERSISTÉE entre deux ouvertures du panneau
// (la limite README « l'historique n'est pas persisté » est soldée) :
//  - 40 derniers tours via STORAGE_KEYS.assistantHistory (JSON, timestamps ISO) ;
//  - re-validation à la relecture : localStorage est modifiable à la main,
//    une entrée altérée est écartée, pas rendue ;
//  - bouton « محادثة جديدة » pour repartir de zéro ;
//  - historique Gemini normalisé : le premier tour envoyé doit être un tour
//    utilisateur (le SDK rejette sinon) — les tours 'ai' en tête sont retirés ;
//  - maxLength aligné sur la borne serveur (2 000) : plus de requête vouée
//    au 400 ; credentials explicite (la route exige le cookie de session).
import { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Loader2, RotateCcw } from 'lucide-react';
import { ChatMessage } from '../types';
import { readJSON, writeJSON, STORAGE_KEYS } from '../lib/storage';

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'ai',
  text: 'مرحباً بك يا مناصر الجراد الأصفر! 💛🖤\nأنا هنا لمساعدتك. كيف يمكنني دعمك اليوم؟ هل تريد الاستفسار عن تاريخ النادي، إحصائيات، أو أفكار لمساندة الفريق؟',
  timestamp: new Date(),
};

/** Aligné sur MAX_MESSAGE_LENGTH côté serveur (server.ts). */
const MAX_MESSAGE_LENGTH = 2000;

/** Borne de persistance : la conversation ne gonfle pas localStorage indéfiniment. */
const MAX_PERSISTED_MESSAGES = 40;

/** Forme sérialisée d'un message : timestamp ISO au lieu de Date. */
interface PersistedMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: string;
}

let idCounter = 0;
/** `Date.now()` pouvait produire deux fois le même id sur des envois rapprochés. */
function createId(): string {
  idCounter += 1;
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${idCounter}`;
}

function isPersistedMessage(value: unknown): value is PersistedMessage {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    (candidate.role === 'user' || candidate.role === 'ai') &&
    typeof candidate.text === 'string' &&
    typeof candidate.timestamp === 'string'
  );
}

function reviveDate(iso: string): Date {
  const date = new Date(iso);
  // localStorage est modifiable à la main : une date invalide ne doit pas
  // produire « Invalid Date » dans l'horodatage affiché.
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/**
 * Relit la conversation persistée. readJSON ne lève jamais d'exception
 * (stockage bloqué, JSON corrompu) et chaque entrée est re-validée.
 */
function loadPersistedHistory(): ChatMessage[] {
  const raw = readJSON<unknown>(STORAGE_KEYS.assistantHistory, []);
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(isPersistedMessage)
    .filter((entry) => entry.text.trim().length > 0 && entry.text.length <= MAX_MESSAGE_LENGTH)
    .slice(-MAX_PERSISTED_MESSAGES)
    .map((entry) => ({
      id: entry.id || createId(),
      role: entry.role,
      text: entry.text,
      timestamp: reviveDate(entry.timestamp),
    }));
}

export default function AiAssistant() {
  // Le message d'accueil n'est jamais persisté : il est regénéré à chaque
  // chargement, ce qui permet d'en changer le texte sans migration de stockage.
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => [WELCOME_MESSAGE, ...loadPersistedHistory()],
  );
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Le panneau de l'assistant est démonté à la fermeture : sans cette annulation,
  // la requête continuait et tentait un setState sur un composant démonté.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Persistance à chaque changement : writeJSON avale les échecs (quota,
  // stockage désactivé) — la conversation reste utilisable en mémoire.
  useEffect(() => {
    const toPersist: PersistedMessage[] = messages
      .filter((message) => message.id !== WELCOME_MESSAGE.id)
      .slice(-MAX_PERSISTED_MESSAGES)
      .map((message) => ({
        id: message.id,
        role: message.role,
        text: message.text,
        timestamp: message.timestamp.toISOString(),
      }));
    writeJSON(STORAGE_KEYS.assistantHistory, toPersist);
  }, [messages]);

  /** Nouvelle conversation : aborte la requête en cours et repart de l'accueil. */
  const handleReset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setMessages([WELCOME_MESSAGE]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      text,
      timestamp: new Date(),
    };

    // L'historique envoyé au serveur exclut le message d'accueil : l'API Gemini
    // attend un historique qui commence par un tour utilisateur. Avec la
    // persistance, l'historique rechargé peut commencer par un tour 'ai'
    // (conversation précédente tronquée) : on retire les tours non-utilisateurs
    // en tête, sinon le SDK rejette la requête.
    const history = messages
      .filter((message) => message.id !== WELCOME_MESSAGE.id)
      .map(({ role, text: content }) => ({ role, text: content }));
    while (history.length > 0 && history[0].role !== 'user') {
      history.shift();
    }

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // credentials: 'same-origin' — /api/chat exige le cookie de session.
      const response = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Le serveur renvoie un message en arabe (clé absente, quota, session
        // expirée en 401…) : autant l'afficher plutôt qu'un texte générique.
        throw new Error(typeof data.error === 'string' ? data.error : 'Network response was not ok');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'ai',
          text: typeof data.text === 'string' ? data.text : 'لم يصل أي رد من المساعد.',
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;

      console.error('Error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'ai',
          text:
            error instanceof Error && error.message !== 'Network response was not ok'
              ? error.message
              : 'عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى لاحقاً.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  };

  const suggestions = [
    'من هو الهداف التاريخي للفريق؟',
    'متى تأسس شباب أهلي برج بوعريريج؟',
    'اكتب لي منشور لدعم الفريق',
  ];

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300" dir="rtl">

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 flex-none rounded-full flex items-center justify-center ${
              msg.role === 'ai' ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400'
            }`}>
              {msg.role === 'ai' ? <Bot size={18} /> : <User size={18} />}
            </div>

            <div className={`max-w-[80%] p-3 rounded-2xl ${
              msg.role === 'user'
                ? 'bg-zinc-800 text-white rounded-tr-sm'
                : 'bg-zinc-800 border border-yellow-500/20 text-zinc-200 rounded-tl-sm'
            }`}>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              <span className={`text-[10px] mt-2 block ${msg.role === 'user' ? 'text-zinc-500 text-left' : 'text-zinc-500 text-right'}`}>
                {msg.timestamp.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
             <div className="w-8 h-8 flex-none rounded-full bg-yellow-500 text-black flex items-center justify-center">
              <Bot size={18} />
             </div>
             <div className="bg-zinc-800 border border-yellow-500/20 p-3 rounded-2xl rounded-tl-sm flex items-center gap-2 text-yellow-500">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs">جاري التفكير...</span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Nouvelle conversation — visible dès qu'un échange existe */}
      {messages.length > 1 && (
        <div className="px-4 pt-1 flex justify-start">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="محادثة جديدة"
          >
            <RotateCcw size={12} />
            محادثة جديدة
          </button>
        </div>
      )}

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className="p-4 flex gap-2 overflow-x-auto hide-scrollbar">
          {suggestions.map((sug, i) => (
            <button
              key={i}
              onClick={() => setInput(sug)}
              className="whitespace-nowrap bg-zinc-800 border border-zinc-700 text-yellow-500 text-xs px-3 py-1.5 rounded-full hover:bg-zinc-700"
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-zinc-900 border-t border-zinc-800">
        <div className="flex items-center gap-2 bg-black border border-zinc-700 rounded-full p-1 pl-4">
          <input
            type="text"
            value={input}
            maxLength={MAX_MESSAGE_LENGTH}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // isComposing : ne pas envoyer pendant la saisie prédictive.
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="اكتب رسالتك هنا..."
            aria-label="رسالتك إلى المساعد"
            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-zinc-600 px-2 py-2"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || isLoading}
            aria-label="إرسال"
            className="w-10 h-10 rounded-full bg-yellow-500 text-black flex items-center justify-center disabled:opacity-50 hover:bg-yellow-400 transition-colors"
          >
            <Send size={18} className="translate-x-[-1px] translate-y-[1px]" />
          </button>
        </div>
      </div>

    </div>
  );
}
