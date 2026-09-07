import sys

with open('src/components/Profile.tsx', 'r') as f:
    content = f.read()

old_settings = """      {/* Settings Options */}
      <div className="space-y-2">
        <h4 className="font-bold text-zinc-400 text-sm px-2 mb-2">الإعدادات</h4>
        
        <button className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/50 p-4 rounded-xl flex items-center justify-between transition-colors">
          <span className="text-sm text-white font-medium">الملف الشخصي</span>
          <ChevronLeft size={16} className="text-zinc-600" />
        </button>

        <button 
          onClick={toggleTheme}
          className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/50 p-4 rounded-xl flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Moon size={18} className="text-yellow-500" /> : <Sun size={18} className="text-yellow-500" />}
            <span className="text-sm text-white font-medium">
              المظهر (الليلي / النهاري)
            </span>
          </div>
          <div className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${theme === 'dark' ? 'bg-zinc-700' : 'bg-yellow-500'}`}>
            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${theme === 'dark' ? 'right-1' : 'left-1'}`}></div>
          </div>
        </button>"""

new_settings = """      {/* Theme Setting */}
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
        
        <button className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/50 p-4 rounded-xl flex items-center justify-between transition-colors">
          <span className="text-sm text-white font-medium">الملف الشخصي</span>
          <ChevronLeft size={16} className="text-zinc-600" />
        </button>"""

content = content.replace(old_settings, new_settings)

with open('src/components/Profile.tsx', 'w') as f:
    f.write(content)
