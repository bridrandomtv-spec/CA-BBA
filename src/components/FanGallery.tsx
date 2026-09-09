// عدسة الجماهير — galerie PERSISTÉE.
//
// Findings corrigés :
//  1. Les photos uploadées vers R2 vivaient dans un useState LOCAL : un
//     rechargement vidait la galerie pendant que les octets restaient
//     orphelins dans le bucket. Publications via /api/gallery (migration 013).
//  2. `alert()` bloquant → notification inline (même correctif que Store).
//  3. Upvotes purement cosmétiques (état local, décrément possible en
//     négatif) → likes serveur idempotents avec compteur exact.
//  4. Pré-contrôle de taille 10 Mo aligné sur la limite serveur avant
//     d'entamer l'upload.
import { useEffect, useState } from 'react';
import { Camera, Heart, Upload, Loader2, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { uploadMedia } from '../lib/mediaUpload';

/** Aligné sur la limite image côté serveur (media.ts). */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

interface GalleryPost {
  id: string;
  authorId: string;
  author: string;
  avatar: string;
  imageUrl: string | null;
  caption: string;
  likes: number;
  isLiked: boolean;
  createdAt: string;
}

/**
 * Repli sans R2 : compresse l'image en data-URL (800 px max, JPEG 0.6) —
 * exactement le pipeline de la communauté. Le serveur borne à 500 Ko.
 */
function compressToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIMENSION = 800;
        if (width > height && width > MAX_DIMENSION) {
          height *= MAX_DIMENSION / width;
          width = MAX_DIMENSION;
        } else if (height > MAX_DIMENSION) {
          width *= MAX_DIMENSION / height;
          height = MAX_DIMENSION;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = () => reject(new Error('تعذر قراءة الصورة'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    reader.readAsDataURL(file);
  });
}

export default function FanGallery() {
  const { currentUser: user, userData } = useAuth();
  // null = chargement en cours ; [] = synchronisé et vide.
  const [posts, setPosts] = useState<GalleryPost[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/gallery/posts', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`gallery → ${res.status}`))))
      .then((data) => {
        if (!cancelled) setPosts(Array.isArray(data?.posts) ? data.posts : []);
      })
      .catch((error) => {
        console.error('[CABBA] gallery:', error);
        if (!cancelled) setPosts([]);
      });
    return () => { cancelled = true; };
  }, []);

  const handleGalleryUpload = async (file?: File) => {
    if (!file || !user) return;

    if (file.size > MAX_IMAGE_BYTES) {
      setNotice('حجم الصورة يتجاوز الحد المسموح (10 ميغابايت).');
      return;
    }

    setUploading(true);
    try {
      // Voie normale : flux R2 (presign → PUT → complete). Si le stockage
      // R2 n'est pas configuré (démo, installation minimale), repli
      // AUTOMATIQUE en data-URL compressée — la galerie reste utilisable
      // au lieu d'afficher « Media storage is not configured ».
      let payload: Record<string, unknown>;
      try {
        const media = await uploadMedia(file, 'fan-gallery');
        payload = { mediaId: media.id };
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : '';
        if (!message.includes('Media storage is not configured')) throw uploadError;
        const dataUrl = await compressToDataUrl(file);
        if (dataUrl.length > 500_000) {
          throw new Error('الصورة كبيرة جداً حتى بعد الضغط. اختر صورة أصغر.');
        }
        payload = { imageData: dataUrl };
      }

      const res = await fetch('/api/gallery/posts', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'فشل نشر الصورة');
      setPosts((prev) => [data.post as GalleryPost, ...(prev ?? [])]);
    } catch (error) {
      console.error('[CABBA] gallery upload:', error);
      setNotice(error instanceof Error ? error.message : 'فشل رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      const res = await fetch(`/api/gallery/posts/${encodeURIComponent(postId)}/like`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`like → ${res.status}`);
      const data = await res.json();
      setPosts((prev) =>
        (prev ?? []).map((post) =>
          post.id === postId ? { ...post, isLiked: Boolean(data.liked), likes: Number(data.likes) } : post,
        ),
      );
    } catch (error) {
      console.error('[CABBA] gallery like:', error);
      setNotice('تعذر تحديث الإعجاب.');
    }
  };

  const handleDelete = async (postId: string) => {
    try {
      const res = await fetch(`/api/gallery/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`delete → ${res.status}`);
      setPosts((prev) => (prev ?? []).filter((post) => post.id !== postId));
    } catch (error) {
      console.error('[CABBA] gallery delete:', error);
      setNotice('تعذر حذف الصورة.');
    }
  };

  const canDelete = (post: GalleryPost) =>
    user != null && (post.authorId === user.id || userData?.role === 'admin');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
            <Camera size={16} />
          </div>
          <h3 className="font-bold text-white text-lg">عدسة الجماهير</h3>
          {user && (
            <label className="mr-auto cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500 text-black text-xs font-bold">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              إضافة صورة
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={uploading}
                onChange={(e) => void handleGalleryUpload(e.target.files?.[0])}
              />
            </label>
          )}
        </div>
      </div>

      {notice && (
        <div role="status" aria-live="polite" className="p-3 rounded-xl border text-sm font-bold bg-red-500/10 border-red-500/30 text-red-400 animate-in fade-in duration-200">
          {notice}
        </div>
      )}

      <div className="space-y-4">
        {posts === null ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 flex justify-center">
            <Loader2 size={24} className="animate-spin text-yellow-500" />
          </div>
        ) : posts.length > 0 ? posts.map((post) => (
          <div key={post.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-3 flex items-center justify-between border-b border-zinc-800/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white">
                  {post.avatar}
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">{post.author}</h4>
                  <span className="text-[10px] text-zinc-500">
                    {new Date(post.createdAt).toLocaleDateString('ar-DZ')}
                  </span>
                </div>
              </div>
              {canDelete(post) && (
                <button
                  onClick={() => void handleDelete(post.id)}
                  aria-label="حذف الصورة"
                  className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="relative aspect-square w-full bg-zinc-800">
              {post.imageUrl && (
                <img src={post.imageUrl} alt={post.caption} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              )}
            </div>

            <div className="p-4">
              <div className="flex items-center gap-4 mb-3">
                <button
                  onClick={() => void handleLike(post.id)}
                  aria-pressed={post.isLiked}
                  className={`flex items-center gap-1.5 text-sm font-bold transition-colors ${
                    post.isLiked ? 'text-red-500' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Heart size={20} className={post.isLiked ? 'fill-red-500' : ''} />
                  <span>{post.likes}</span>
                </button>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">
                <span className="font-bold text-white ml-2">{post.author}</span>
                {post.caption}
              </p>
            </div>
          </div>
        )) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <ImageIcon size={48} className="text-zinc-700 mb-4" />
            <h4 className="font-bold text-zinc-400">لا توجد صور حالياً</h4>
            <p className="text-xs text-zinc-500 mt-2">كن أول من يشارك صورة للجراد الأصفر!</p>
          </div>
        )}
      </div>
    </div>
  );
}
