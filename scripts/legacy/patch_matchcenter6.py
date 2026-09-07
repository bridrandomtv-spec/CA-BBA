import sys

with open('src/components/MatchCenter.tsx', 'r') as f:
    content = f.read()

old_motm = """      {activeTab === 'motm' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center animate-in fade-in slide-in-from-right-4">
          <Star className="text-yellow-500 w-12 h-12 mx-auto mb-3 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
          <h3 className="font-bold text-white text-lg mb-2">رجل المباراة</h3>
          <p className="text-xs text-zinc-400 mb-6">صوت للاعب المفضل لديك في هذه المباراة. التصويت يغلق بعد صافرة النهاية.</p>
          
          <div className="space-y-3">
            {['ياسين (10)', 'رياض (9)', 'فوزي (1)'].map((player, i) => (
              <button key={i} className="w-full bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-yellow-500/50 rounded-xl p-3 flex justify-between items-center transition-colors">
                <span className="font-bold text-white text-sm">{player}</span>
                <div className="w-5 h-5 rounded-full border-2 border-zinc-500 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-transparent"></div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}"""

new_motm = """      {activeTab === 'motm' && <MatchMVP />}"""

if old_motm in content:
    content = content.replace(old_motm, new_motm)
else:
    print("Old MOTM not found!")

with open('src/components/MatchCenter.tsx', 'w') as f:
    f.write(content)
