import re

with open("src/components/FanCommunity.tsx", "r") as f:
    content = f.read()

import_search = "import { db } from '../lib/firebase';"
import_replace = "import { db } from '../lib/firebase';\nimport { useAuth } from '../contexts/AuthContext';"
content = content.replace(import_search, import_replace)

body_search = """export default function FanCommunity() {
  const [posts, setPosts] = useState<Post[]>([]);"""

body_replace = """export default function FanCommunity() {
  const { currentUser, userData } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);"""
content = content.replace(body_search, body_replace)

post_search = """      await addDoc(collection(db, 'posts'), {
        author: 'أنت',
        avatar: 'Y',
        time: 'الآن',
        content: newPostText,
        imageUrl: newPostImage || null,
        likes: 0,
        comments: 0,
        createdAt: Date.now()
      });"""

post_replace = """      await addDoc(collection(db, 'posts'), {
        author: userData?.displayName || 'مشجع',
        authorId: currentUser?.uid,
        avatar: userData?.displayName?.charAt(0) || 'م',
        time: 'الآن',
        content: newPostText,
        imageUrl: newPostImage || null,
        likes: 0,
        comments: 0,
        createdAt: Date.now()
      });"""
content = content.replace(post_search, post_replace)

filter_search = "      if (activeFilter === 'my') return post.author === 'أنت';"
filter_replace = "      if (activeFilter === 'my') return post.authorId === currentUser?.uid || post.author === 'أنت';"
content = content.replace(filter_search, filter_replace)

# Also update the interface Post
interface_search = """interface Post {
  id: string;
  author: string;"""
interface_replace = """interface Post {
  id: string;
  authorId?: string;
  author: string;"""
content = content.replace(interface_search, interface_replace)

# Also need to read authorId from firestore snapshot
snapshot_search = """          id: doc.id,
          author: data.author || 'مجهول',"""
snapshot_replace = """          id: doc.id,
          authorId: data.authorId,
          author: data.author || 'مجهول',"""
content = content.replace(snapshot_search, snapshot_replace)

with open("src/components/FanCommunity.tsx", "w") as f:
    f.write(content)

