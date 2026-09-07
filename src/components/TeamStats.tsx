import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Goal, Target } from 'lucide-react';

export default function TeamStats() {
  // Empty data as there is no backend API for this yet
  const data: any[] = [];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg overflow-hidden relative">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg text-white flex items-center gap-2">
          <TrendingUp size={18} className="text-yellow-500" />
          أداء الفريق
        </h3>
        <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-1 rounded font-bold uppercase">
          آخر 10 مباريات
        </span>
      </div>

      <div className="text-center text-zinc-500 py-10 border border-zinc-800 border-dashed rounded-xl text-xs mb-4">
        إحصائيات الفريق غير متوفرة حالياً
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center">
            <Goal size={20} />
          </div>
          <div>
            <p className="text-xs text-zinc-400">أهداف مسجلة</p>
            <p className="font-black text-zinc-500 text-lg">-</p>
          </div>
        </div>
        
        <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center">
            <Target size={20} />
          </div>
          <div>
            <p className="text-xs text-zinc-400">أهداف مستقبلة</p>
            <p className="font-black text-zinc-500 text-lg">-</p>
          </div>
        </div>
      </div>
    </div>
  );
}
