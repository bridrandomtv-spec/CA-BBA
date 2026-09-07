import { useState, useEffect } from 'react';
import { Trash2, Edit2, ChevronRight, Save, X } from 'lucide-react';
import { NewsItem } from '../../types';

export default function AdminNews({ onBack }: { onBack: () => void }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchNews = async () => {
    try {
      const res = await fetch('/api/news');
      if (res.ok) {
        const data = await res.json();
        setNews(data.news);
      }
    } catch (error) {
      console.error('Error fetching news', error);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setLoading(true);
    
    try {
      if (isEditing) {
        const res = await fetch(`/api/news/${isEditing}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content, imageUrl: imageUrl || null })
        });
        if (res.ok) {
          fetchNews();
        } else {
          alert('خطأ في التعديل');
        }
      } else {
        const res = await fetch('/api/news', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content, imageUrl: imageUrl || null })
        });
        if (res.ok) {
          fetchNews();
        } else {
          alert('خطأ في الحفظ');
        }
      }
      resetForm();
    } catch (error) {
      console.error(error);
      alert('خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: NewsItem) => {
    setIsEditing(item.id);
    setTitle(item.title);
    setContent(item.content);
    setImageUrl(item.imageUrl || '');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الخبر؟')) return;
    try {
      const res = await fetch(`/api/news/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchNews();
      } else {
        alert('خطأ في الحذف');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setIsEditing(null);
    setTitle('');
    setContent('');
    setImageUrl('');
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <button onClick={onBack} className="flex items-center gap-2 text-yellow-500 text-sm font-bold mb-4">
        <ChevronRight size={16} /> العودة للقائمة
      </button>

      {/* Form */}
      <div className="mb-6 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
        <h3 className="font-bold text-white mb-4">{isEditing ? 'تعديل الخبر' : 'إضافة خبر جديد'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" placeholder="عنوان الخبر" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white" required />
          <textarea placeholder="محتوى الخبر" value={content} onChange={e => setContent(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white h-24" required />
          <input type="url" placeholder="رابط الصورة (اختياري)" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white" />
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="flex-1 bg-yellow-500 text-black font-bold py-2 rounded-lg flex items-center justify-center gap-2">
              <Save size={16} /> {loading ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            {isEditing && (
              <button type="button" onClick={resetForm} className="px-4 bg-zinc-700 text-white rounded-lg"><X size={16} /></button>
            )}
          </div>
        </form>
      </div>

      {/* List */}
      <div className="space-y-3">
        {news.map(item => (
          <div key={item.id} className="p-3 bg-zinc-800/30 rounded-xl border border-zinc-800 flex justify-between items-center">
            <div>
              <h4 className="font-bold text-white text-sm">{item.title}</h4>
              <p className="text-xs text-zinc-500">{item.date}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleEdit(item)} className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Edit2 size={16} /></button>
              <button onClick={() => handleDelete(item.id)} className="p-2 bg-red-500/10 text-red-500 rounded-lg"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {news.length === 0 && <p className="text-center text-zinc-500 text-sm py-4">لا توجد أخبار حالياً</p>}
      </div>
    </div>
  );
}
