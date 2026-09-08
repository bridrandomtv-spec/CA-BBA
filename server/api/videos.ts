import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAdmin } from '../auth.js';
import { createRateLimiter } from '../rateLimit.js';
import {
  isValidationError, LIMITS,
  requireString, requireHttpUrl, optionalHttpUrl, requireBoolean,
} from './validate.js';

export const videosRouter = Router();

/** Compteur de vues : 30/min/IP — assez pour les relectures légitimes, trop
 *  bas pour gonfler un compteur au script (le limiteur global laissait
 *  120 incréments/min/IP). */
const viewRateLimit = createRateLimiter({
  windowMs: 60_000,
  limit: 30,
  message: 'Trop de vues comptabilisées. Réessayez dans une minute.',
  keyPrefix: 'video-view',
});

function toVideo(row: any) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    videoUrl: row.video_url,
    thumbnail: row.thumbnail,
    category: row.category,
    views: row.views,
    published: row.published,
    createdAt: new Date(row.created_at).getTime()
  };
}

/**
 * Le filtre sur `published` est côté serveur et non dans le composant : un
 * visiteur qui appelle l'API directement ne doit pas pouvoir lire une vidéo
 * qu'un administrateur a laissée en brouillon. Les administrateurs passent par
 * `/admin`, qui renvoie tout — c'est ce qui permet à l'écran de gestion de
 * lister et de modifier les brouillons.
 */
const listVideos = (publishedOnly: boolean) => async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      publishedOnly
        ? 'SELECT * FROM videos WHERE published = true ORDER BY created_at DESC'
        : 'SELECT * FROM videos ORDER BY created_at DESC'
    );

    res.json({ videos: result.rows.map(toVideo) });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET published videos
videosRouter.get('/', listVideos(true));

// GET every video, drafts included
videosRouter.get('/admin', requireAdmin, listVideos(false));

// POST new video
videosRouter.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, videoUrl, thumbnail, category, published } = req.body;
    
    const cleanTitle = requireString(title, 'title', LIMITS.title);
    const cleanDescription = requireString(description, 'description', LIMITS.text);
    const cleanVideoUrl = requireHttpUrl(videoUrl, 'videoUrl');
    const cleanThumbnail = optionalHttpUrl(thumbnail, 'thumbnail');
    const cleanCategory = requireString(category, 'category', LIMITS.category);
    const cleanPublished = published === undefined ? true : requireBoolean(published, 'published');

    const result = await query(
      `INSERT INTO videos (title, description, video_url, thumbnail, category, published)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [cleanTitle, cleanDescription, cleanVideoUrl, cleanThumbnail, cleanCategory, cleanPublished]
    );

    const row = result.rows[0];
    res.status(201).json({
      video: {
        id: row.id,
        title: row.title,
        description: row.description,
        videoUrl: row.video_url,
        thumbnail: row.thumbnail,
        category: row.category,
        views: row.views,
        published: row.published,
        createdAt: new Date(row.created_at).getTime()
      }
    });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('Error creating video:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH edit video
videosRouter.patch('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, videoUrl, thumbnail, category, published } = req.body ?? {};

    // PATCH PARTIEL : seuls les champs présents sont modifiés. L'ancien
    // handler appliquait `published ?? true` — modifier n'importe quel champ
    // d'un BROUILLON sans renvoyer `published` le REPUBLIAIT silencieusement.
    const fragments: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];

    if (title !== undefined) {
      params.push(requireString(title, 'title', LIMITS.title));
      fragments.push(`title = $${params.length}`);
    }
    if (description !== undefined) {
      params.push(requireString(description, 'description', LIMITS.text));
      fragments.push(`description = $${params.length}`);
    }
    if (videoUrl !== undefined) {
      params.push(requireHttpUrl(videoUrl, 'videoUrl'));
      fragments.push(`video_url = $${params.length}`);
    }
    if (thumbnail !== undefined) {
      params.push(optionalHttpUrl(thumbnail, 'thumbnail'));
      fragments.push(`thumbnail = $${params.length}`);
    }
    if (category !== undefined) {
      params.push(requireString(category, 'category', LIMITS.category));
      fragments.push(`category = $${params.length}`);
    }
    if (published !== undefined) {
      params.push(requireBoolean(published, 'published'));
      fragments.push(`published = $${params.length}`);
    }

    if (params.length === 0) {
      res.status(400).json({ error: 'Aucun champ à mettre à jour.' });
      return;
    }

    params.push(req.params.id);
    const result = await query(
      `UPDATE videos SET ${fragments.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    res.json({ video: toVideo(result.rows[0]) });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('Error updating video:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE video
videosRouter.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const result = await query('DELETE FROM videos WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST increment views
videosRouter.post('/:id/view', viewRateLimit, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const result = await query('UPDATE videos SET views = views + 1 WHERE id = $1 RETURNING views', [id]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    res.json({ views: result.rows[0].views });
  } catch (error) {
    console.error('Error incrementing video views:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
