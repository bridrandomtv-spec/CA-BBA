import sys

with open('src/components/MatchCenter.tsx', 'r') as f:
    content = f.read()

content = content.replace("import MatchHighlights from './MatchHighlights';", "import MatchHighlights from './MatchHighlights';\nimport MatchStatsVisualization from './MatchStatsVisualization';")

old_stats = """      {activeTab === 'stats' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
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

new_stats = """      {activeTab === 'stats' && (
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

content = content.replace(old_stats, new_stats)

with open('src/components/MatchCenter.tsx', 'w') as f:
    f.write(content)
