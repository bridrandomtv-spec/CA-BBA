import { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { ChatMessage } from '../types';

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'ai',
  text: 'مرحباً بك يا مناصر الجراد الأصفر! 💛🖤\nأنا هنا لمساعدتك. كيف يمكنني دعمك اليوم؟ هل تريد الاستفسار عن تاريخ النادي، إحصائيات، أو أفكار لمساندة الفريق؟',
  timestamp: new Date(),
};

let idCounter = 0;
/** `Date.now()` pouvait produire deux fois le même id sur des envois rapprochés. */
function createId(): string {
  idCounter += 1;
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${idCounter}`;
}

export default function AiAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
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
    // attend un historique qui commence par un tour utilisateur.
    const history = messages
      .filter((message) => message.id !== WELCOME_MESSAGE.id)
      .map(({ role, text: content }) => ({ role, text: content }));

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Le serveur renvoie un message en arabe (clé absente, quota…) :
        // autant l'afficher plutôt qu'un texte générique.
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
