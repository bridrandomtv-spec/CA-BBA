import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function MatchStatsVisualization() {
  const data = [
    {
      name: 'الاستحواذ (%)',
      'الكابا': 58,
      'المنافس': 42,
    },
    {
      name: 'التسديدات',
      'الكابا': 12,
      'المنافس': 8,
    },
    {
      name: 'تسديدات على المرمى',
      'الكابا': 5,
      'المنافس': 2,
    },
    {
      name: 'الأخطاء',
      'الكابا': 10,
      'المنافس': 14,
    },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm w-full h-[300px]">
      <h3 className="font-bold text-white text-sm mb-4 text-center">مقارنة الإحصائيات (رسم بياني)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis type="number" stroke="#a1a1aa" fontSize={12} />
          <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={10} width={80} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '0.5rem', color: '#fff' }}
            itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
            cursor={{fill: '#27272a'}}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Bar dataKey="الكابا" fill="#eab308" radius={[0, 4, 4, 0]} />
          <Bar dataKey="المنافس" fill="#52525b" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
