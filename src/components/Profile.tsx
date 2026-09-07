import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { readString, STORAGE_KEYS, writeString } from '../lib/storage';
import { Award, X, AlertCircle, Shield, Settings, CheckCircle2, ChevronLeft, Moon, Sun, Heart, Calendar as CalendarIcon, MapPin } from 'lucide-react';
import { useFavorites } from '../hooks/useFavorites';
import { Match } from '../types';
import NotificationSettings from './NotificationSettings';
import Achievements from './Achievements';
import { QRCodeSVG } from 'qrcode.react';
import { useTheme } from '../ThemeContext';

export default function Profile() {
  const { theme, toggleTheme } = useTheme();
  const { favorites } = useFavorites();
  const { currentUser, userData, logout, refreshUser } = useAuth();
  
  const [membership, setMembership] = useState<any>(null);
  
  useEffect(() => {
    if (!currentUser) return;
    fetch('/api/memberships/me')
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('membership')))
      .then((data) => setMembership(data.membership))
      .catch(() => setMembership(null));
  }, [currentUser]);

  const [userName, setUserName] = useState(userData?.displayName || currentUser?.displayName || 'المستخدم');
  const [userEmail, setUserEmail] = useState(currentUser?.email || '');
  const [userAvatar, setUserAvatar] = useState(currentUser?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData?.displayName || 'User'}&backgroundColor=f59e0b`);
  
  const [editName, setEditName] = useState(userName);
  const [editEmail, setEditEmail] = useState(userEmail);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setUserAvatar(base64String);
        writeString(STORAGE_KEYS.userAvatar, base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  
  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      const finalAvatar = userAvatar;
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: editName, avatarUrl: finalAvatar })
      });
      if (!res.ok) throw new Error('فشل تحديث الملف الشخصي');
      if (refreshUser) {
        await refreshUser();
      }

      setUserName(editName);
      alert('تم حفظ التعديلات بنجاح!');
      setActiveModal('none');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  const [activeModal, setActiveModal] = useState<'none' | 'profile' | 'language' | 'about'>('none');
  const [language, setLanguage] = useState(() => readString(STORAGE_KEYS.appLang) || 'ar');
  
  const changeLanguage = (lang: string) => {
    setLanguage(lang);
    writeString(STORAGE_KEYS.appLang, lang);
  };




  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const handleResetPassword = async () => {
    alert('إعادة تعيين كلمة المرور غير متوفرة حالياً.');
  };

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

    setFormErrors([]);
    // Authentication is handled by the server/AuthContext.
    // This legacy inline form is retained for layout compatibility only.
    
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error(e);
    }
  };

  if (!currentUser) {
    return (
      <div className="p-4 space-y-6 h-full flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
        <div className="text-center space-y-4 mb-8 mt-10">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center border-4 border-zinc-900 shadow-[0_0_30px_rgba(234,179,8,0.3)]">
            <span className="font-bold text-black text-5xl">C</span>
          </div>
          <h2 className="text-2xl font-bold text-white">
            {authMode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
          </h2>
          <p className="text-sm text-zinc-400">
            {authMode === 'login' 
              ? 'سجل دخولك للانضمام إلى مجتمع أنصار الجراد الأصفر.'
              : 'أنشئ حسابك الآن لتصبح جزءاً من العائلة الصفراء.'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4 max-w-sm mx-auto w-full pb-10">
          {formErrors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4 text-right">
              <div className="flex items-center gap-2 text-red-500 font-bold text-sm mb-2">
                <AlertCircle size={16} />
                <span>Fix errors ({formErrors.length} أخطاء):</span>
              </div>
              <ul className="list-disc list-inside text-xs text-red-400 space-y-1">
                {formErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          {authMode === 'signup' && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-400">الاسم الكامل</label>
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={authMode === 'signup'} 
                type="text" 
                placeholder="أمين ب." 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white text-right focus:outline-none focus:border-yellow-500 transition-colors" 
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-400">البريد الإلكتروني</label>
            <input 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
              type="email" 
              placeholder="supporter@cabba.dz" 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white text-right focus:outline-none focus:border-yellow-500 transition-colors" 
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-400">كلمة المرور</label>
            <input 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              type="password" 
              placeholder="••••••••" 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white text-right focus:outline-none focus:border-yellow-500 transition-colors" 
            />
          </div>

          {authMode === 'signup' && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-400">تأكيد كلمة المرور</label>
              <input 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required={authMode === 'signup'} 
                type="password" 
                placeholder="••••••••" 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white text-right focus:outline-none focus:border-yellow-500 transition-colors" 
              />
            </div>
          )}
          
          <div className="flex justify-between items-center px-1">
            {authMode === 'login' ? (
              <>
                <button type="button" onClick={handleResetPassword} className="text-xs text-yellow-500 font-bold hover:underline">
                  هل نسيت كلمة المرور؟
                </button>
                <button type="button" onClick={() => { setAuthMode('signup'); setFormErrors([]); }} className="text-xs text-zinc-400 font-bold hover:text-white transition-colors">
                  إنشاء حساب جديد
                </button>
              </>
            ) : (
              <button type="button" onClick={() => { setAuthMode('login'); setFormErrors([]); }} className="text-xs text-zinc-400 font-bold hover:text-white transition-colors w-full text-center">
                لديك حساب بالفعل؟ تسجيل الدخول
              </button>
            )}
          </div>

          <button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg p-4 rounded-xl shadow-[0_0_15px_rgba(234,179,8,0.4)] transition-all mt-4">
            {authMode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}
          </button>
        </form>
      </div>
    );
  }



  const [allMatches, setAllMatches] = useState<Match[]>([]);
  useEffect(() => {
    fetch('/api/matches')
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('matches')))
      .then((data) => setAllMatches(data.matches ?? data ?? []))
      .catch((error) => console.error('[CABBA] matches:', error));
  }, []);
  
  const favoriteMatches = allMatches.filter(m => favorites.includes(m.id));

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
      
      {/* Digital Membership Card */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-tr from-black via-zinc-900 to-black border border-yellow-500/30 p-6 shadow-[0_10px_30px_rgba(234,179,8,0.1)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        
        <div className="relative z-10 flex justify-between items-start mb-8">
          <div>
            <h2 className="text-yellow-500 font-bold tracking-widest text-sm mb-1 uppercase">عضوية شرفية</h2>
            <div className="text-white text-2xl font-black font-mono">CABBA-8291-04</div>
          </div>
          <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center border-2 border-black">
            <span className="font-bold text-black text-xl">C</span>
          </div>
        </div>
        
        <div className="relative z-10 flex justify-between items-end">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-zinc-800 border-2 border-yellow-500 overflow-hidden shadow-lg">
              <img src={userAvatar} alt={`صورة ${userName}`} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-1 uppercase tracking-wider">الاسم واللقب</p>
              <p className="text-white font-bold text-lg">{userName}</p>
            </div>
          </div>
          
          <div className="p-2 rounded-xl" style={{ backgroundColor: "#ffffff" }}>
            <QRCodeSVG value="CABBA-FAN-847291" size={48} />
          </div>
        </div>
      </div>

      {/* Digital Tickets */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white text-lg">التذاكر الرقمية</h3>
          <span className="text-xs text-green-500 font-bold bg-green-500/10 px-2 py-1 rounded-md border border-green-500/20">تذكرة واحدة نشطة</span>
        </div>
        
        <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50 flex flex-col items-center">
          <div className="flex justify-between items-center w-full mb-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">الكابا</span>
            </div>
            <span className="text-zinc-500 text-xs font-bold px-2">ضد</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">المنافس</span>
            </div>
          </div>
          
          <div className="p-3 rounded-xl mb-4 shadow-[0_0_15px_rgba(255,255,255,0.1)]" style={{ backgroundColor: "#ffffff" }}>
            <QRCodeSVG value="TICKET-78X92" size={96} />
          </div>
          
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-zinc-400">ملعب 20 أوت 1955</span>
            <span className="font-bold text-yellow-500 text-sm tracking-widest">TICKET-78X92</span>
          </div>
        </div>
      </div>

      {/* Favorite Matches */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <Heart className="text-red-500 fill-current" size={20} />
            المباريات المفضلة
          </h3>
          <span className="text-xs text-zinc-500 font-bold bg-zinc-800 px-2 py-1 rounded-md">{favorites.length} مباريات</span>
        </div>
        
        <div className="space-y-3">
          {favoriteMatches.length > 0 ? (
            favoriteMatches.map(match => (
              <div key={match.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center border-2 border-zinc-700">
                    <span className="font-bold text-xs text-white truncate max-w-[20px]">{match.awayTeam.charAt(0)}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{match.awayTeam}</h4>
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 mt-0.5">
                      <CalendarIcon size={10} /> {match.date}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  {match.status === 'finished' ? (
                    <span className="font-bold text-white tracking-widest">{match.homeScore + ' - ' + match.awayScore}</span>
                  ) : (
                    <span className="text-xs font-bold text-yellow-500">{match.time}</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6">
              <Heart size={32} className="text-zinc-700 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">لم تقم بإضافة أي مباراة للمفضلة بعد.</p>
            </div>
          )}
        </div>
      </div>

      {/* Gamification / Loyalty Points */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500/20 p-2 rounded-xl">
              <Award className="text-yellow-500" size={24} />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">1,450 نقطة</h3>
              <p className="text-xs text-zinc-400">نقاط الولاء (الجراد الأصفر)</p>
            </div>
          </div>
          <div className="text-left">
            <span className="bg-zinc-800 text-white text-xs font-bold px-3 py-1 rounded-full">المستوى 4</span>
          </div>
        </div>

        <div className="space-y-3">
        </div>
      </div>


      {/* Badges Section */}
      <Achievements />

      {/* Theme Setting */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-zinc-800 text-yellow-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
            {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">مظهر التطبيق</h3>
            <p className="text-[10px] text-zinc-400">
              {theme === 'dark' ? 'الوضع الليلي مفعل' : 'الوضع النهاري مفعل'}
            </p>
          </div>
        </div>
        <button 
          onClick={toggleTheme}
          className={`w-14 h-7 rounded-full transition-colors relative flex items-center shadow-inner ${theme === 'dark' ? 'bg-zinc-700' : 'bg-yellow-500'}`}
        >
          <div className={`w-5 h-5 rounded-full bg-white absolute top-1 shadow-md transition-transform ${theme === 'dark' ? 'right-1' : 'left-1'}`}></div>
        </button>
      </div>

      {/* Settings Options */}
      <div className="space-y-2">
        <h4 className="font-bold text-zinc-400 text-sm px-2 mb-2">الإعدادات</h4>
        
        <button 
          onClick={() => setActiveModal('profile')}
          className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/50 p-4 rounded-xl flex items-center justify-between transition-colors group"
        >
          <span className="text-sm text-white font-medium group-hover:text-yellow-500 transition-colors">تعديل الملف الشخصي</span>
          <ChevronLeft size={16} className="text-zinc-600 group-hover:text-yellow-500 transition-colors" />
        </button>

        <NotificationSettings />

        <button 
          onClick={() => setActiveModal('language')}
          className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/50 p-4 rounded-xl flex items-center justify-between transition-colors group"
        >
          <span className="text-sm text-white font-medium group-hover:text-yellow-500 transition-colors">إعدادات اللغة</span>
          <ChevronLeft size={16} className="text-zinc-600 group-hover:text-yellow-500 transition-colors" />
        </button>

        <button 
          onClick={() => setActiveModal('about')}
          className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/50 p-4 rounded-xl flex items-center justify-between transition-colors group"
        >
          <span className="text-sm text-white font-medium group-hover:text-yellow-500 transition-colors">عن التطبيق</span>
          <ChevronLeft size={16} className="text-zinc-600 group-hover:text-yellow-500 transition-colors" />
        </button>
      </div>
      
      <button 
        onClick={handleLogout}
        className="w-full text-red-400 text-sm font-bold p-4 bg-zinc-900 rounded-xl hover:bg-red-400/10 transition-colors"
      >
        تسجيل الخروج
      </button>


      {/* Modals for Settings */}
      {activeModal !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-yellow-500/30 rounded-3xl w-full max-w-sm overflow-hidden shadow-[0_10px_40px_rgba(234,179,8,0.1)] flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-4 border-b border-zinc-800">
              <h3 className="font-bold text-white text-lg">
                {activeModal === 'profile' && 'تعديل الملف الشخصي'}
                {activeModal === 'language' && 'اللغة (Language)'}
                {activeModal === 'about' && 'عن التطبيق'}
              </h3>
              <button 
                onClick={() => setActiveModal('none')}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {activeModal === 'profile' && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center mb-6">
                    <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-yellow-500 overflow-hidden shadow-lg mb-3">
                      <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleImageUpload} 
                    />
                    <button onClick={() => fileInputRef.current?.click()} className="text-xs text-yellow-500 font-bold hover:underline">
                      تغيير الصورة
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400">الاسم الكامل</label>
                    <input 
                      type="text" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-right focus:outline-none focus:border-yellow-500 transition-colors" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400">البريد الإلكتروني</label>
                    <input 
                      type="email" 
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-right focus:outline-none focus:border-yellow-500 transition-colors" 
                    />
                  </div>
                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold p-3 rounded-xl transition-colors mt-2 disabled:opacity-50"
                  >
                    {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                  </button>
                </div>
              )}

              {activeModal === 'language' && (
                <div className="space-y-3">
                  <button 
                    onClick={() => changeLanguage('ar')}
                    className={`w-full p-4 rounded-xl flex items-center justify-between transition-colors ${language === 'ar' ? 'bg-zinc-800 border-2 border-yellow-500' : 'bg-zinc-800/50 border-2 border-transparent hover:bg-zinc-800'}`}>
                    <span className="font-bold text-white">العربية (Arabic)</span>
                    {language === 'ar' && <CheckCircle2 size={20} className="text-yellow-500" />}
                  </button>
                  <button 
                    onClick={() => changeLanguage('fr')}
                    className={`w-full p-4 rounded-xl flex items-center justify-between transition-colors ${language === 'fr' ? 'bg-zinc-800 border-2 border-yellow-500' : 'bg-zinc-800/50 border-2 border-transparent hover:bg-zinc-800'}`}>
                    <span className="font-bold text-white">الفرنسية (Français)</span>
                    {language === 'fr' && <CheckCircle2 size={20} className="text-yellow-500" />}
                  </button>
                  <button 
                    onClick={() => changeLanguage('en')}
                    className={`w-full p-4 rounded-xl flex items-center justify-between transition-colors ${language === 'en' ? 'bg-zinc-800 border-2 border-yellow-500' : 'bg-zinc-800/50 border-2 border-transparent hover:bg-zinc-800'}`}>
                    <span className="font-bold text-white">الإنجليزية (English)</span>
                    {language === 'en' && <CheckCircle2 size={20} className="text-yellow-500" />}
                  </button>
                </div>
              )}

              {activeModal === 'about' && (
                <div className="text-center space-y-6">
                  <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center border-4 border-zinc-800 shadow-[0_0_30px_rgba(234,179,8,0.3)]">
                    <span className="font-bold text-black text-5xl">C</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xl mb-1">CABBA Supporters</h4>
                    <p className="text-yellow-500 font-bold text-sm">الإصدار 1.0.0</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-xl p-4 text-xs text-zinc-400 leading-relaxed text-center space-y-3">
                    <p>التطبيق الرسمي لأنصار أهلي برج بوعريريج.</p>
                    <p>تم تطويره بحب للجراد الأصفر، ليجمع العائلة الصفراء في منصة رقمية واحدة.</p>
                    <p>خريف أحمد© 2026 جميع الحقوق محفوظة.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
