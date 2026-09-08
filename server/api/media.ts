import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { createUploadUrl, deleteMedia, isR2Configured, publicMediaUrl } from '../media.js';
import { createRateLimiter } from '../rateLimit.js';

export const mediaRouter = Router();

mediaRouter.get('/config', (_req: Request, res: Response): void => {
  res.json({ configured: isR2Configured(), publicBaseUrlConfigured: Boolean(publicMediaUrl('health-check')) });
});

/** 30 presign/heure/compte : sans quota, un compte pouvait créer des
 *  milliers de lignes `pending` (stockage mort + table gonflée). */
const presignRateLimit = createRateLimiter({
  windowMs: 60 * 60_000,
  limit: 30,
  message: 'عمليات رفع كثيرة هذا الساعة. حاول لاحقاً.',
  keyPrefix: 'media-presign',
  keyFn: (req) => req.user?.id ?? req.ip ?? 'unknown',
});

mediaRouter.post('/presign', requireAuth, presignRateLimit, async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileName, contentType, size, folder } = req.body ?? {};
    // Number.isInteger(-5) === true : sans la garde `<= 0`, un presign pour
    // une taille négative ou nulle passait la validation.
    if (typeof fileName !== 'string' || !fileName.trim() || typeof contentType !== 'string'
      || !Number.isInteger(Number(size)) || Number(size) <= 0) {
      res.status(400).json({ error: 'Invalid media data' });
      return;
    }

    const result = await createUploadUrl({
      userId: req.user!.id,
      fileName: fileName.trim(),
      contentType,
      size: Number(size),
      folder: typeof folder === 'string' ? folder : undefined,
    });

    const inserted = await query(
      `INSERT INTO media_assets (owner_id, object_key, original_name, content_type, size_bytes, kind, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending')
       RETURNING id, object_key, content_type, size_bytes, kind, status, created_at`,
      [req.user!.id, result.key, fileName.trim().slice(0, 255), contentType, Number(size), result.kind],
    );

    res.status(201).json({
      media: {
        id: inserted.rows[0].id,
        key: result.key,
        uploadUrl: result.uploadUrl,
        publicUrl: result.publicUrl,
        expiresIn: result.expiresIn,
        contentType,
        size: Number(size),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'R2_NOT_CONFIGURED') {
      res.status(503).json({ error: 'Media storage is not configured' });
      return;
    }
    if (error instanceof Error && error.message === 'UNSUPPORTED_MEDIA_TYPE') {
      res.status(415).json({ error: 'Unsupported media type' });
      return;
    }
    if (error instanceof Error && error.message === 'MEDIA_TOO_LARGE') {
      res.status(413).json({ error: 'Media file is too large' });
      return;
    }
    console.error('[CABBA] media presign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

mediaRouter.post('/:id/complete', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `UPDATE media_assets SET status='uploaded', updated_at=NOW()
       WHERE id=$1 AND owner_id=$2 AND status='pending'
       RETURNING id, object_key, original_name, content_type, size_bytes, kind, status`,
      [req.params.id, req.user!.id],
    );
    if (!result.rows.length) {
      res.status(404).json({ error: 'Media asset not found' });
      return;
    }
    const row = result.rows[0];
    res.json({
      media: {
        id: row.id,
        key: row.object_key,
        fileName: row.original_name,
        contentType: row.content_type,
        size: Number(row.size_bytes),
        kind: row.kind,
        status: row.status,
        publicUrl: publicMediaUrl(row.object_key),
      },
    });
  } catch (error) {
    console.error('[CABBA] media complete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

mediaRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT id, owner_id, object_key FROM media_assets WHERE id=$1`,
      [req.params.id],
    );
    const row = result.rows[0];
    if (!row) { res.status(404).json({ error: 'Media asset not found' }); return; }
    if (row.owner_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
    await deleteMedia(row.object_key);
    await query('DELETE FROM media_assets WHERE id=$1', [row.id]);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'R2_NOT_CONFIGURED') {
      res.status(503).json({ error: 'Media storage is not configured' });
      return;
    }
    console.error('[CABBA] media delete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

mediaRouter.get('/admin/pending', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT id, owner_id, object_key, original_name, content_type, size_bytes, kind, status, created_at
       FROM media_assets WHERE status='pending' AND created_at < NOW() - INTERVAL '15 minutes'
       ORDER BY created_at ASC LIMIT 100`,
    );
    res.json({ media: result.rows.map((row) => ({ ...row, size: Number(row.size_bytes) })) });
  } catch (error) {
    console.error('[CABBA] media pending:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Purge des uploads périmés : GET /admin/pending LISTAIT les presign jamais
// finalisés (PUT abandonné, /complete jamais appelé) sans jamais les
// nettoyer — la table media_assets gonflait et des objets orphelins
// s'accumulaient dans le bucket. DELETE best-effort : l'objet R2 existe
// peut-être (PUT réussi) ou pas (presign abandonné).
mediaRouter.delete('/admin/pending', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const stale = await query(
      `SELECT id, object_key FROM media_assets
       WHERE status='pending' AND created_at < NOW() - INTERVAL '15 minutes'
       ORDER BY created_at ASC LIMIT 500`,
    );

    await Promise.allSettled(
      stale.rows.map((row) => deleteMedia(row.object_key).catch(() => undefined)),
    );

    const deleted = await query(
      'DELETE FROM media_assets WHERE id = ANY($1::uuid[])',
      [stale.rows.map((row) => row.id)],
    );

    res.json({ purged: deleted.rowCount ?? 0 });
  } catch (error) {
    if (error instanceof Error && error.message === 'R2_NOT_CONFIGURED') {
      res.status(503).json({ error: 'Media storage is not configured' });
      return;
    }
    console.error('[CABBA] media purge:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
