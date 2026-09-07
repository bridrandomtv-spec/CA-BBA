import { Ticket, Info } from 'lucide-react';

export default function TicketManager() {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl translate-x-10 -translate-y-10"></div>
        
        <div className="relative z-10 flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500">
            <Ticket size={24} />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">حجز التذاكر</h3>
            <p className="text-xs text-zinc-400">تذاكر المباريات القادمة</p>
          </div>
        </div>
        
        <div className="relative z-10 bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6 text-center">
            <Info size={32} className="text-zinc-500 mx-auto mb-3" />
            <h4 className="font-bold text-zinc-400 mb-2">لا توجد تذاكر متاحة حالياً</h4>
            <p className="text-xs text-zinc-500">نظام حجز التذاكر قيد الصيانة. يرجى التحقق لاحقاً.</p>
        </div>
      </div>
    </div>
  );
}
