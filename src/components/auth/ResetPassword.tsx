// Réinitialisation du mot de passe — atterrit ici depuis le lien reçu par
// email (/reset-password?token=…). App rend cet écran HORS du flux
// d'authentification : un supporter bloqué dehors n'a pas de session valide.
//
// Contrat serveur (POST /api/auth/reset-password) : jeton haché SHA-256,
// 30 minutes, usage unique ; au succès toutes les sessions sont révoquées —
// d'où la redirection vers l'accueil (écran de connexion) après confirmation.
import { useState } from 'react';
import { Lock, KeyRound, CheckCircle2, Loader2 } from 'lucide-react';

/** Aligné sur MIN_PASSWORD_LENGTH côté serveur (server/auth.ts). */
const MIN_PASSWORD_LENGTH = 8;

export default function ResetPassword() {
  // Token lu une seule fois : l'URL ne change pas pendant la vie de l'écran.
  const [token] = useState<string | null>(() => {
    const value = new URLSearchParams(window.location.search).get('token');
    return value && value.trim() ? value.trim() : null;
  });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('رابط الاستعادة غير صالح أو ناقص. اطلب رابطاً جديداً من شاشة تسجيل الدخول.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`كلمة المرور يجب أن تحتوي على ${MIN_PASSWORD_LENGTH} أحرف على الأقل.`);
      return;
    }
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'تعذر تغيير كلمة المرور.');
      }
      setDone(true);
      // Le serveur a révoqué toutes les sessions et supprimé le cookie :
      // retour à l'écran de connexion après un court délai de lecture.
      setTimeout(() => window.location.assign('/'), 3000);
    } catch (err) {
      console.error('[CABBA] reset password:', err);
      setError(err instanceof TypeError
        ? 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.'
        : err instanceof Error ? err.message : 'تعذر تغيير كلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="w-full min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <CheckCircle2 size={56} className="text-green-500 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">تم تغيير كلمة المرور ✅</h1>
        <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">
          تم تسجيل الخروج من جميع الأجهزة لحماية حسابك. جارٍ التحويل إلى شاشة تسجيل الدخول…
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl translate-x-10 -translate-y-10"></div>

        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-black mb-4 shadow-[0_0_15px_rgba(234,179,8,0.3)]">
            <KeyRound size={28} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">كلمة مرور جديدة</h2>
          <p className="text-zinc-400 text-sm text-center">اختر كلمة مرور قوية لم تستعملها من قبل</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center" role="alert">
            {error}
          </div>
        )}

        {!token && (
          <p className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-xs text-center leading-relaxed">
            رابط الاستعادة غير صالح أو منتهي الصلاحية (صلاحيته 30 دقيقة).
            اطلب رابطاً جديداً من شاشة تسجيل الدخول (« نسيت كلمة المرور؟ »).
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500">
              <Lock size={18} />
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة المرور الجديدة"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
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
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="أعد كتابة كلمة المرور"
              autoComplete="new-password"
              className="w-full bg-zinc-800/50 border border-zinc-700 text-white text-sm rounded-xl py-3 pr-10 pl-4 outline-none focus:border-yellow-500 transition-colors placeholder:text-zinc-500"
              required
            />
          </div>

          <p className="text-[11px] text-zinc-500 px-1 leading-relaxed">
            {MIN_PASSWORD_LENGTH} أحرف على الأقل — كلمة المرور تُفحص أيضاً ضد قوائم التسريبات المعروفة.
          </p>

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور الجديدة'}
          </button>
        </form>

        <div className="mt-6 text-center relative z-10">
          <a href="/" className="text-zinc-400 hover:text-white text-sm transition-colors">
            العودة إلى تسجيل الدخول
          </a>
        </div>
      </div>
    </div>
  );
}
