import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Goal, Target } from 'lucide-react';

export default function TeamStats() {
  const data = [
    { match: '1', points: 3 },
    { match: '2', points: 6 },
    { match: '3', points: 7 },
    { match: '4', points: 10 },
    { match: '5', points: 13 },
    { match: '6', points: 14 },
    { match: '7', points: 17 },
    { match: '8', points: 20 },
    { match: '9', points: 21 },
    { match: '10', points: 24 },
  ];

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

      <div className="h-32 w-full mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="match" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '8px', fontSize: '12px' }}
              itemStyle={{ color: '#eab308', fontWeight: 'bold' }}
              labelStyle={{ color: '#a1a1aa' }}
              formatter={(value) => [`${value} نقطة`, 'النقاط']}
              labelFormatter={(label) => `الجولة ${label}`}
            />
            <Line 
              type="monotone" 
              dataKey="points" 
              stroke="#eab308" 
              strokeWidth={3}
              dot={{ r: 4, fill: '#18181b', stroke: '#eab308', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#eab308', stroke: '#18181b', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center">
            <Goal size={20} />
          </div>
          <div>
            <p className="text-xs text-zinc-400">أهداف مسجلة</p>
            <p className="font-black text-white text-lg">18</p>
          </div>
        </div>
        
        <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center">
            <Target size={20} />
          </div>
          <div>
            <p className="text-xs text-zinc-400">أهداف مستقبلة</p>
            <p className="font-black text-white text-lg">7</p>
          </div>
        </div>
      </div>
    </div>
  );
}
