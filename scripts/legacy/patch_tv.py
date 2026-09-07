import re

with open("src/components/CabbaTv.tsx", "r") as f:
    content = f.read()

import_search = "import { Play, Eye, Clock, Search, Filter } from 'lucide-react';"
import_replace = "import { Play, Eye, Clock, Search, Filter } from 'lucide-react';\nimport { useState, useEffect } from 'react';\nimport { collection, query, orderBy, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';\nimport { db } from '../lib/firebase';\nimport { Video } from './admin/AdminVideos';"
content = content.replace(import_search, import_replace)

body_search = """export default function CabbaTv() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');"""
  
body_replace = """export default function CabbaTv() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState<Video[]>([]);
  
  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    const un = onSnapshot(q, (snapshot) => {
      const data: Video[] = [];
      snapshot.forEach(doc => {
        const v = { id: doc.id, ...doc.data() } as Video;
        if (v.published) data.push(v);
      });
      setVideos(data);
    });
    return () => un();
  }, []);

  const handlePlay = async (v: Video) => {
    window.open(v.videoUrl, '_blank');
    try {
      await updateDoc(doc(db, 'videos', v.id), { views: increment(1) });
    } catch(e) {}
  };
"""
content = content.replace(body_search, body_replace)

ui_search = """        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden group">
              <div className="relative h-48 bg-zinc-800">
                <img 
                  src={`https://images.unsplash.com/photo-1574629810360-7efbb4b2fac0?w=800&h=400&fit=crop&q=80&${i}`}
                  alt="Video Thumbnail"
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 bg-yellow-500/90 text-black rounded-full flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform cursor-pointer shadow-[0_0_20px_rgba(234,179,8,0.4)]">
                    <Play size={24} className="fill-current ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 bg-black/80 text-white text-xs font-bold px-2 py-1 rounded-md backdrop-blur-sm">
                  05:24
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-white text-sm mb-2 group-hover:text-yellow-500 transition-colors line-clamp-2">
                  كواليس تحضيرات الفريق للمباراة القادمة ومقابلات حصرية
                </h3>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <div className="flex items-center gap-1">
                    <Eye size={14} />
                    <span>2.4K</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    <span>منذ 3 ساعات</span>
                  </div>
                  <div className="bg-zinc-800 px-2 py-1 rounded text-zinc-400 mr-auto">
                    كواليس
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>"""

ui_replace = """        <div className="space-y-4">
          {videos
            .filter(v => activeCategory === 'all' || v.category === activeCategory)
            .filter(v => v.title.includes(searchQuery) || v.description.includes(searchQuery))
            .map(v => (
            <div key={v.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden group">
              <div className="relative h-48 bg-zinc-800" onClick={() => handlePlay(v)}>
                <img 
                  src={v.thumbnail || `https://images.unsplash.com/photo-1574629810360-7efbb4b2fac0?w=800&h=400&fit=crop&q=80&${v.id}`}
                  alt={v.title}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-14 h-14 bg-yellow-500/90 text-black rounded-full flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(234,179,8,0.4)]">
                    <Play size={24} className="fill-current ml-1" />
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-white text-sm mb-2 group-hover:text-yellow-500 transition-colors line-clamp-2 cursor-pointer" onClick={() => handlePlay(v)}>
                  {v.title}
                </h3>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <div className="flex items-center gap-1">
                    <Eye size={14} />
                    <span>{v.views}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    <span>جديد</span>
                  </div>
                  <div className="bg-zinc-800 px-2 py-1 rounded text-zinc-400 mr-auto">
                    {v.category}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {videos.length === 0 && <p className="text-center text-zinc-500 text-sm">لا توجد فيديوهات</p>}
        </div>"""
content = content.replace(ui_search, ui_replace)

with open("src/components/CabbaTv.tsx", "w") as f:
    f.write(content)

