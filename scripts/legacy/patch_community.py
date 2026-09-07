import re

with open("src/components/FanCommunity.tsx", "r") as f:
    content = f.read()

# Remove FanChallenges import
content = re.sub(r"import FanChallenges from '\./FanChallenges';\n", "", content)

# Remove tabs
tabs_search = """      {/* Header Tabs */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="flex bg-zinc-800 rounded-xl p-1 relative z-10">
          <button 
            onClick={() => setActiveTab('feed')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'feed' ? 'bg-yellow-500 text-black shadow-md' : 'text-zinc-400'
            }`}
          >
            المجتمع
          </button>
          <button 
            onClick={() => setActiveTab('challenges')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'challenges' ? 'bg-yellow-500 text-black shadow-md' : 'text-zinc-400'
            }`}
          >
            التحديات 
          </button>
        </div>
      </div>"""
content = content.replace(tabs_search, "")

# Remove activeTab state
content = re.sub(r"  const \[activeTab, setActiveTab\] = useState<'feed' \| 'challenges'>\('feed'\);\n", "", content)

# Remove {activeTab === 'feed' ? ( ... ) : ( <FanChallenges /> )}
content = content.replace("{activeTab === 'feed' ? (", "")
content = content.replace("        ) : (\n          <FanChallenges />\n        )", "")

with open("src/components/FanCommunity.tsx", "w") as f:
    f.write(content)
