import re

with open("src/components/FanCommunity.tsx", "r") as f:
    content = f.read()

# 1. Add imports
import_search = "import { useState, useRef } from 'react';"
import_replace = "import { useState, useRef, useEffect } from 'react';\nimport { readJSON, writeJSON } from '../lib/storage';"
content = content.replace(import_search, import_replace)

# 2. Extract initial posts to a constant and use localStorage
state_search = """  const [posts, setPosts] = useState<Post[]>([
    {
      id: '1',
      author: 'أحمد الكاباوي',
      avatar: 'A',
      time: 'قبل ساعتين',
      content: 'أجواء رائعة اليوم في المدرجات! الفريق قدم أداء خرافي، النقاط الثلاث هي الأهم. الجراد الأصفر دائماً في الموعد 💛🖤',
      likes: 124,
      comments: 18,
      isLiked: false,
    },
    {
      id: '2',
      author: 'رياض 34',
      avatar: 'R',
      time: 'قبل 4 ساعات',
      content: 'صور من دخلة اليوم.. الإبداع مستمر!',
      imageUrl: 'https://images.unsplash.com/photo-1508344928928-7137b29de216?auto=format&fit=crop&q=80&w=800&h=400',
      likes: 342,
      comments: 45,
      isLiked: true,
    },
    {
      id: '3',
      author: 'وليد BBA',
      avatar: 'W',
      time: 'قبل 5 ساعات',
      content: 'من هو رجل المباراة برأيكم؟ بالنسبة لي الحارس كان سداً منيعاً.',
      likes: 89,
      comments: 112,
      isLiked: false,
    }
  ]);"""

state_replace = """  const DEFAULT_POSTS: Post[] = [
    {
      id: '1',
      author: 'أحمد الكاباوي',
      avatar: 'A',
      time: 'قبل ساعتين',
      content: 'أجواء رائعة اليوم في المدرجات! الفريق قدم أداء خرافي، النقاط الثلاث هي الأهم. الجراد الأصفر دائماً في الموعد 💛🖤',
      likes: 124,
      comments: 18,
      isLiked: false,
    },
    {
      id: '2',
      author: 'رياض 34',
      avatar: 'R',
      time: 'قبل 4 ساعات',
      content: 'صور من دخلة اليوم.. الإبداع مستمر!',
      imageUrl: 'https://images.unsplash.com/photo-1508344928928-7137b29de216?auto=format&fit=crop&q=80&w=800&h=400',
      likes: 342,
      comments: 45,
      isLiked: true,
    },
    {
      id: '3',
      author: 'وليد BBA',
      avatar: 'W',
      time: 'قبل 5 ساعات',
      content: 'من هو رجل المباراة برأيكم؟ بالنسبة لي الحارس كان سداً منيعاً.',
      likes: 89,
      comments: 112,
      isLiked: false,
    }
  ];

  const [posts, setPosts] = useState<Post[]>(() => {
    return readJSON('cabba-community-posts', DEFAULT_POSTS);
  });

  useEffect(() => {
    writeJSON('cabba-community-posts', posts);
  }, [posts]);"""

content = content.replace(state_search, state_replace)

with open("src/components/FanCommunity.tsx", "w") as f:
    f.write(content)

