// تسجيل الدخول — porte d'entrée durcie :
//  1. `await res.json()` non protégé : une réponse non-JSON (page d'erreur
//     d'un proxy, 502 HTML) affichait « Unexpected token » à l'utilisateur ;
//  2. erreurs techniques anglaises (`TypeError: Failed to fetch`) dans une
//     interface 100 % arabe → message réseau localisé ;
//  3. autoComplete (email / current-password / new-password / name) :
//     gestionnaires de mots de passe et autofill mobile opérationnels ;
//  4. pré-validation du mot de passe alignée sur MIN_PASSWORD_LENGTH serveur
//     (et sur le rejet HIBP) : la règle est affichée AVANT l'envoi ;
//  5. le basculement connexion ↔ inscription réinitialise erreur et mot de
//     passe (l'autocomplete « nouveau mot de passe » ne fuit plus sur
//     l'écran de connexion).
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Mail, User as UserIcon } from 'lucide-react';

/** Aligné sur MIN_PASSWORD_LENGTH côté serveur (server/auth.ts). */
const MIN_PASSWORD_LENGTH = 8;

/** Aligné sur la limite serveur du displayName (100 caractères). */
const MAX_NAME_LENGTH = 100;

/** Lit un corps d'erreur sans jamais lever : les réponses non-JSON (proxy,
 *  502 HTML, corps vide) retombent sur le message par défaut. */
async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === 'string' && data.error.length > 0 ? data.error : fallback;
}

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();

  /** Bascule de mode : repart d'un état propre (erreur, mot de passe). */
  const switchMode = () => {
    setIsRegister((prev) => !prev);
    setError('');
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Pré-validation alignée sur le serveur : évite un aller-retour inutile.
    if (isRegister && password.length < MIN_PASSWORD_LENGTH) {
      setError(`كلمة المرور يجب أن تحتوي على ${MIN_PASSWORD_LENGTH} أحرف على الأقل.`);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(isRegister ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isRegister ? { email, password, displayName: name } : { email, password },
        ),
      });

      if (!res.ok) {
        // 429 inclus : le message du rate limiter est affiché tel quel.
        const fallback = isRegister
          ? 'حدث خطأ في المصادقة. يرجى المحاولة مرة أخرى.'
          : 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
        throw new Error(await readError(res, fallback));
      }

      await refreshUser();
      onLogin();
    } catch (err: any) {
      console.error('Auth Error:', err);
      // Une panne réseau (TypeError: Failed to fetch) ne doit pas s'afficher
      // en anglais technique dans une interface arabe.
      const isNetworkFailure = err instanceof TypeError;
      setError(
        isNetworkFailure
          ? 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.'
          : err?.message || 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-zinc-950 animate-in fade-in" dir="rtl">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl translate-x-10 -translate-y-10"></div>

        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center font-bold text-black text-3xl shadow-[0_0_15px_rgba(234,179,8,0.3)] mb-4">
            C
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">{isRegister ? 'إنشاء حساب' : 'تسجيل الدخول'}</h2>
          <p className="text-zinc-400 text-sm">{isRegister ? 'انضم إلى مجتمع الكابا' : 'مرحباً بعودتك إلى معقل الجراد الأصفر'}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          {isRegister && (
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500">
                <UserIcon size={18} />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="الاسم الكامل"
                autoComplete="name"
                maxLength={MAX_NAME_LENGTH}
                className="w-full bg-zinc-800/50 border border-zinc-700 text-white text-sm rounded-xl py-3 pr-10 pl-4 outline-none focus:border-yellow-500 transition-colors placeholder:text-zinc-500"
                required
              />
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500">
              <Mail size={18} />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="البريد الإلكتروني"
              autoComplete="email"
              inputMode="email"
              className="w-full bg-zinc-800/50 border border-zinc-700 text-white text-sm rounded-xl py-3 pr-10 pl-4 outline-none focus:border-yellow-500 transition-colors placeholder:text-zinc-500"
              required
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500">
              <Lock size={18} />
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة المرور"
              // current-password en connexion, new-password en inscription :
              // le gestionnaire de mots de passe propose la bonne action.
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={isRegister ? MIN_PASSWORD_LENGTH : undefined}
              className="w-full bg-zinc-800/50 border border-zinc-700 text-white text-sm rounded-xl py-3 pr-10 pl-4 outline-none focus:border-yellow-500 transition-colors placeholder:text-zinc-500"
              required
            />
          </div>

          {/* Règle affichée avant l'envoi, pas après l'échec. */}
          {isRegister && (
            <p className="text-[11px] text-zinc-500 px-1">
              كلمة المرور يجب أن تحتوي على {MIN_PASSWORD_LENGTH} أحرف على الأقل.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'جاري المعالجة...' : (isRegister ? 'تسجيل' : 'دخول')}
          </button>
        </form>

        <div className="mt-6 text-center relative z-10">
          <button
            onClick={switchMode}
            className="text-zinc-400 hover:text-white text-sm transition-colors"
          >
            {isRegister ? 'لديك حساب بالفعل؟ سجل الدخول' : 'ليس لديك حساب؟ أنشئ واحداً الآن'}
          </button>
        </div>
      </div>
    </div>
  );
}
