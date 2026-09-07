import re

with open("src/components/Profile.tsx", "r") as f:
    content = f.read()

# Insert language state
hooks_insertion = """  const [activeModal, setActiveModal] = useState<'none' | 'profile' | 'language' | 'about'>('none');
  const [language, setLanguage] = useState(() => localStorage.getItem('appLang') || 'ar');
  
  const changeLanguage = (lang: string) => {
    setLanguage(lang);
    localStorage.setItem('appLang', lang);
    if (lang === 'fr') {
      alert('La langue française sera bientôt appliquée partout ! (En cours de traduction)');
    } else if (lang === 'en') {
      alert('English language will be applied everywhere soon! (Translation in progress)');
    }
  };
"""
    
content = content.replace("  const [activeModal, setActiveModal] = useState<'none' | 'profile' | 'language' | 'about'>('none');\n", hooks_insertion)

old_language_modal = """              {activeModal === 'language' && (
                <div className="space-y-3">
                  <button className="w-full bg-zinc-800 border-2 border-yellow-500 p-4 rounded-xl flex items-center justify-between">
                    <span className="font-bold text-white">العربية (Arabic)</span>
                    <CheckCircle2 size={20} className="text-yellow-500" />
                  </button>
                  <button className="w-full bg-zinc-800/50 border-2 border-transparent p-4 rounded-xl flex items-center justify-between opacity-50 cursor-not-allowed">
                    <span className="font-bold text-white">الفرنسية (Français)</span>
                    <span className="text-xs text-zinc-500">قريباً</span>
                  </button>
                  <button className="w-full bg-zinc-800/50 border-2 border-transparent p-4 rounded-xl flex items-center justify-between opacity-50 cursor-not-allowed">
                    <span className="font-bold text-white">الإنجليزية (English)</span>
                    <span className="text-xs text-zinc-500">قريباً</span>
                  </button>
                </div>
              )}"""

new_language_modal = """              {activeModal === 'language' && (
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
              )}"""

content = content.replace(old_language_modal, new_language_modal)

with open("src/components/Profile.tsx", "w") as f:
    f.write(content)
