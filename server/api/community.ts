import { Router } from 'express';
import { query, pool } from '../db/index.js';
import { requireAuth } from '../auth.js';
import { createRateLimiter } from '../rateLimit.js';

/** Avatar de repli LOCAL (data-URI aux couleurs du club) : l'ancien repli
 *  dicebear.com exposait l'IP de chaque visiteur du fil à un serveur tiers.
 *  img-src data: est autorisé par la CSP. */
const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#27272a"/><text x="32" y="43" font-family="system-ui,sans-serif" font-size="30" font-weight="800" fill="#eab308" text-anchor="middle">C</text></svg>`,
  );

/** 5 publications/minute/compte : le limiteur global (120/min) ne protège
 *  pas du spam de fil par un compte compromis ou malveillant. */
const postRateLimit = createRateLimiter({
  windowMs: 60_000,
  limit: 5,
  message: 'منشورات كثيرة في وقت قصير. حاول بعد دقيقة.',
  keyPrefix: 'community-post',
  keyFn: (req) => req.user?.id ?? req.ip ?? 'unknown',
});

export const communityRouter = Router();

const mapPost = (row: any) => ({
  id: row.id,
  authorId: row.author_id,
  author: row.display_name || 'مشجع البرج',
  avatar: row.avatar_url || DEFAULT_AVATAR,
  time: new Date(row.created_at).toLocaleString('ar-DZ'),
  content: row.content,
  imageUrl: row.image_url || undefined,
  likes: Number(row.likes_count),
  comments: Number(row.comments_count),
  isLiked: Boolean(row.is_liked),
});

communityRouter.get('/posts', requireAuth, async (req, res) => {
  try {
    // Pagination par cursor (created_at) : l'ancien SELECT renvoyait TOUTE la
    // table avec deux sous-requêtes corrélées par ligne — O(n) croissant sur
    // un fil communautaire. Page de 30, borne haute 50.
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 50);
    const beforeRaw = typeof req.query.before === 'string' ? req.query.before : null;
    // Date invalide → curseur ignoré (première page), jamais d'erreur de cast
    // timestamptz qui remonterait en 500.
    const before = beforeRaw && !Number.isNaN(Date.parse(beforeRaw)) ? beforeRaw : null;

    const result = await query(
      `SELECT p.*, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) AS likes_count,
        (SELECT COUNT(*) FROM post_comments c WHERE c.post_id=p.id) AS comments_count,
        EXISTS(SELECT 1 FROM post_likes l2 WHERE l2.post_id=p.id AND l2.user_id=$1) AS is_liked
       FROM posts p JOIN users u ON u.id=p.author_id
       WHERE ($2::timestamptz IS NULL OR p.created_at < $2::timestamptz)
       ORDER BY p.created_at DESC
       LIMIT $3`,
      [req.user!.id, before, limit],
    );

    const rows = result.rows;
    // Page pleine → il reste peut-être des posts : le curseur est le
    // created_at de la dernière ligne. Page partielle → fin du fil.
    const nextCursor =
      rows.length === limit
        ? new Date(rows[rows.length - 1].created_at).toISOString()
        : null;

    res.json({ posts: rows.map(mapPost), nextCursor });
  } catch (error) {
    console.error('[CABBA] posts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

communityRouter.post('/posts', requireAuth, postRateLimit, async (req, res) => {
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
