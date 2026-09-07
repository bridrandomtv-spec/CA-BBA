import { useState } from 'react';
import { Bell, ArrowRight, Settings, Newspaper, Trophy, Calendar, CheckCircle2 } from 'lucide-react';
import {
  TRIGGER_NOTIFICATION_EVENT,
  useNotificationSettings,
} from '../hooks/useNotificationSettings';
import usePushNotifications from '../hooks/usePushNotifications';

interface NotificationCenterProps {
  onClose: () => void;
}

export default function NotificationCenter({ onClose }: NotificationCenterProps) {
  const [showSettings, setShowSettings] = useState(false);
  // Même source de vérité que NotificationSettings (écran العضوية) et MatchAlert.
  const { settings, toggleSetting } = useNotificationSettings();
  const push = usePushNotifications();

  const triggerTestNotification = async () => {
    if (push.subscribed) {
      try { await push.test(); onClose(); return; } catch { /* fallback local */ }
    }
    window.dispatchEvent(new Event(TRIGGER_NOTIFICATION_EVENT));
    onClose();
  };

  const handleToggle = (key: keyof typeof settings) => {
    const next = { ...settings, [key]: !settings[key] };
    toggleSetting(key);
    void push.syncPreferences(next);
  };

  const pastNotifications = [
    {
      id: 1,
      type: 'news',
      title: 'تدريبات الفريق',
      message: 'الفريق ينهي تحضيراته لمباراة الغد بحضور جميع اللاعبين.',
      time: 'منذ ساعتين',
      icon: Newspaper,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    {
      id: 2,
      type: 'score',
      title: 'نهاية المباراة!',
      message: 'الكابا 2 - 0 شبيبة القبائل. فوز مستحق للجراد الأصفر!',
      time: 'بالأمس',
      icon: Trophy,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10'
    },
    {
      id: 3,
      type: 'match',
      title: 'مباراة قادمة',
      message: 'لا تنسى مباراة الفريق غداً على الساعة 18:00 في ملعب 20 أوت.',
      time: 'منذ يومين',
      icon: Calendar,
      color: 'text-green-500',
      bg: 'bg-green-500/10'
    }
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-zinc-950 flex flex-col animate-in slide-in-from-right duration-300" dir="rtl">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between sticky top-0 pt-safe">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center">
            <Bell size={20} />
          </div>
          <div>
            <h2 className="font-bold text-white">مركز الإشعارات</h2>
            <p className="text-[10px] text-zinc-400">آخر أخبار ومستجدات الكابا</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${showSettings ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
          >
            <Settings size={20} />
          </button>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowRight size={20} />
          </button>
        </div>
      </div>

      {showSettings ? (
        <div className="p-4 space-y-6 animate-in fade-in slide-in-from-top-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Settings size={16} className="text-yellow-500" />
              تفضيلات الإشعارات (Push)
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white mb-0.5">أخبار الفريق</p>
                  <p className="text-[10px] text-zinc-500">حصريات، تعاقدات، وتصريحات</p>
                </div>
                <button 
                  onClick={() => handleToggle('teamNews')}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${settings.teamNews ? 'bg-yellow-500' : 'bg-zinc-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${settings.teamNews ? 'left-1' : 'right-1'}`}></div>
                </button>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
                <div>
                  <p className="text-sm font-bold text-white mb-0.5">النتائج النهائية</p>
                  <p className="text-[10px] text-zinc-500">نتيجة المباراة فور إطلاق الصافرة</p>
                </div>
                <button 
                  onClick={() => handleToggle('finalScores')}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${settings.finalScores ? 'bg-yellow-500' : 'bg-zinc-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${settings.finalScores ? 'left-1' : 'right-1'}`}></div>
                </button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
                <div>
                  <p className="text-sm font-bold text-white mb-0.5">تذكير المباريات</p>
                  <p className="text-[10px] text-zinc-500">تنبيه قبل بداية المباراة</p>
                </div>
                <button
                  onClick={() => handleToggle('matches')}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${settings.matches ? 'bg-yellow-500' : 'bg-zinc-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${settings.matches ? 'left-1' : 'right-1'}`}></div>
                </button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
                <div>
                  <p className="text-sm font-bold text-white mb-0.5">أهداف المباريات</p>
                  <p className="text-[10px] text-zinc-500">إشعار فوري عند تسجيل الكابا لهدف</p>
                </div>
                <button
                  onClick={() => handleToggle('goals')}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${settings.goals ? 'bg-yellow-500' : 'bg-zinc-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${settings.goals ? 'left-1' : 'right-1'}`}></div>
                </button>
              </div>
            </div>
          </div>

          {push.enabled && (
            <div className="bg-zinc-900 border border-yellow-500/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">إشعارات الهاتف</p>
                  <p className="text-[10px] text-zinc-500">استقبل تنبيهات الكابا حتى عند إغلاق التطبيق.</p>
                </div>
                {push.subscribed ? (
                  <button disabled={push.busy} onClick={() => void push.disable()} className="text-xs font-bold text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg">تعطيل</button>
                ) : (
                  <button disabled={push.busy} onClick={() => void push.enable(settings)} className="text-xs font-bold text-black bg-yellow-500 px-3 py-2 rounded-lg">تفعيل</button>
                )}
              </div>
              {!push.subscribed && <p className="text-[10px] text-zinc-600">سيطلب المتصفح إذن إرسال الإشعارات.</p>}
            </div>
          )}
          
          <button 
            onClick={() => void triggerTestNotification()}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Bell size={16} />
            محاكاة إشعار فوري (تجربة)
          </button>
        </div>
      ) : (
        <div className="p-4 space-y-3 overflow-y-auto pb-20 animate-in fade-in">
          {pastNotifications.map((notif) => (
            <div key={notif.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex gap-3">
              <div className={`w-10 h-10 rounded-full ${notif.bg} ${notif.color} flex items-center justify-center shrink-0`}>
                <notif.icon size={20} />
              </div>
              <div>
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-bold text-white text-sm">{notif.title}</h4>
                  <span className="text-[10px] text-zinc-500 whitespace-nowrap mr-2">{notif.time}</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{notif.message}</p>
              </div>
            </div>
          ))}
          
          <div className="text-center mt-8 text-zinc-500 flex flex-col items-center">
            <CheckCircle2 size={32} className="mb-2 text-zinc-700" />
            <p className="text-xs">لا توجد إشعارات أخرى</p>
          </div>
        </div>
      )}
    </div>
  );
}
