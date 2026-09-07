import { query, pool } from './server/db/index.js';

const DEFAULT_POSTS = [
  {
    authorName: 'أحمد الكاباوي',
    content: 'أجواء رائعة اليوم في المدرجات! الفريق قدم أداء خرافي، النقاط الثلاث هي الأهم. الجراد الأصفر دائماً في الموعد 💛🖤',
    imageUrl: null,
  },
  {
    authorName: 'رياض 34',
    content: 'صور من دخلة اليوم.. الإبداع مستمر!',
    imageUrl: 'https://images.unsplash.com/photo-1508344928928-7137b29de216?auto=format&fit=crop&q=80&w=800&h=400',
  },
  {
    authorName: 'وليد BBA',
    content: 'من هو رجل المباراة برأيكم؟ بالنسبة لي الحارس كان سداً منيعاً.',
    imageUrl: null,
  },
];

async function seed(): Promise<void> {
  try {
    const users = await query('SELECT id, display_name FROM users ORDER BY created_at ASC LIMIT 1');
    if (!users.rows.length) {
      console.log('No users yet; create an account before seeding community posts.');
      return;
    }
    const authorId = users.rows[0].id;
    const existing = await query('SELECT 1 FROM posts LIMIT 1');
    if (existing.rows.length) {
      console.log('Database already has posts.');
      return;
    }
    for (const post of DEFAULT_POSTS) {
      await query(
        'INSERT INTO posts (author_id, content, image_url) VALUES ($1,$2,$3)',
        [authorId, post.content, post.imageUrl],
      );
    }
    console.log('Seeded PostgreSQL community posts.');
  } finally {
    await pool.end();
  }
}

seed().catch((error) => {
  console.error('[CABBA] Seed failed:', error);
  process.exitCode = 1;
});
