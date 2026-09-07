import sys

with open('src/components/MatchCenter.tsx', 'r') as f:
    content = f.read()

# Add import
if 'import SeasonStats from' not in content:
    content = content.replace("import MatchStatsVisualization from './MatchStatsVisualization';", "import MatchStatsVisualization from './MatchStatsVisualization';\nimport SeasonStats from './SeasonStats';\nimport { PieChart as PieChartIcon } from 'lucide-react';")

# State
content = content.replace(
    "useState<'live' | 'stats' | 'formation' | 'motm' | 'travel' | 'predictions' | 'calendar' | 'tickets' | 'scout'>('live');",
    "useState<'live' | 'stats' | 'season' | 'formation' | 'motm' | 'travel' | 'predictions' | 'calendar' | 'tickets' | 'scout'>('live');"
)

# Tab button
old_stats_btn = """        <button 
          onClick={() => setActiveTab('stats')}
          className={`flex-none px-4 flex justify-center items-center gap-2 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'stats' ? 'bg-zinc-800 text-yellow-500 shadow-sm' : 'text-zinc-500'}`}
        >
          <BarChart3 size={14} /> الإحصائيات
        </button>"""
        
new_stats_btn = old_stats_btn + """
        <button 
          onClick={() => setActiveTab('season')}
          className={`flex-none px-4 flex justify-center items-center gap-2 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'season' ? 'bg-zinc-800 text-yellow-500 shadow-sm' : 'text-zinc-500'}`}
        >
          <PieChartIcon size={14} /> إحصائيات الموسم
        </button>"""

if "<PieChartIcon size={14} /> إحصائيات الموسم" not in content:
    content = content.replace(old_stats_btn, new_stats_btn)

# Tab content
old_stats_content = """      {activeTab === 'stats' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
          <MatchStatsVisualization />
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h3 className="font-bold text-sm text-white mb-4 text-center">الاستحواذ على الكرة</h3>
            <div className="flex justify-between text-xs font-bold text-white mb-2">
              <span>الكابا 58%</span>
              <span>المنافس 42%</span>
            </div>
            <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-yellow-500 w-[58%]"></div>
              <div className="h-full bg-zinc-600 w-[42%]"></div>
            </div>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
            <StatRow label="التسديدات (على المرمى)" val1="12 (5)" val2="8 (2)" leftColor="bg-yellow-500" rightColor="bg-zinc-600" leftPercent={60} rightPercent={40} />
            <StatRow label="التمريرات الدقيقة" val1="340" val2="210" leftColor="bg-yellow-500" rightColor="bg-zinc-600" leftPercent={62} rightPercent={38} />
            <StatRow label="الركنيات" val1="6" val2="2" leftColor="bg-yellow-500" rightColor="bg-zinc-600" leftPercent={75} rightPercent={25} />
            <StatRow label="البطاقات الصفراء" val1="1" val2="3" leftColor="bg-yellow-500" rightColor="bg-zinc-600" leftPercent={25} rightPercent={75} />
          </div>
        </div>
      )}"""

new_stats_content = old_stats_content + """
      {activeTab === 'season' && <SeasonStats />}"""

if "{activeTab === 'season' && <SeasonStats />}" not in content:
    content = content.replace(old_stats_content, new_stats_content)

with open('src/components/MatchCenter.tsx', 'w') as f:
    f.write(content)
