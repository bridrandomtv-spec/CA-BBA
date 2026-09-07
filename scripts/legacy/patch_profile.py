import re

with open("src/components/Profile.tsx", "r") as f:
    content = f.read()

import_search = "import { useState, useRef } from 'react';"
import_replace = "import { useState, useRef, useEffect } from 'react';\nimport { collection, query, where, onSnapshot } from 'firebase/firestore';\nimport { db } from '../lib/firebase';\nimport { useAuth } from '../contexts/AuthContext';"
content = content.replace(import_search, import_replace)

body_search = """export default function Profile() {
  const { theme, toggleTheme } = useTheme();
  const { favorites } = useFavorites();
  const [userName, setUserName] = useState(() => localStorage.getItem('userName') || 'أمين. ب');
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('userEmail') || 'supporter@cabba.dz');
  const [userAvatar, setUserAvatar] = useState(() => localStorage.getItem('userAvatar') || `https://api.dicebear.com/7.x/avataaars/svg?seed=Amine&backgroundColor=f59e0b`);
  
  const [editName, setEditName] = useState(userName);
  const [editEmail, setEditEmail] = useState(userEmail);"""
  
body_replace = """export default function Profile() {
  const { theme, toggleTheme } = useTheme();
  const { favorites } = useFavorites();
  const { currentUser, userData, logout } = useAuth();
  
  const [membership, setMembership] = useState<any>(null);
  
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'memberships'), where('userId', '==', currentUser.uid));
    const un = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setMembership({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setMembership(null);
      }
    });
    return () => un();
  }, [currentUser]);

  const [userName, setUserName] = useState(userData?.name || currentUser?.displayName || 'المستخدم');
  const [userEmail, setUserEmail] = useState(currentUser?.email || '');
  const [userAvatar, setUserAvatar] = useState(currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData?.name || 'User'}&backgroundColor=f59e0b`);
  
  const [editName, setEditName] = useState(userName);
  const [editEmail, setEditEmail] = useState(userEmail);"""
content = content.replace(body_search, body_replace)

save_search = """  const handleSaveProfile = () => {
    localStorage.setItem('userName', editName);
    localStorage.setItem('userEmail', editEmail);
    setUserName(editName);
    setUserEmail(editEmail);
    alert('تم حفظ التعديلات بنجاح!');
    setActiveModal('none');
  };"""

save_replace = """  const handleSaveProfile = () => {
    // In a real app we'd update Firestore and Auth profile
    alert('سيتم إضافة ميزة تعديل الملف الشخصي قريباً');
    setActiveModal('none');
  };"""
content = content.replace(save_search, save_replace)

auth_remove_search = """  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];
    
    if (authMode === 'signup' && name.trim().length < 3) {
      errors.push("الاسم يجب أن يكون 3 أحرف على الأقل");
    }
    if (!email.includes('@')) {
      errors.push("البريد الإلكتروني غير صالح (يجب أن يحتوي على @)");
    }
    if (password.length < 6) {
      errors.push("كلمة المرور قصيرة جداً (يجب أن تكون 6 أحرف على الأقل)");
    }
    if (authMode === 'signup' && password !== confirmPassword) {
      errors.push("كلمات المرور غير متطابقة");
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    if (authMode === 'signup') {
      localStorage.setItem('userName', name);
      setUserName(name);
    }
    
    localStorage.setItem('userEmail', email);
    setUserEmail(email);
    localStorage.setItem('isLoggedIn', 'true');
    setIsLoggedIn(true);
  };"""
  
content = content.replace(auth_remove_search, "")

login_render_search = """  if (!isLoggedIn) {
    return (
      <div className="p-4 flex flex-col min-h-full bg-zinc-950" dir="rtl">
        <div className="flex-1 flex flex-col justify-center items-center max-w-sm mx-auto w-full">
          <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center font-bold text-black text-5xl mb-8 shadow-[0_0_30px_rgba(234,179,8,0.3)]">
            C
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600"></div>
            
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              {authMode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
            </h2>

            {formErrors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6">
                {formErrors.map((err, i) => (
                  <p key={i} className="text-red-400 text-xs flex items-center gap-2 mb-1 last:mb-0">
                    <AlertCircle size={12} />
                    {err}
                  </p>
                ))}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'signup' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-400 pl-1">الاسم الكامل</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-right focus:outline-none focus:border-yellow-500 transition-colors"
                    placeholder="أدخل اسمك الكامل"
                  />
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400 pl-1">البريد الإلكتروني</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-right focus:outline-none focus:border-yellow-500 transition-colors"
                  placeholder="example@cabba.dz"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400 pl-1">كلمة المرور</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-right focus:outline-none focus:border-yellow-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>

              {authMode === 'signup' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-400 pl-1">تأكيد كلمة المرور</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-right focus:outline-none focus:border-yellow-500 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              )}

              <button 
                type="submit"
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-colors mt-2"
              >
                {authMode === 'login' ? 'دخول' : 'تسجيل'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button 
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'signup' : 'login');
                  setFormErrors([]);
                }}
                className="text-zinc-400 text-sm hover:text-white transition-colors"
              >
                {authMode === 'login' ? 'ليس لديك حساب؟ سجل الآن' : 'لديك حساب بالفعل؟ قم بتسجيل الدخول'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }"""
content = content.replace(login_render_search, "")

card_search = """      <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-3xl p-6 relative overflow-hidden mb-8 shadow-lg shadow-yellow-500/20">
        <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
        
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <span className="bg-black/20 text-black font-bold px-3 py-1 rounded-full text-xs backdrop-blur-md border border-black/10 inline-block mb-4">
              بطاقة المشجع الرقمية
            </span>
            <h2 className="text-2xl font-black text-black mb-1">{userName}</h2>
            <p className="text-black/70 text-sm font-medium">عضو ذهبي • ID: 1932</p>
          </div>
          <div className="w-16 h-16 bg-white p-1 rounded-xl shadow-lg rotate-3">
            <QRCodeSVG value={`cabba-supporter-1932`} size={56} />
          </div>
        </div>
        
        <div className="relative z-10 mt-6 pt-4 border-t border-black/10 flex justify-between items-center">
          <div>
            <p className="text-black/60 text-[10px] font-bold uppercase tracking-widest mb-1">صلاحية البطاقة</p>
            <p className="text-black font-bold text-sm">موسم 2026/2027</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center border border-black/5">
            <Shield size={20} className="text-black" />
          </div>
        </div>
      </div>"""
      
card_replace = """      <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-3xl p-6 relative overflow-hidden mb-8 shadow-lg shadow-yellow-500/20">
        <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
        
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <span className="bg-black/20 text-black font-bold px-3 py-1 rounded-full text-xs backdrop-blur-md border border-black/10 inline-block mb-4">
              بطاقة المشجع الرقمية
            </span>
            <h2 className="text-2xl font-black text-black mb-1">{userName}</h2>
            {membership ? (
              <p className="text-black/70 text-sm font-medium">عضو {membership.type === 'vip' ? 'VIP' : membership.type === 'gold' ? 'ذهبي' : 'عادي'} • {membership.memberNumber}</p>
            ) : (
              <p className="text-black/70 text-sm font-medium">لا توجد عضوية نشطة</p>
            )}
          </div>
          <div className="w-16 h-16 bg-white p-1 rounded-xl shadow-lg rotate-3">
            <QRCodeSVG value={membership ? membership.memberNumber : currentUser?.uid || ''} size={56} />
          </div>
        </div>
        
        {membership && (
          <div className="relative z-10 mt-6 pt-4 border-t border-black/10 flex justify-between items-center">
            <div>
              <p className="text-black/60 text-[10px] font-bold uppercase tracking-widest mb-1">صلاحية البطاقة</p>
              <p className="text-black font-bold text-sm">حتى {membership.expirationDate}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center border border-black/5">
              {membership.status === 'active' ? <CheckCircle2 size={20} className="text-black" /> : <AlertCircle size={20} className="text-red-800" />}
            </div>
          </div>
        )}
      </div>"""
content = content.replace(card_search, card_replace)

logout_search = """  const handleLogout = () => {
    if (window.confirm('هل أنت متأكد من تسجيل الخروج؟')) {
      localStorage.removeItem('isLoggedIn');
      setIsLoggedIn(false);
    }
  };"""

logout_replace = """  const handleLogout = async () => {
    if (window.confirm('هل أنت متأكد من تسجيل الخروج؟')) {
      try {
        await logout();
      } catch (e) {
        console.error("Logout failed", e);
      }
    }
  };"""
content = content.replace(logout_search, logout_replace)

with open("src/components/Profile.tsx", "w") as f:
    f.write(content)

