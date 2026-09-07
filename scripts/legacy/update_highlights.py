import sys

with open('src/components/MatchHighlights.tsx', 'r') as f:
    content = f.read()

content = content.replace("export default function MatchHighlights() {", "import { useState } from 'react';\nimport { X } from 'lucide-react';\nexport default function MatchHighlights() {\n  const [playingId, setPlayingId] = useState<string | null>(null);")

click_handler = "onClick={() => setPlayingId(highlight.id)}"

content = content.replace('className="w-[280px] flex-none bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden group snap-center shadow-lg cursor-pointer"', f'onClick={{() => setPlayingId(highlight.id)}} className="w-[280px] flex-none bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden group snap-center shadow-lg cursor-pointer"')

modal = """      {playingId && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <button 
            onClick={() => setPlayingId(null)}
            className="absolute top-safe right-4 w-10 h-10 bg-zinc-800/50 rounded-full flex items-center justify-center text-white hover:bg-zinc-700 transition-colors z-50"
          >
            <X size={24} />
          </button>
          
          <div className="w-full max-w-3xl aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-[0_0_50px_rgba(234,179,8,0.15)] relative flex items-center justify-center group">
             <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-500">
                <Play size={48} className="text-zinc-600 group-hover:text-yellow-500 transition-colors" />
                <p className="font-bold text-sm">مشغل الفيديو (نسخة تجريبية)</p>
             </div>
             
             {/* Fake controls bar */}
             <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
               <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                 <div className="w-1/3 h-full bg-yellow-500 rounded-full"></div>
               </div>
             </div>
          </div>
          
          <div className="w-full max-w-3xl mt-4 text-right">
             <h3 className="font-bold text-white text-lg">
                {highlights.find(h => h.id === playingId)?.title}
             </h3>
             <p className="text-zinc-400 text-sm mt-1">
                {highlights.find(h => h.id === playingId)?.match}
             </p>
          </div>
        </div>
      )}
"""

content = content.replace("</div>\n    </div>", "</div>\n" + modal + "    </div>")

with open('src/components/MatchHighlights.tsx', 'w') as f:
    f.write(content)
