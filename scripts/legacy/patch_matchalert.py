import sys

with open('src/components/MatchAlert.tsx', 'r') as f:
    content = f.read()

new_content = """import { useState, useEffect } from 'react';
import { Bell, X, Calendar, Newspaper, Trophy } from 'lucide-react';

export default function MatchAlert() {
  const [alert, setAlert] = useState<{ type: string; title: string; message: string; icon: any } | null>(null);

  const checkSettings = () => {
    const saved = localStorage.getItem('cabba-notifications');
    if (saved) {
      const settings = JSON.parse(saved);
      
      const possibleAlerts = [];
      
      if (settings.matches) {
        possibleAlerts.push({
          type: 'match',
          title: 'تذكير بمباراة قادمة!',
          message: 'تبدأ مباراة الكابا القادمة خلال 30 دقيقة. استعد لدعم فريقك!',
          icon: Calendar
        });
      }
      
      if (settings.teamNews) {
        possibleAlerts.push({
          type: 'news',
          title: 'خبر عاجل!',
          message: 'الكابا يعلن عن تعاقد جديد لتعزيز صفوف الفريق الأول.',
          icon: Newspaper
        });
      }
      
      if (settings.finalScores) {
        possibleAlerts.push({
          type: 'score',
          title: 'نهاية المباراة!',
          message: 'الكابا 2 - 0 شبيبة القبائل. فوز مستحق للجراد الأصفر!',
          icon: Trophy
        });
      }
      
      if (possibleAlerts.length > 0) {
        // Pick a random alert
        const randomAlert = possibleAlerts[Math.floor(Math.random() * possibleAlerts.length)];
        setAlert(randomAlert);
        
        // Hide after 10 seconds
        setTimeout(() => setAlert(null), 10000);
      } else {
        setAlert(null);
      }
    }
  };

  useEffect(() => {
    // Listen for setting changes
    window.addEventListener('cabba-notifications-updated', checkSettings);
    
    // Simulate notification when a specific event is dispatched
    window.addEventListener('cabba-trigger-notification', checkSettings as EventListener);
    
    // Periodically simulate alerts if enabled
    const interval = setInterval(() => {
      checkSettings();
    }, 60000); // every minute

    return () => {
      window.removeEventListener('cabba-notifications-updated', checkSettings);
      window.removeEventListener('cabba-trigger-notification', checkSettings as EventListener);
      clearInterval(interval);
    };
  }, []);

  if (!alert) return null;

  return (
    <div className="fixed top-safe pt-4 left-4 right-4 z-[100] animate-in slide-in-from-top-10 fade-in duration-500">
      <div className="bg-zinc-900 border border-yellow-500/30 shadow-[0_10px_30px_rgba(234,179,8,0.2)] rounded-2xl p-4 flex items-start gap-4" dir="rtl">
        <div className="w-10 h-10 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center shrink-0 mt-1">
          <alert.icon size={20} />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-white text-sm mb-1">{alert.title}</h4>
          <p className="text-xs text-zinc-300 mb-2">{alert.message}</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-bold">تنبيه فوري</span>
          </div>
        </div>
        <button 
          onClick={() => setAlert(null)}
          className="text-zinc-500 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
"""

with open('src/components/MatchAlert.tsx', 'w') as f:
    f.write(new_content)
