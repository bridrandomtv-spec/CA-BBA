import sys
import re

with open('src/components/MatchCenter.tsx', 'r') as f:
    content = f.read()

# Replace the motm tab block using regex
old_motm_pattern = r"\{activeTab === 'motm' && \(\s*<div className=\"bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center animate-in fade-in slide-in-from-right-4\">.*?</div>\s*\)\}"
new_motm = "{activeTab === 'motm' && <MatchMVP />}"

content = re.sub(old_motm_pattern, new_motm, content, flags=re.DOTALL)

with open('src/components/MatchCenter.tsx', 'w') as f:
    f.write(content)

