import { Router } from 'express';
import { query, pool } from '../db/index.js';
import { requireAuth } from '../auth.js';

export const communityRouter = Router();

const mapPost = (row: any) => ({
  id: row.id,
  authorId: row.author_id,
  author: row.display_name || 'مشجع البرج',
  avatar: row.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(row.display_name || 'cabba')}&backgroundColor=f59e0b`,
  time: new Date(row.created_at).toLocaleString('ar-DZ'),
  content: row.content,
  imageUrl: row.image_url || undefined,
  likes: Number(row.likes_count),
  comments: Number(row.comments_count),
  isLiked: Boolean(row.is_liked),
});

communityRouter.get('/posts', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) AS likes_count,
        (SELECT COUNT(*) FROM post_comments c WHERE c.post_id=p.id) AS comments_count,
        EXISTS(SELECT 1 FROM post_likes l2 WHERE l2.post_id=p.id AND l2.user_id=$1) AS is_liked
       FROM posts p JOIN users u ON u.id=p.author_id
       ORDER BY p.created_at DESC`,
      [req.user!.id],
    );
    res.json({ posts: result.rows.map(mapPost) });
  } catch (error) {
    console.error('[CABBA] posts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

communityRouter.post('/posts', requireAuth, async (req, res) => {
  const { content, imageUrl = null } = req.body ?? {};
  if (typeof content !== 'string' || typeof imageUrl !== 'string' && imageUrl !== null) {
    res.status(400).json({ error: 'Invalid post data' }); return;
  }
  const cleanContent = content.trim();
  if (!cleanContent && !imageUrl) { res.status(400).json({ error: 'Post cannot be empty' }); return; }
  if (cleanContent.length > 5000) { res.status(400).json({ error: 'Post is too long' }); return; }
  if (typeof imageUrl === 'string' && imageUrl.length > 500_000) { res.status(400).json({ error: 'Image is too large' }); return; }

  try {
    const result = await query(
      `INSERT INTO posts (author_id,content,image_url) VALUES ($1,$2,$3) RETURNING *`,
      [req.user!.id, cleanContent, imageUrl],
    );
    const hydrated = await query(
      `SELECT p.*, u.display_name, u.avatar_url,
        0::bigint AS likes_count, 0::bigint AS comments_count, false AS is_liked
       FROM posts p JOIN users u ON u.id=p.author_id WHERE p.id=$1`, [result.rows[0].id],
    );
    res.status(201).json({ post: mapPost(hydrated.rows[0]) });
  } catch (error) {
    console.error('[CABBA] create post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

communityRouter.post('/posts/:id/like', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      'SELECT 1 FROM post_likes WHERE post_id=$1 AND user_id=$2 FOR UPDATE',
      [req.params.id, req.user!.id],
    );
    let liked: boolean;
    if (existing.rows.length) {
      await client.query('DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2', [req.params.id, req.user!.id]);
      liked = false;
    } else {
      await client.query('INSERT INTO post_likes (post_id,user_id) VALUES ($1,$2)', [req.params.id, req.user!.id]);
      liked = true;
    }
    const count = await client.query('SELECT COUNT(*)::int AS count FROM post_likes WHERE post_id=$1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ liked, likes: count.rows[0].count });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[CABBA] like:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});
