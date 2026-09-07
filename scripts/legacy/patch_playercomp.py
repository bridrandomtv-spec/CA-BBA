import sys

with open('src/components/PlayerComparison.tsx', 'r') as f:
    content = f.read()

# Add imports for line chart
if 'LineChart' not in content:
    content = content.replace("import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';", 
                              "import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';\nimport { TrendingUp } from 'lucide-react';")

# Replace playersData to include history
old_data = """const playersData = [
  { id: 1, name: 'أمين. ب', pos: 'مهاجم', stats: { 'التسديد': 85, 'التمرير': 70, 'المراوغة': 90, 'السرعة': 88, 'الدفاع': 30, 'البدنية': 75 } },
  { id: 2, name: 'كريم. ح', pos: 'جناح', stats: { 'التسديد': 75, 'التمرير': 85, 'المراوغة': 82, 'السرعة': 92, 'الدفاع': 45, 'البدنية': 65 } },
  { id: 3, name: 'رياض. م', pos: 'صانع', stats: { 'التسديد': 80, 'التمرير': 95, 'المراوغة': 88, 'السرعة': 80, 'الدفاع': 50, 'البدنية': 60 } },
  { id: 4, name: 'محمد. أ', pos: 'ارتكاز', stats: { 'التسديد': 60, 'التمرير': 80, 'المراوغة': 65, 'السرعة': 70, 'الدفاع': 90, 'البدنية': 85 } },
  { id: 5, name: 'طارق. ق', pos: 'مدافع', stats: { 'التسديد': 45, 'التمرير': 65, 'المراوغة': 55, 'السرعة': 75, 'الدفاع': 95, 'البدنية': 92 } },
  { id: 6, name: 'سمير. و', pos: 'حارس', stats: { 'التسديد': 15, 'التمرير': 50, 'المراوغة': 20, 'السرعة': 60, 'الدفاع': 85, 'البدنية': 80 } },
];"""

new_data = """const playersData = [
  { 
    id: 1, name: 'أمين. ب', pos: 'مهاجم', 
    stats: { 'التسديد': 85, 'التمرير': 70, 'المراوغة': 90, 'السرعة': 88, 'الدفاع': 30, 'البدنية': 75 },
    history: [{ season: '20-21', rating: 72 }, { season: '21-22', rating: 78 }, { season: '22-23', rating: 85 }, { season: '23-24', rating: 89 }]
  },
  { 
    id: 2, name: 'كريم. ح', pos: 'جناح', 
    stats: { 'التسديد': 75, 'التمرير': 85, 'المراوغة': 82, 'السرعة': 92, 'الدفاع': 45, 'البدنية': 65 },
    history: [{ season: '20-21', rating: 68 }, { season: '21-22', rating: 75 }, { season: '22-23', rating: 80 }, { season: '23-24', rating: 83 }]
  },
  { 
    id: 3, name: 'رياض. م', pos: 'صانع', 
    stats: { 'التسديد': 80, 'التمرير': 95, 'المراوغة': 88, 'السرعة': 80, 'الدفاع': 50, 'البدنية': 60 },
    history: [{ season: '20-21', rating: 82 }, { season: '21-22', rating: 84 }, { season: '22-23', rating: 86 }, { season: '23-24', rating: 88 }]
  },
  { 
    id: 4, name: 'محمد. أ', pos: 'ارتكاز', 
    stats: { 'التسديد': 60, 'التمرير': 80, 'المراوغة': 65, 'السرعة': 70, 'الدفاع': 90, 'البدنية': 85 },
    history: [{ season: '20-21', rating: 70 }, { season: '21-22', rating: 74 }, { season: '22-23', rating: 79 }, { season: '23-24', rating: 82 }]
  },
  { 
    id: 5, name: 'طارق. ق', pos: 'مدافع', 
    stats: { 'التسديد': 45, 'التمرير': 65, 'المراوغة': 55, 'السرعة': 75, 'الدفاع': 95, 'البدنية': 92 },
    history: [{ season: '20-21', rating: 75 }, { season: '21-22', rating: 80 }, { season: '22-23', rating: 84 }, { season: '23-24', rating: 86 }]
  },
  { 
    id: 6, name: 'سمير. و', pos: 'حارس', 
    stats: { 'التسديد': 15, 'التمرير': 50, 'المراوغة': 20, 'السرعة': 60, 'الدفاع': 85, 'البدنية': 80 },
    history: [{ season: '20-21', rating: 65 }, { season: '21-22', rating: 70 }, { season: '22-23', rating: 72 }, { season: '23-24', rating: 75 }]
  },
];"""
content = content.replace(old_data, new_data)


history_chart = """
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-yellow-500" />
          التطور عبر المواسم
        </h3>
        
        <div className="h-[200px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historyData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="season" stroke="#71717a" fontSize={10} tickMargin={10} />
              <YAxis stroke="#71717a" fontSize={10} domain={[50, 100]} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', textAlign: 'right' }}
                labelStyle={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px' }}
                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" name={player1.name} dataKey="player1Score" stroke="#eab308" strokeWidth={3} dot={{ r: 4, fill: '#eab308' }} activeDot={{ r: 6 }} />
              <Line type="monotone" name={player2.name} dataKey="player2Score" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
"""

old_return = """    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">"""

state_and_vars = """  const chartData = attributes.map(attr => ({
    subject: attr,
    A: player1.stats[attr as keyof typeof player1.stats],
    B: player2.stats[attr as keyof typeof player2.stats],
    fullMark: 100,
  }));
"""
new_state_and_vars = state_and_vars + """
  const seasons = ['20-21', '21-22', '22-23', '23-24'];
  const historyData = seasons.map(season => {
    const p1Season = player1.history.find(h => h.season === season);
    const p2Season = player2.history.find(h => h.season === season);
    return {
      season,
      player1Score: p1Season ? p1Season.rating : 0,
      player2Score: p2Season ? p2Season.rating : 0,
    };
  });
"""
content = content.replace(state_and_vars, new_state_and_vars)


if "التطور عبر المواسم" not in content:
    content = content.replace("    </div>\n  );\n}\n", history_chart + "    </div>\n  );\n}\n")


with open('src/components/PlayerComparison.tsx', 'w') as f:
    f.write(content)
