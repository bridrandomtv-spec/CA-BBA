import { useState } from 'react';
import { Bell, Goal, Zap, Calendar, ChevronLeft, ChevronDown } from 'lucide-react';
import { useNotificationSettings } from '../hooks/useNotificationSettings';

export default function NotificationSettings() {
  const [isOpen, setIsOpen] = useState(false);
  // Schéma partagé avec NotificationCenter et MatchAlert : basculer un
  // interrupteur ici se répercute immédiatement sur les alertes réelles.
  const { settings, toggleSetting } = useNotificationSettings();

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-all duration-300">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-zinc-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Bell size={18} className="text-zinc-400" />
          <span className="text-sm text-white font-medium">إعدادات الإشعارات</span>
        </div>
        {isOpen ? <ChevronDown size={16} className="text-zinc-600" /> : <ChevronLeft size={16} className="text-zinc-600" />}
      </button>

      {isOpen && (
        <div className="p-4 border-t border-zinc-800/50 space-y-4 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
                <Goal size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-0.5">أهداف المباريات</p>
                <p className="text-[10px] text-zinc-500">إشعار فوري عند تسجيل الكابا لهدف</p>
              </div>
            </div>
            <button 
              onClick={() => toggleSetting('goals')}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${settings.goals ? 'bg-yellow-500' : 'bg-zinc-700'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${settings.goals ? 'left-1' : 'right-1'}`}></div>
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
                <Zap size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-0.5">الأخبار العاجلة</p>
                <p className="text-[10px] text-zinc-500">أحدث صفقات النادي وقرارات الإدارة</p>
              </div>
            </div>
            <button
              onClick={() => toggleSetting('teamNews')}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${settings.teamNews ? 'bg-yellow-500' : 'bg-zinc-700'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${settings.teamNews ? 'left-1' : 'right-1'}`}></div>
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Calendar size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-0.5">مواعيد المباريات</p>
                <p className="text-[10px] text-zinc-500">تذكير قبل بداية مباريات الفريق</p>
              </div>
            </div>
            <button 
              onClick={() => toggleSetting('matches')}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${settings.matches ? 'bg-yellow-500' : 'bg-zinc-700'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${settings.matches ? 'left-1' : 'right-1'}`}></div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
