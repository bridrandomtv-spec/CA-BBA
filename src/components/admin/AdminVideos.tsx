import { useState, useEffect } from 'react';
import { Trash2, Edit2, ChevronRight, Save, X } from 'lucide-react';
import MediaUploader from '../MediaUploader';

export interface Video {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnail?: string;
  category: string;
  views: number;
  published: boolean;
  createdAt: number;
}

export default function AdminVideos({ onBack }: { onBack: () => void }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [category, setCategory] = useState('ملخصات');
  const [published, setPublished] = useState(true);

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/videos');
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos);
      }
    } catch (error) {
      console.error('Error fetching videos', error);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !videoUrl.trim()) return;
    setLoading(true);
    
    try {
      if (isEditing) {
        const res = await fetch(`/api/videos/${isEditing}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, videoUrl, thumbnail: thumbnail || null, category, published })
        });
        if (res.ok) fetchVideos();
      } else {
        const res = await fetch('/api/videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, videoUrl, thumbnail: thumbnail || null, category, published })
        });
        if (res.ok) fetchVideos();
      }
      resetForm();
    } catch (error) {
      console.error(error);
      alert('خطأ في الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (v: Video) => {
    setIsEditing(v.id);
    setTitle(v.title);
    setDescription(v.description);
    setVideoUrl(v.videoUrl);
    setThumbnail(v.thumbnail || '');
    setCategory(v.category);
    setPublished(v.published);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('حذف الفيديو؟')) return;
    try {
      const res = await fetch(`/api/videos/${id}`, { method: 'DELETE' });
      if (res.ok) fetchVideos();
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setIsEditing(null);
    setTitle('');
    setDescription('');
    setVideoUrl('');
    setThumbnail('');
    setCategory('ملخصات');
    setPublished(true);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <button onClick={onBack} className="flex items-center gap-2 text-yellow-500 text-sm font-bold mb-4">
        <ChevronRight size={16} /> العودة
      </button>

      <div className="mb-6 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
        <h3 className="font-bold text-white mb-4">{isEditing ? 'تعديل الفيديو' : 'إضافة فيديو'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" placeholder="عنوان الفيديو" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white" required />
          <textarea placeholder="الوصف" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white h-24" />
          <MediaUploader label="الفيديو" value={videoUrl} onChange={(url) => setVideoUrl(url)} onClear={() => setVideoUrl('')} accept="video/mp4,video/webm" folder="videos" preview="video" required hint="يمكنك رفع MP4/WebM إلى R2 أو استعمال رابط YouTube خارجي." />
          <MediaUploader label="الصورة المصغرة" value={thumbnail} onChange={(url) => setThumbnail(url)} onClear={() => setThumbnail('')} accept="image/jpeg,image/png,image/webp,image/gif" folder="video-thumbnails" preview="image" hint="اختياري — JPG, PNG, WebP ou GIF." />
          
          <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white">
            <option value="ملخصات">ملخصات المباريات</option>
            <option value="كواليس">كواليس وتدريبات</option>
            <option value="تصريحات">تصريحات</option>
            <option value="أخرى">أخرى</option>
          </select>

          <label className="flex items-center gap-2 text-white text-sm">
            <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} className="accent-yellow-500" />
            نشر الفيديو فوراً
          </label>

          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="flex-1 bg-yellow-500 text-black font-bold py-2 rounded-lg flex items-center justify-center gap-2">
              <Save size={16} /> حفظ
            </button>
            {isEditing && (
              <button type="button" onClick={resetForm} className="px-4 bg-zinc-700 text-white rounded-lg"><X size={16} /></button>
            )}
          </div>
        </form>
      </div>

      <div className="space-y-3">
        {videos.map(v => (
          <div key={v.id} className="p-3 bg-zinc-800/30 rounded-xl border border-zinc-800 flex justify-between items-center">
            <div>
              <h4 className="font-bold text-white text-sm">{v.title}</h4>
              <p className="text-xs text-zinc-500">{v.category} • {v.views || 0} مشاهدة</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleEdit(v)} className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Edit2 size={16} /></button>
              <button onClick={() => handleDelete(v.id)} className="p-2 bg-red-500/10 text-red-500 rounded-lg"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {videos.length === 0 && <p className="text-center text-zinc-500 text-sm">لا توجد فيديوهات</p>}
      </div>
    </div>
  );
}
