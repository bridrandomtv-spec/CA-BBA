import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAdmin } from '../auth.js';

export const newsRouter = Router();

// GET all news
newsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query('SELECT * FROM news ORDER BY created_at DESC');
    
    // Map snake_case to camelCase
    const news = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      imageUrl: row.image_url,
      date: row.date,
      createdAt: new Date(row.created_at).getTime()
    }));

    res.json({ news });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST new news item
newsRouter.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, content, imageUrl } = req.body;
    
    if (!title || !content) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const date = new Date().toISOString().split('T')[0];

    const result = await query(
      `INSERT INTO news (title, content, image_url, date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title, content, imageUrl || null, date]
    );

    const row = result.rows[0];
    res.status(201).json({
      newsItem: {
        id: row.id,
        title: row.title,
        content: row.content,
        imageUrl: row.image_url,
        date: row.date,
        createdAt: new Date(row.created_at).getTime()
      }
    });
  } catch (error) {
    console.error('Error creating news:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH edit news item
newsRouter.patch('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, content, imageUrl } = req.body;

    if (!title || !content) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const result = await query(
      `UPDATE news SET title = $1, content = $2, image_url = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [title, content, imageUrl || null, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'News item not found' });
      return;
    }

    const row = result.rows[0];
    res.json({
      newsItem: {
        id: row.id,
        title: row.title,
        content: row.content,
        imageUrl: row.image_url,
        date: row.date,
        createdAt: new Date(row.created_at).getTime()
      }
    });
  } catch (error) {
    console.error('Error updating news:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE news item
newsRouter.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const result = await query('DELETE FROM news WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'News item not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting news:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
