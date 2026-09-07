import sys

with open('src/components/MatchCenter.tsx', 'r') as f:
    content = f.read()

# import
content = content.replace("import MatchMVP from './MatchMVP';", "import MatchMVP from './MatchMVP';\nimport MatchScout from './MatchScout';\nimport { Target } from 'lucide-react';")

# useState
content = content.replace("useState<'live' | 'stats' | 'formation' | 'motm' | 'travel' | 'predictions' | 'calendar' | 'tickets'>('live');", "useState<'live' | 'stats' | 'formation' | 'motm' | 'travel' | 'predictions' | 'calendar' | 'tickets' | 'scout'>('live');")

# Button
old_tickets_btn = """        <button 
          onClick={() => setActiveTab('tickets')}
          className={`flex-none px-4 flex justify-center items-center gap-2 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'tickets' ? 'bg-zinc-800 text-yellow-500 shadow-sm' : 'text-zinc-500'}`}
        >
          <Ticket size={14} /> التذاكر
        </button>"""

new_tickets_btn = old_tickets_btn + """
        <button 
          onClick={() => setActiveTab('scout')}
          className={`flex-none px-4 flex justify-center items-center gap-2 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'scout' ? 'bg-zinc-800 text-yellow-500 shadow-sm' : 'text-zinc-500'}`}
        >
          <Target size={14} /> كشاف المباراة
        </button>"""

content = content.replace(old_tickets_btn, new_tickets_btn)

# Tab content
old_tickets_content = """      {activeTab === 'tickets' && <TicketManager />}"""
new_tickets_content = old_tickets_content + """
      {activeTab === 'scout' && <MatchScout />}"""
content = content.replace(old_tickets_content, new_tickets_content)

with open('src/components/MatchCenter.tsx', 'w') as f:
    f.write(content)
