import re

content = """import { Play, Calendar, Star, X, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Highlight {
  id: string;
  title: string;
  match: string;
  date: string;
  duration: string;
  thumbnail: string;
  videoUrl?: string;
  createdAt: number;
}

export default function MatchHighlights() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'highlights'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Highlight[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as Highlight);
      });
      setHighlights(data);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
      <div className="flex items-center justify-between mb-2 mt-6">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Star size={16} className="text-yellow-500" /> ملخصات وأهداف
        </h3>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-10">
          <span className="text-zinc-500 text-sm">جاري التحميل...</span>
        </div>
      ) : highlights.length > 0 ? (
        <div className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {highlights.map(highlight => (
            <div key={highlight.id} onClick={() => setPlayingId(highlight.id)} className="w-[280px] flex-none bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden group snap-center shadow-lg cursor-pointer">
              <div className="relative aspect-video">
                <img src={highlight.thumbnail} alt={highlight.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-yellow-500 text-black flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.5)] scale-90 group-hover:scale-100 transition-transform">
                    <Play size={20} className="fill-current translate-x-[-1px]" />
                  </div>
                </div>
                <span className="absolute bottom-2 left-2 bg-black/80 text-zinc-50 text-[10px] px-2 py-1 rounded font-medium backdrop-blur-sm z-20">
                  {highlight.duration}
                </span>
              </div>
              <div className="p-4">
                <h4 className="text-sm font-bold text-white mb-2 line-clamp-2">{highlight.title}</h4>
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span className="font-medium text-yellow-500/80">{highlight.match}</span>
                  <div className="flex items-center gap-1">
                    <Calendar size={10} />
                    <span>{highlight.date}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-sm">
          <Activity size={32} className="text-zinc-700 mb-3" />
          <h4 className="font-bold text-white mb-1">لا توجد ملخصات متاحة حالياً</h4>
          <p className="text-xs text-zinc-500">سيتم إضافة ملخصات المباريات القادمة هنا.</p>
        </div>
      )}

      {playingId && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <button 
            onClick={() => setPlayingId(null)}
            className="absolute top-safe right-4 w-10 h-10 bg-zinc-800/50 rounded-full flex items-center justify-center text-white hover:bg-zinc-700 transition-colors z-50"
          >
            <X size={24} />
          </button>
          
          <div className="w-full max-w-3xl aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-[0_0_50px_rgba(234,179,8,0.15)] relative flex items-center justify-center group">
             {highlights.find(h => h.id === playingId)?.videoUrl ? (
               <iframe 
                 src={highlights.find(h => h.id === playingId)?.videoUrl} 
                 className="w-full h-full"
                 allowFullScreen
               ></iframe>
             ) : (
               <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-500">
                  <Play size={48} className="text-zinc-600" />
                  <p className="font-bold text-sm">الفيديو غير متوفر</p>
               </div>
             )}
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
    </div>
  );
}
"""

with open("src/components/MatchHighlights.tsx", "w") as f:
    f.write(content)
