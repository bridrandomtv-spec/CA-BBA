import { useState, useEffect } from 'react';
import { Play, Pause, Heart, Search, Filter, Music } from 'lucide-react';
import { Chant } from './admin/AdminChants';

export default function ChantsLibrary() {
  const [chants, setChants] = useState<Chant[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [playing, setPlaying] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch('/api/chants')
      .then(res => res.json())
      .then(data => setChants(data.chants))
      .catch(e => console.error(e));

    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, []); // eslint-disable-line

  const handlePlay = async (chant: Chant) => {
    if (!chant.audioUrl) return;
    
    if (playing === chant.id) {
      audioElement?.pause();
      setPlaying(null);
    } else {
      if (audioElement) {
        audioElement.pause();
      }
      const audio = new Audio(chant.audioUrl);
      audio.play().catch(e => console.error("Error playing audio", e));
      setAudioElement(audio);
      setPlaying(chant.id);
      
      try {
        await fetch(`/api/chants/${chant.id}/view`, { method: 'POST' });
        // optimistic update
        setChants(chants.map(c => c.id === chant.id ? { ...c, views: (c.views || 0) + 1 } : c));
      } catch(e) {}
    }
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
          <Music size={20} />
        </div>
        <div>
          <h2 className="font-bold text-white text-xl">أهازيج الكورفا</h2>
          <p className="text-xs text-zinc-400">مكتبة الأغاني والأهازيج الرسمية</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input 
            type="text" 
            placeholder="بحث عن أهزوجة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 pr-10 pl-4 text-white text-sm focus:border-yellow-500 outline-none"
          />
        </div>
        <button className="bg-zinc-900 border border-zinc-800 text-zinc-400 p-2 rounded-xl hover:text-white">
          <Filter size={18} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
        {['all', 'أهازيج الكورفا', 'أغاني النادي'].map((cat) => (
          <button 
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeCategory === cat 
                ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.3)]' 
                : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
            }`}
          >
            {cat === 'all' ? 'الكل' : cat}
          </button>
        ))}
      </div>

      <div className="space-y-4 pb-24">
        {chants
          .filter(c => activeCategory === 'all' || c.category === activeCategory)
          .filter(c => c.title.includes(searchQuery) || c.lyrics.includes(searchQuery))
          .map(c => (
          <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4 group hover:bg-zinc-800/80 transition-colors">
            <button 
              onClick={() => handlePlay(c)}
              className={`w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center transition-colors ${
                playing === c.id 
                  ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]' 
                  : 'bg-zinc-800 text-yellow-500 group-hover:bg-zinc-700'
              }`}
            >
              {playing === c.id ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-1" />}
            </button>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-sm truncate mb-1">{c.title}</h3>
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <span>{c.category}</span>
                <span>•</span>
                <span>{c.views || 0} استماع</span>
              </div>
            </div>
            <button className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-colors">
              <Heart size={20} />
            </button>
          </div>
        ))}

        {chants.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
            <Music size={48} className="text-zinc-700 mb-4" />
            <h4 className="font-bold text-zinc-400">لا توجد أهازيج</h4>
          </div>
        )}
      </div>
    </div>
  );
}
