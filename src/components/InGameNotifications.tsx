import { Goal, Repeat, Info, Clock } from 'lucide-react';

interface MatchEvent {
  id: string;
  minute: string;
  type: 'goal' | 'yellow-card' | 'red-card' | 'sub' | 'info';
  text: string;
  team: 'cabba' | 'opponent' | 'info';
}

export default function InGameNotifications() {
  const events: MatchEvent[] = [
    { id: '1', minute: "68'", type: 'sub', text: 'تبديل للكابا: دخول فوزي وخروج رياض', team: 'cabba' },
    { id: '2', minute: "65'", type: 'goal', text: 'جوووووول! الكابا تفتتح التسجيل عن طريق ياسين بتسديدة قوية من خارج منطقة الجزاء.', team: 'cabba' },
    { id: '3', minute: "54'", type: 'yellow-card', text: 'بطاقة صفراء لمدافع المنافس بعد تدخل قوي.', team: 'opponent' },
    { id: '4', minute: "45'", type: 'info', text: 'بداية الشوط الثاني.', team: 'info' },
    { id: '5', minute: "45+2'", type: 'info', text: 'نهاية الشوط الأول بالتعادل السلبي.', team: 'info' },
    { id: '6', minute: "32'", type: 'yellow-card', text: 'بطاقة صفراء للاعب وسط الكابا.', team: 'cabba' },
    { id: '7', minute: "12'", type: 'info', text: 'فرصة خطيرة للكابا، رأسية المهاجم تمر بجوار القائم.', team: 'cabba' },
    { id: '8', minute: "1'", type: 'info', text: 'بداية المباراة!', team: 'info' },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm animate-in fade-in slide-in-from-right-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-white text-lg flex items-center gap-2">
          <Clock size={20} className="text-yellow-500" /> أحداث المباراة
        </h3>
        <span className="flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> تحديث مباشر
        </span>
      </div>

      <div className="space-y-0 relative before:absolute before:inset-0 before:ml-[1.125rem] md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-800 before:to-transparent">
        {events.map((event) => (
          <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-6 last:mb-0">
            <div className={`flex items-center justify-center w-9 h-9 rounded-full border-2 shrink-0 z-10 ${
              event.type === 'goal' ? 'bg-zinc-900 border-yellow-500 text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]' :
              event.type === 'yellow-card' ? 'bg-zinc-900 border-yellow-400 text-yellow-400' :
              event.type === 'red-card' ? 'bg-zinc-900 border-red-500 text-red-500' :
              event.type === 'sub' ? 'bg-zinc-900 border-blue-500 text-blue-500' :
              'bg-zinc-900 border-zinc-600 text-zinc-400'
            }`}>
              {event.type === 'goal' && <Goal size={14} />}
              {event.type === 'yellow-card' && <div className="w-3 h-4 bg-yellow-400 rounded-sm"></div>}
              {event.type === 'red-card' && <div className="w-3 h-4 bg-red-500 rounded-sm"></div>}
              {event.type === 'sub' && <Repeat size={14} />}
              {event.type === 'info' && <Info size={14} />}
            </div>
            
            <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-3 rounded-xl border border-zinc-800/50 bg-zinc-800/20 mr-4 md:mr-0">
              <div className="flex items-start gap-3">
                <span className={`text-xs font-black shrink-0 ${event.team === 'cabba' ? 'text-yellow-500' : event.team === 'opponent' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  {event.minute}
                </span>
                <p className={`text-sm ${event.team === 'cabba' && event.type === 'goal' ? 'font-bold text-white' : 'text-zinc-300'}`}>
                  {event.text}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
