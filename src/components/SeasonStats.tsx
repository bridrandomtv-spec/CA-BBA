import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';

const goalsByMatchData = [
  { match: 'ج 1', goalsScored: 2, goalsConceded: 0 },
  { match: 'ج 2', goalsScored: 1, goalsConceded: 1 },
  { match: 'ج 3', goalsScored: 3, goalsConceded: 1 },
  { match: 'ج 4', goalsScored: 0, goalsConceded: 2 },
  { match: 'ج 5', goalsScored: 2, goalsConceded: 1 },
  { match: 'ج 6', goalsScored: 1, goalsConceded: 0 },
  { match: 'ج 7', goalsScored: 4, goalsConceded: 2 },
];

const resultsData = [
  { name: 'فوز', value: 4, color: '#22c55e' }, // green-500
  { name: 'تعادل', value: 2, color: '#eab308' }, // yellow-500
  { name: 'خسارة', value: 1, color: '#ef4444' }, // red-500
];

const goalsByMinuteData = [
  { time: '0-15', goals: 2 },
  { time: '16-30', goals: 1 },
  { time: '31-45', goals: 4 },
  { time: '46-60', goals: 3 },
  { time: '61-75', goals: 1 },
  { time: '76-90+', goals: 5 },
];

export default function SeasonStats() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm">
          <span className="text-2xl font-black text-yellow-500 mb-1">13</span>
          <span className="text-[10px] text-zinc-400 font-bold text-center">أهداف مسجلة</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm">
          <span className="text-2xl font-black text-zinc-300 mb-1">7</span>
          <span className="text-[10px] text-zinc-400 font-bold text-center">أهداف مستقبلة</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm">
          <span className="text-2xl font-black text-green-500 mb-1">4</span>
          <span className="text-[10px] text-zinc-400 font-bold text-center">شباك نظيفة</span>
        </div>
      </div>

      {/* Results Pie Chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
          <PieChartIcon size={16} className="text-yellow-500" />
          نتائج الموسم
        </h3>
        <div className="h-[200px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={resultsData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {resultsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', textAlign: 'right' }}
                itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Goals Over Time (Line Chart) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-yellow-500" />
          الأهداف حسب الجولة
        </h3>
        <div className="h-[200px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={goalsByMatchData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="match" stroke="#71717a" fontSize={10} tickMargin={10} />
              <YAxis stroke="#71717a" fontSize={10} allowDecimals={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', textAlign: 'right' }}
                labelStyle={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px' }}
                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" name="مسجلة" dataKey="goalsScored" stroke="#eab308" strokeWidth={3} dot={{ r: 4, fill: '#eab308' }} activeDot={{ r: 6 }} />
              <Line type="monotone" name="مستقبلة" dataKey="goalsConceded" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Goal Distribution (Bar Chart) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
          <BarChart3 size={16} className="text-yellow-500" />
          توزيع الأهداف في الدقائق
        </h3>
        <div className="h-[200px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={goalsByMinuteData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="time" stroke="#71717a" fontSize={10} tickMargin={10} />
              <YAxis stroke="#71717a" fontSize={10} allowDecimals={false} />
              <Tooltip 
                cursor={{ fill: '#27272a' }}
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', textAlign: 'right' }}
                labelStyle={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px' }}
                itemStyle={{ color: '#eab308', fontSize: '12px', fontWeight: 'bold' }}
              />
              <Bar name="الأهداف" dataKey="goals" fill="#eab308" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
