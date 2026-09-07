import { useState, useEffect } from 'react';
import { Trash2, Edit2, ChevronRight, Save, X } from 'lucide-react';
import MediaUploader from '../MediaUploader';

export interface Chant {
  id: string;
  title: string;
  lyrics: string;
  audioUrl: string;
  imageUrl?: string;
  category: string;
  views: number;
  createdAt: number;
}

export default function AdminChants({ onBack }: { onBack: () => void }) {
  const [chants, setChants] = useState<Chant[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState('أهازيج قديمة');

  const fetchChants = async () => {
    try {
      const res = await fetch('/api/chants');
      if (res.ok) {
        const data = await res.json();
        setChants(data.chants);
      }
    } catch (error) {
      console.error('Error fetching chants', error);
    }
  };

  useEffect(() => {
    fetchChants();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !lyrics.trim() || !audioUrl.trim()) return;
    setLoading(true);
    
    try {
      if (isEditing) {
        const res = await fetch(`/api/chants/${isEditing}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, lyrics, audioUrl, imageUrl: imageUrl || null, category })
        });
        if (res.ok) fetchChants();
      } else {
        const res = await fetch('/api/chants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, lyrics, audioUrl, imageUrl: imageUrl || null, category })
        });
        if (res.ok) fetchChants();
      }
      resetForm();
    } catch (error) {
      console.error(error);
      alert('خطأ في الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (c: Chant) => {
    setIsEditing(c.id);
    setTitle(c.title);
    setLyrics(c.lyrics);
    setAudioUrl(c.audioUrl);
    setImageUrl(c.imageUrl || '');
    setCategory(c.category);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('حذف الأهزوجة؟')) return;
    try {
      const res = await fetch(`/api/chants/${id}`, { method: 'DELETE' });
      if (res.ok) fetchChants();
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setIsEditing(null);
    setTitle('');
    setLyrics('');
    setAudioUrl('');
    setImageUrl('');
    setCategory('أهازيج قديمة');
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <button onClick={onBack} className="flex items-center gap-2 text-yellow-500 text-sm font-bold mb-4">
        <ChevronRight size={16} /> العودة
      </button>

      <div className="mb-6 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
        <h3 className="font-bold text-white mb-4">{isEditing ? 'تعديل الأهزوجة' : 'إضافة أهزوجة'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" placeholder="عنوان الأهزوجة" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white" required />
          <textarea placeholder="الكلمات" value={lyrics} onChange={e => setLyrics(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white h-24" required />
          <input type="url" placeholder="رابط الملف الصوتي (مطلوب)" value={audioUrl} onChange={e => setAudioUrl(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white" required />
          <input type="url" placeholder="رابط صورة الغلاف (اختياري)" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white" />
          
          <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white">
            <option value="أهازيج الكورفا">أهازيج الكورفا</option>
            <option value="أهازيج قديمة">أهازيج قديمة</option>
            <option value="أغاني استوديو">أغاني استوديو</option>
          </select>

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
        {chants.map(c => (
          <div key={c.id} className="p-3 bg-zinc-800/30 rounded-xl border border-zinc-800 flex justify-between items-center">
            <div>
              <h4 className="font-bold text-white text-sm">{c.title}</h4>
              <p className="text-xs text-zinc-500">{c.category}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleEdit(c)} className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Edit2 size={16} /></button>
              <button onClick={() => handleDelete(c.id)} className="p-2 bg-red-500/10 text-red-500 rounded-lg"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {chants.length === 0 && <p className="text-center text-zinc-500 text-sm">لا توجد أهازيج</p>}
      </div>
    </div>
  );
}
