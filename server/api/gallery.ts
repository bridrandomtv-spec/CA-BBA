// Persistance de « عدسة الجماهير ».
// Flux : le client upload via /api/media (presign R2 → PUT → complete), puis
// publie ici avec le mediaId. Le serveur ne fait JAMAIS confiance à une URL
// fournie par le client : il relit l'object_key du media_asset (propriété
// vérifiée) et reconstruit l'URL publique via publicMediaUrl.

import { Router, Request, Response } from 'express';
import { query, pool } from '../db/index.js';
import { requireAuth } from '../auth.js';
import { createRateLimiter } from '../rateLimit.js';
import { publicMediaUrl, deleteMedia } from '../media.js';
import { isValidationError, optionalString } from './validate.js';

export const galleryRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 10 publications/heure/compte : une galerie, pas un mur de spam. */
const postRateLimit = createRateLimiter({
  windowMs: 60 * 60_000,
  limit: 10,
  message: 'صور كثيرة في وقت قصير. حاول لاحقاً.',
  keyPrefix: 'gallery-post',
  keyFn: (req) => req.user?.id ?? req.ip ?? 'unknown',
});

const mapPost = (row: any) => ({
  id: row.id,
  authorId: row.owner_id,
  author: row.display_name || 'مشجع',
  avatar: (row.display_name || 'م').slice(0, 1),
  imageUrl: publicMediaUrl(row.object_key),
  caption: row.caption,
  likes: Number(row.likes_count),
  isLiked: Boolean(row.is_liked),
  createdAt: new Date(row.created_at).toISOString(),
});

const SELECT_POST = `
  SELECT g.id, g.owner_id, g.caption, g.created_at,
         m.object_key, u.display_name,
         (SELECT COUNT(*) FROM fan_gallery_likes l WHERE l.post_id=g.id) AS likes_count,
         EXISTS(SELECT 1 FROM fan_gallery_likes l2 WHERE l2.post_id=g.id AND l2.user_id=$1) AS is_liked
  FROM fan_gallery_posts g
  JOIN media_assets m ON m.id = g.media_id AND m.status = 'uploaded'
  JOIN users u ON u.id = g.owner_id`;

galleryRouter.get('/posts', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `${SELECT_POST}
       ORDER BY g.created_at DESC LIMIT 50`,
      [req.user!.id],
    );
    res.json({ posts: result.rows.map(mapPost) });
  } catch (error) {
    console.error('[CABBA] gallery posts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

galleryRouter.post('/posts', requireAuth, postRateLimit, async (req: Request, res: Response): Promise<void> => {
  try {
    const { mediaId, caption } = req.body ?? {};
    if (typeof mediaId !== 'string' || !UUID_RE.test(mediaId)) {
      res.status(400).json({ error: 'mediaId invalide.' });
      return;
    }
    const cleanCaption = optionalString(caption, 'caption', 500) ?? 'من عدسة الجماهير 🟡⚫';

    // Propriété + état du média vérifiés en base : on ne publie que ce que le
    // compte a réellement terminé d'uploader, et que des images.
    const media = await query(
      `SELECT id FROM media_assets WHERE id=$1 AND owner_id=$2 AND status='uploaded' AND kind='image'`,
      [mediaId, req.user!.id],
    );
    if (!media.rows.length) {
      res.status(404).json({ error: 'الوسائط غير موجودة أو غير مكتملة الرفع.' });
      return;
    }

    const inserted = await query(
      `INSERT INTO fan_gallery_posts (media_id, owner_id, caption)
       VALUES ($1,$2,$3)
       ON CONFLICT (media_id) DO NOTHING
       RETURNING id`,
      [mediaId, req.user!.id, cleanCaption],
    );
    if (!inserted.rows.length) {
      res.status(409).json({ error: 'هذه الصورة منشورة بالفعل.' });
      return;
    }

    const post = await query(`${SELECT_POST} WHERE g.id = $2`, [req.user!.id, inserted.rows[0].id]);
    res.status(201).json({ post: mapPost(post.rows[0]) });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] gallery create:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

galleryRouter.post('/posts/:id/like', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const post = await client.query('SELECT id FROM fan_gallery_posts WHERE id=$1', [req.params.id]);
    if (!post.rows.length) {
      await client.query('COMMIT');
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    // Même motif que post_likes : FOR UPDATE rend le toggle idempotent sous
    // double-clic, le compteur est relu après écriture.
    const existing = await client.query(
      'SELECT 1 FROM fan_gallery_likes WHERE post_id=$1 AND user_id=$2 FOR UPDATE',
      [req.params.id, req.user!.id],
    );
    let liked: boolean;
    if (existing.rows.length) {
      await client.query('DELETE FROM fan_gallery_likes WHERE post_id=$1 AND user_id=$2', [req.params.id, req.user!.id]);
      liked = false;
    } else {
      await client.query('INSERT INTO fan_gallery_likes (post_id,user_id) VALUES ($1,$2)', [req.params.id, req.user!.id]);
      liked = true;
    }
    const count = await client.query('SELECT COUNT(*)::int AS count FROM fan_gallery_likes WHERE post_id=$1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ liked, likes: count.rows[0].count });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[CABBA] gallery like:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

galleryRouter.delete('/posts/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT g.id, g.owner_id, m.id AS media_id, m.object_key
       FROM fan_gallery_posts g JOIN media_assets m ON m.id = g.media_id
       WHERE g.id = $1`,
      [req.params.id],
    );
    const row = result.rows[0];
    if (!row) { res.status(404).json({ error: 'Post not found' }); return; }
    if (row.owner_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Best-effort sur R2 : l'objet peut avoir déjà disparu. La ligne
    // media_assets est ensuite supprimée, ce qui entraîne la publication
    // (ON DELETE CASCADE) — plus aucun objet orphelin référencé.
    await deleteMedia(row.object_key).catch((error) => {
      console.warn('[CABBA] gallery delete R2 (ignoré) :', error instanceof Error ? error.message : error);
    });
    await query('DELETE FROM media_assets WHERE id=$1', [row.media_id]);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'R2_NOT_CONFIGURED') {
      res.status(503).json({ error: 'Media storage is not configured' });
      return;
    }
    console.error('[CABBA] gallery delete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
