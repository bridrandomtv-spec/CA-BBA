import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAdmin } from '../auth.js';

export const videosRouter = Router();

// GET all videos
videosRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query('SELECT * FROM videos ORDER BY created_at DESC');
    
    const videos = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      videoUrl: row.video_url,
      thumbnail: row.thumbnail,
      category: row.category,
      views: row.views,
      published: row.published,
      createdAt: new Date(row.created_at).getTime()
    }));

    res.json({ videos });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST new video
videosRouter.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, videoUrl, thumbnail, category, published } = req.body;
    
    if (!title || !description || !videoUrl || !category) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const result = await query(
      `INSERT INTO videos (title, description, video_url, thumbnail, category, published)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, description, videoUrl, thumbnail || null, category, published ?? true]
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
    console.error('Error creating video:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH edit video
videosRouter.patch('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, videoUrl, thumbnail, category, published } = req.body;

    if (!title || !description || !videoUrl || !category) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const result = await query(
      `UPDATE videos SET title = $1, description = $2, video_url = $3, thumbnail = $4, category = $5, published = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [title, description, videoUrl, thumbnail || null, category, published ?? true, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    const row = result.rows[0];
    res.json({
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
videosRouter.post('/:id/view', async (req: Request, res: Response): Promise<void> => {
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
