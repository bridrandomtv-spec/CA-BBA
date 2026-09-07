import { useState, useEffect } from 'react';
import { Play, Tv, Eye, Share2, Search, Filter } from 'lucide-react';
import { Video } from './admin/AdminVideos';

export default function CabbaTv() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/api/videos')
      .then(res => res.json())
      .then(data => {
        // The API already returns published videos only; kept as a second gate.
        setVideos(data.videos.filter((v: Video) => v.published));
      })
      .catch(e => console.error(e));
  }, []);

  const handlePlay = async (v: Video) => {
    window.open(v.videoUrl, '_blank');
    try {
      await fetch(`/api/videos/${v.id}/view`, { method: 'POST' });
      // optimistic UI update
      setVideos(videos.map(video => video.id === v.id ? { ...video, views: (video.views || 0) + 1 } : video));
    } catch(e) {}
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
          <Tv size={20} />
        </div>
        <div>
          <h2 className="font-bold text-white text-xl">CABBA TV</h2>
          <p className="text-xs text-zinc-400">ملخصات، كواليس وتصريحات حصرية</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input 
            type="text" 
            placeholder="بحث عن فيديو..."
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
        {['all', 'ملخصات', 'كواليس', 'تصريحات'].map((cat) => (
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
        {videos
          .filter(v => activeCategory === 'all' || v.category === activeCategory)
          .filter(v => v.title.includes(searchQuery) || v.description.includes(searchQuery))
          .map(v => (
          <div key={v.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden group cursor-pointer" onClick={() => handlePlay(v)}>
            <div className="relative aspect-video bg-zinc-800">
              {v.thumbnail ? (
                <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700">
                  <Tv size={48} />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center text-black pl-1 shadow-[0_0_20px_rgba(234,179,8,0.4)] transform scale-90 group-hover:scale-100 transition-all">
                  <Play size={24} className="fill-current" />
                </div>
              </div>
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-bold text-yellow-500">
                {v.category}
              </div>
            </div>
            
            <div className="p-4">
              <h3 className="font-bold text-white mb-2 leading-snug line-clamp-2">{v.title}</h3>
              <p className="text-zinc-400 text-sm mb-4 line-clamp-2">{v.description}</p>
              
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5"><Eye size={14} /> {v.views || 0} مشاهدة</span>
                  <span>{new Date(v.createdAt).toLocaleDateString('ar-DZ')}</span>
                </div>
                <button className="hover:text-white transition-colors p-2 -mr-2">
                  <Share2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {videos.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
            <Tv size={48} className="text-zinc-700 mb-4" />
            <h4 className="font-bold text-zinc-400">لا توجد فيديوهات</h4>
          </div>
        )}
      </div>
    </div>
  );
}
