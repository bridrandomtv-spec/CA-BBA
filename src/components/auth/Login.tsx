// تسجيل الدخول — porte d'entrée durcie :
//  1. `await res.json()` non protégé : une réponse non-JSON (proxy, 502 HTML)
//     affichait « Unexpected token » à l'utilisateur → readError() ne lève jamais ;
//  2. erreurs techniques anglaises (`TypeError: Failed to fetch`) dans une
//     interface 100 % arabe → message réseau localisé ;
//  3. autoComplete (email / current-password / new-password / name) :
//     gestionnaires de mots de passe et autofill mobile opérationnels ;
//  4. pré-validation du mot de passe alignée sur MIN_PASSWORD_LENGTH serveur
//     (et sur le rejet HIBP) : la règle est affichée AVANT l'envoi ;
//  5. le basculement connexion ↔ inscription réinitialise erreur et mot de passe ;
//  6. mode « mot de passe oublié » : la réponse du serveur est GÉNÉRIQUE par
//     conception (anti-énumération) — le message affiché est donc le même que
//     l'adresse soit inscrite ou non, et le dit honnêtement au supporter.
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Mail, User as UserIcon } from 'lucide-react';

/** Aligné sur MIN_PASSWORD_LENGTH côté serveur (server/auth.ts). */
const MIN_PASSWORD_LENGTH = 12;

/** Aligné sur la limite serveur du displayName (100 caractères). */
const MAX_NAME_LENGTH = 100;

/** Lit un corps d'erreur sans jamais lever : les réponses non-JSON (proxy,
 *  502 HTML, corps vide) retombent sur le message par défaut. */
async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === 'string' && data.error.length > 0 ? data.error : fallback;
}

type AuthMode = 'login' | 'register' | 'forgot';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();

  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';

  /** Bascule connexion ↔ inscription : état propre (erreur, mot de passe). */
  const switchMode = () => {
    setMode((prev) => (prev === 'register' ? 'login' : 'register'));
    setError('');
    setSuccess('');
    setPassword('');
  };

  const enterForgotMode = () => {
    setMode('forgot');
    setError('');
    setSuccess('');
    setPassword('');
  };

  const backToLogin = () => {
    setMode('login');
    setError('');
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // ---- Mode récupération : envoi du lien (réponse serveur générique). ----
    if (isForgot) {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) throw new Error(await readError(res, 'تعذر إرسال رابط الاستعادة.'));
        // Message volontairement conditionnel : le serveur ne confirme jamais
        // l'existence du compte, l'UI ne doit pas la confirmer non plus.
        setSuccess('إن كان هذا البريد مسجلاً، فقد أُرسل إليك رابط الاستعادة. تحقق من بريدك (ومن مجلد الرسائل غير المرغوبة). الرابط صالح 30 دقيقة.');
        setMode('login');
        setPassword('');
      } catch (err) {
        console.error('Forgot password error:', err);
        setError(err instanceof TypeError
          ? 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.'
          : err instanceof Error ? err.message : 'تعذر إرسال رابط الاستعادة.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // ---- Connexion / inscription ----
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

  const title = isRegister ? 'إنشاء حساب' : isForgot ? 'استعادة كلمة المرور' : 'تسجيل الدخول';
  const subtitle = isRegister
    ? 'انضم إلى مجتمع الكابا'
    : isForgot
      ? 'أدخل بريدك الإلكتروني وسنرسل لك رابط الاستعادة'
      : 'مرحباً بعودتك إلى معقل الجراد الأصفر';

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-zinc-950 animate-in fade-in overflow-y-auto" dir="rtl">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl translate-x-10 -translate-y-10"></div>

        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center font-bold text-black text-3xl shadow-[0_0_15px_rgba(234,179,8,0.3)] mb-4">
            C
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">{title}</h2>
          <p className="text-zinc-400 text-sm text-center">{subtitle}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm text-center leading-relaxed" role="status">
            {success}
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

          {!isForgot && (
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
          )}

          {/* Lien de récupération — mode connexion uniquement. */}
          {mode === 'login' && (
            <div className="text-center -mt-1">
              <button
                type="button"
                onClick={enterForgotMode}
                className="text-xs text-zinc-500 hover:text-yellow-500 transition-colors"
              >
                نسيت كلمة المرور؟
              </button>
            </div>
          )}

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
            {loading ? 'جاري المعالجة...' : isForgot ? 'إرسال رابط الاستعادة' : isRegister ? 'تسجيل' : 'دخول'}
          </button>
        </form>

        <div className="mt-6 text-center relative z-10">
          {isForgot ? (
            <button
              onClick={backToLogin}
              className="text-zinc-400 hover:text-white text-sm transition-colors"
            >
              العودة إلى تسجيل الدخول
            </button>
          ) : (
            <button
              onClick={switchMode}
              className="text-zinc-400 hover:text-white text-sm transition-colors"
            >
              {isRegister ? 'لديك حساب بالفعل؟ سجل الدخول' : 'ليس لديك حساب؟ أنشئ واحداً الآن'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
