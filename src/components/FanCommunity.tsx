import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Heart, MessageSquare, Share2, Image as ImageIcon, Send, User, X, MoreVertical, Pencil, Trash2, Loader2 } from 'lucide-react';

interface Post {
  id: string;
  authorId?: string;
  author: string;
  avatar: string;
  time: string;
  content: string;
  imageUrl?: string;
  likes: number;
  comments: number;
  isLiked: boolean;
}

export default function FanCommunity() {
  const { currentUser, userData } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  // Pagination cursor (GET /posts renvoie nextCursor depuis le correctif
  // community) + notification inline (remplace l'alert() bloquant).
  const POSTS_PAGE = 30;
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const loadPosts = async (before?: string) => {
    const params = new URLSearchParams({ limit: String(POSTS_PAGE) });
    if (before) params.set('before', before);
    const res = await fetch(`/api/community/posts?${params.toString()}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`posts → ${res.status}`);
    const data = await res.json().catch(() => ({}));
    const rows = Array.isArray(data?.posts) ? data.posts : [];
    setPosts((prev) => (before ? [...prev, ...rows] : rows));
    setNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
  };

  useEffect(() => {
    loadPosts().catch((error) => console.error('[CABBA] posts:', error));
  }, []);

  const [newPostText, setNewPostText] = useState('');
  const [newPostImage, setNewPostImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        setNewPostImage(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handlePost = async () => {
    if (!currentUser) {
      // L'app entière est derrière le login, mais le composant ne doit pas
      // dépendre de cette garantie : garde locale explicite.
      setNotice('يجب تسجيل الدخول للنشر.');
      return;
    }
    if (!newPostText.trim() && !newPostImage) return;
    setIsUploading(true);
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newPostText, imageUrl: newPostImage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر نشر المنشور');
      setPosts((prev) => [data.post, ...prev]);
      setNewPostText('');
      setNewPostImage(null);
    } catch (error) {
      console.error('[CABBA] publication:', error);
      setNotice(error instanceof Error ? error.message : 'تعذر نشر المنشور');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleLike = async (postId: string) => {
    try {
      const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/like`, { method: 'POST', credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذر تحديث الإعجاب');
      setPosts((prev) => prev.map((post) => post.id === postId
        ? { ...post, likes: data.likes, isLiked: data.liked }
        : post));
    } catch (error) {
      console.error(error);
    }
  };

  // ---- Modification / suppression des publications ----
  // Retour terrain : un supporter devait pouvoir corriger son texte,
  // changer ou retirer sa photo, et supprimer son post. Auteur uniquement
  // pour la modification ; auteur OU admin pour la suppression (modération).
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editImage, setEditImage] = useState<string | null>(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const canEdit = (post: Post) => Boolean(currentUser) && post.authorId === currentUser!.id;
  const canManage = (post: Post) => canEdit(post) || userData?.role === 'admin';

  const startEdit = (post: Post) => {
    setEditingPostId(post.id);
    setEditText(post.content);
    setEditImage(post.imageUrl ?? null);
  };

  /** Même pipeline que le composer : 800 px max, JPEG 0.6, data URL. */
  const compressImageFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
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
        img.onerror = () => reject(new Error('image'));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error('lecture'));
      reader.readAsDataURL(file);
    });

  const handleEditImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permettre de resélectionner le même fichier
    if (!file) return;
    try {
      setEditImage(await compressImageFile(file));
    } catch {
      setNotice('تعذر قراءة الصورة.');
    }
  };

  const handleSaveEdit = async (postId: string) => {
    if (!editText.trim() && !editImage) {
      setNotice('المنشور لا يمكن أن يكون فارغاً.');
      return;
    }
    setBusyPostId(postId);
    try {
      const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editText, imageUrl: editImage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر تعديل المنشور');
      setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, ...data.post } : post)));
      setEditingPostId(null);
      setNotice('تم تعديل المنشور.');
    } catch (error) {
      console.error('[CABBA] édition:', error);
      setNotice(error instanceof Error ? error.message : 'تعذر تعديل المنشور');
    } finally {
      setBusyPostId(null);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!window.confirm('حذف المنشور نهائياً؟')) return;
    setBusyPostId(postId);
    try {
      const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : 'تعذر حذف المنشور');
      }
      setPosts((prev) => prev.filter((post) => post.id !== postId));
      setNotice('تم حذف المنشور.');
    } catch (error) {
      console.error('[CABBA] suppression:', error);
      setNotice(error instanceof Error ? error.message : 'تعذر حذف المنشور');
    } finally {
      setBusyPostId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950" dir="rtl">


      <div className="flex-1 overflow-y-auto hide-scrollbar pb-24">
        
          <div className="p-4 space-y-6">
            
            {/* Create Post */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm relative z-10">
              <div className="flex gap-3 mb-3">
                <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700 flex-shrink-0">
                   {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full rounded-full" /> : <User size={20} className="text-zinc-500" />}
                </div>
                <textarea 
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  placeholder="شارك أفكارك مع العائلة الصفراء..."
                  className="w-full bg-transparent border-none text-white focus:outline-none resize-none h-10 placeholder:text-zinc-600 text-sm py-2"
                />
              </div>
              
              {newPostImage && (
                <div className="relative mb-3 rounded-xl overflow-hidden border border-zinc-800">
                  <img src={newPostImage} alt="Preview" className="w-full max-h-48 object-cover" />
                  <button 
                    onClick={() => setNewPostImage(null)}
                    className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-red-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              
              <div className="flex justify-between items-center border-t border-zinc-800 pt-3">
                <div className="flex gap-2">
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleImageUpload} 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="text-zinc-500 hover:text-yellow-500 transition-colors p-2 rounded-full hover:bg-zinc-800/50"
                  >
                    <ImageIcon size={20} />
                  </button>
                </div>
                <button 
                  onClick={handlePost}
                  disabled={(!newPostText.trim() && !newPostImage) || isUploading}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{isUploading ? 'جاري النشر...' : 'نشر'}</span>
                  {!isUploading && <Send size={14} className="rotate-180" />}
                </button>
              </div>
            </div>

            {notice && (
              <div role="status" aria-live="polite" className="mb-3 p-3 rounded-xl border text-sm font-bold bg-red-500/10 border-red-500/30 text-red-400 animate-in fade-in duration-200">
                {notice}
              </div>
            )}

            {/* Posts List */}
            <div className="space-y-4">
              {posts.map(post => (
                <div key={post.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm relative z-10">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center border border-yellow-500/30">
                        {post.avatar && post.avatar !== 'U' ? (
                          <img src={post.avatar} alt={post.author} className="w-full h-full rounded-full" />
                        ) : (
                          <span className="font-bold text-yellow-500">{post.author.charAt(0)}</span>
                        )}
                      </div>
                      
                    {/* ⋮ — auteur (modifier + supprimer) ou admin (supprimer) */}
                    {canManage(post) && (
                      <div className="relative mr-auto">
                        <button
                          onClick={() => setMenuPostId(menuPostId === post.id ? null : post.id)}
                          aria-label="خيارات المنشور"
                          className="p-2 -m-1 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {menuPostId === post.id && (
                          <div className="absolute left-0 top-full mt-1 w-36 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-30 overflow-hidden">
                            {canEdit(post) && (
                              <button
                                onClick={() => { startEdit(post); setMenuPostId(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
                              >
                                <Pencil size={14} /> تعديل
                              </button>
                            )}
                            <button
                              onClick={() => { setMenuPostId(null); void handleDelete(post.id); }}
                              disabled={busyPostId === post.id}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            >
                              {busyPostId === post.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} حذف
                            </button>
                          </div>
                        )}
                      </div>
                    )}<div>
                        <h4 className="font-bold text-white text-sm">{post.author}</h4>
                        <p className="text-[10px] text-zinc-500">{post.time}</p>
                      </div>
                    </div>
                  </div>
                  {editingPostId === post.id ? (
                    <div className="mb-3">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        maxLength={5000}
                        aria-label="تعديل النص"
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-yellow-500 resize-none"
                      />
                      {editImage && (
                        <div className="relative mt-2 rounded-xl overflow-hidden border border-zinc-800">
                          <img src={editImage} alt="معاينة" className="w-full max-h-48 object-cover" />
                          <button
                            onClick={() => setEditImage(null)}
                            aria-label="إزالة الصورة"
                            className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full hover:bg-red-500 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <input ref={editFileRef} type="file" accept="image/*" className="hidden" onChange={handleEditImage} />
                        <button
                          onClick={() => editFileRef.current?.click()}
                          className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800 hover:text-yellow-500 px-3 py-2 rounded-lg transition-colors"
                        >
                          <ImageIcon size={14} /> {editImage ? 'تغيير الصورة' : 'إضافة صورة'}
                        </button>
                        <div className="flex-1" />
                        <button
                          onClick={() => setEditingPostId(null)}
                          disabled={busyPostId === post.id}
                          className="text-xs text-zinc-400 hover:text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                          إلغاء
                        </button>
                        <button
                          onClick={() => void handleSaveEdit(post.id)}
                          disabled={busyPostId === post.id}
                          className="flex items-center gap-1.5 text-xs font-bold bg-yellow-500 text-black hover:bg-yellow-400 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {busyPostId === post.id && <Loader2 size={12} className="animate-spin" />}
                          حفظ
                        </button>
                      </div>
                    </div>
                  ) : (
                  <p className="text-zinc-300 text-sm mb-3 leading-relaxed">
                    {post.content}
                  </p>
                  )}
                  
                  {editingPostId !== post.id && post.imageUrl && (
                    <div className="rounded-xl overflow-hidden mb-3 border border-zinc-800 max-h-64">
                      <img src={post.imageUrl} alt="Post media" className="w-full h-full object-cover" />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-6 border-t border-zinc-800 pt-3 mt-2">
                    <button 
                      onClick={() => toggleLike(post.id)}
                      className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${post.isLiked ? 'text-red-500' : 'text-zinc-500 hover:text-red-400'}`}
                    >
                      <Heart size={16} className={post.isLiked ? 'fill-current' : ''} />
                      <span>{post.likes}</span>
                    </button>
                    <button className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-white transition-colors">
                      <MessageSquare size={16} />
                      <span>{post.comments}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination : curseur created_at fourni par le serveur — le fil
                ne charge plus toute la table d'un coup. */}
            {nextCursor && (
              <button
                onClick={async () => {
                  setLoadingMore(true);
                  try {
                    await loadPosts(nextCursor);
                  } catch (error) {
                    console.error('[CABBA] posts (suite):', error);
                    setNotice('تعذر تحميل المزيد.');
                  } finally {
                    setLoadingMore(false);
                  }
                }}
                disabled={loadingMore}
                className="w-full mt-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm font-bold hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'جاري التحميل...' : 'تحميل المزيد'}
              </button>
            )}
          </div>
      </div>
    </div>
  );
}
