import re

with open("src/components/FanCommunity.tsx", "r") as f:
    content = f.read()

# Fix imports
content = content.replace("import { useState } from 'react';", "import { useState, useRef } from 'react';")
content = content.replace("Image as ImageIcon, Send, User } from 'lucide-react';", "Image as ImageIcon, Send, User, X } from 'lucide-react';")

# Replace states and handlers
old_states_and_post = """  const [newPostText, setNewPostText] = useState('');
  
  const handleLike = (postId: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          isLiked: !post.isLiked,
          likes: post.isLiked ? post.likes - 1 : post.likes + 1
        };
      }
      return post;
    }));
  };

  const handlePost = () => {
    if (!newPostText.trim()) return;
    
    const newPost: Post = {
      id: Date.now().toString(),
      author: 'أنت',
      avatar: 'Y',
      time: 'الآن',
      content: newPostText,
      likes: 0,
      comments: 0,
      isLiked: false,
    };
    
    setPosts([newPost, ...posts]);
    setNewPostText('');
  };"""

new_states_and_post = """  const [newPostText, setNewPostText] = useState('');
  const [newPostImage, setNewPostImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPostImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleLike = (postId: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          isLiked: !post.isLiked,
          likes: post.isLiked ? post.likes - 1 : post.likes + 1
        };
      }
      return post;
    }));
  };

  const handlePost = () => {
    if (!newPostText.trim() && !newPostImage) return;
    
    const newPost: Post = {
      id: Date.now().toString(),
      author: 'أنت',
      avatar: 'Y',
      time: 'الآن',
      content: newPostText,
      imageUrl: newPostImage || undefined,
      likes: 0,
      comments: 0,
      isLiked: false,
    };
    
    setPosts([newPost, ...posts]);
    setNewPostText('');
    setNewPostImage(null);
  };"""

content = content.replace(old_states_and_post, new_states_and_post)

old_ui = """            <textarea 
              value={newPostText}
              onChange={(e) => setNewPostText(e.target.value)}
              placeholder="شارك أفكارك، صور، أو مشاعرك مع المدرج..."
              className="w-full bg-transparent text-white text-sm resize-none outline-none min-h-[60px] placeholder:text-zinc-600"
            />
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-800/50">
              <button onClick={() => alert('هذه الخاصية ستتوفر قريباً!')} className="text-zinc-500 hover:text-yellow-500 transition-colors p-2 rounded-full hover:bg-zinc-800/50">
                <ImageIcon size={20} />
              </button>
              <button 
                onClick={handlePost}
                disabled={!newPostText.trim()}
                className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>نشر</span>
                <Send size={14} className="rotate-180" />
              </button>
            </div>"""

new_ui = """            <textarea 
              value={newPostText}
              onChange={(e) => setNewPostText(e.target.value)}
              placeholder="شارك أفكارك، صور، أو مشاعرك مع المدرج..."
              className="w-full bg-transparent text-white text-sm resize-none outline-none min-h-[60px] placeholder:text-zinc-600"
            />
            
            {newPostImage && (
              <div className="relative mt-2 mb-2 rounded-xl overflow-hidden border border-zinc-800 bg-black/50">
                <img src={newPostImage} alt="Preview" className="max-h-32 w-full object-cover opacity-80" />
                <button 
                  onClick={() => setNewPostImage(null)}
                  className="absolute top-2 left-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-red-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-800/50">
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
              <button 
                onClick={handlePost}
                disabled={!newPostText.trim() && !newPostImage}
                className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>نشر</span>
                <Send size={14} className="rotate-180" />
              </button>
            </div>"""

content = content.replace(old_ui, new_ui)

with open("src/components/FanCommunity.tsx", "w") as f:
    f.write(content)

