import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Mail, User as UserIcon } from 'lucide-react';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, displayName: name }),
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'حدث خطأ في المصادقة. يرجى المحاولة مرة أخرى.');
        }
      } else {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
        }
      }
      
      await refreshUser();
      onLogin();
    } catch (err: any) {
      console.error('Auth Error:', err);
      setError(err.message);
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
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
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
              className="w-full bg-zinc-800/50 border border-zinc-700 text-white text-sm rounded-xl py-3 pr-10 pl-4 outline-none focus:border-yellow-500 transition-colors placeholder:text-zinc-500"
              required
            />
          </div>

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
            onClick={() => setIsRegister(!isRegister)}
            className="text-zinc-400 hover:text-white text-sm transition-colors"
          >
            {isRegister ? 'لديك حساب بالفعل؟ سجل الدخول' : 'ليس لديك حساب؟ أنشئ واحداً الآن'}
          </button>
        </div>
      </div>
    </div>
  );
}
