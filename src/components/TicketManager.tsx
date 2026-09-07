import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Ticket, Calendar, MapPin, CheckCircle, CreditCard } from 'lucide-react';

export default function TicketManager() {
  const [booked, setBooked] = useState(false);

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

        {!booked ? (
          <div className="space-y-5 relative z-10">
            <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
              <div className="flex justify-between items-center mb-3 pb-3 border-b border-zinc-700/50">
                <span className="text-xs font-bold text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">الرابطة المحترفة الأولى</span>
                <span className="text-sm font-black text-white">500 دج</span>
              </div>
              
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-zinc-800 rounded-full border border-zinc-600 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">C</span>
                  </div>
                  <span className="font-bold text-white text-sm">الكابا</span>
                </div>
                <span className="text-zinc-500 text-xs font-bold">ضد</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">المنافس</span>
                  <div className="w-8 h-8 bg-zinc-800 rounded-full border border-zinc-600 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">M</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Calendar size={14} className="text-zinc-500" /> 15 مارس - 14:30
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <MapPin size={14} className="text-zinc-500" /> ملعب 20 أوت 1955
                </div>
              </div>
            </div>

            <button 
              onClick={() => setBooked(true)}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_25px_rgba(234,179,8,0.5)] flex items-center justify-center gap-2"
            >
              <CreditCard size={18} /> شراء التذكرة الآن
            </button>
          </div>
        ) : (
          <div className="py-6 animate-in zoom-in duration-300 text-center relative z-10">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/50">
              <CheckCircle className="text-green-500 w-8 h-8" />
            </div>
            <div className="bg-white p-3 rounded-xl inline-block mb-4 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <QRCodeSVG value="TICKET-78X92" size={128} />
            </div>

            <h4 className="font-bold text-white text-lg mb-2">تم الحجز بنجاح!</h4>
            <p className="text-xs text-zinc-400 max-w-[250px] mx-auto mb-6">يمكنك العثور على تذكرتك الرقمية وكود الـ QR في صفحة الملف الشخصي.</p>
            
            <button 
              onClick={() => setBooked(false)}
              className="mt-2 text-xs text-zinc-500 hover:text-white underline underline-offset-4 transition-colors"
            >
              حجز تذكرة أخرى
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
