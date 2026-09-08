import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAdmin } from '../auth.js';
import { isValidationError, LIMITS, requireString, optionalHttpUrl } from './validate.js';

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
    
    // Validation typée et bornée au schéma : `!title` acceptait 123 (stocké
    // « 123 ») ou un objet (pg levait → 500). title > 255 (VARCHAR(255))
    // produisait une erreur 22001 → 500 illisible pour l'admin.
    const cleanTitle = requireString(title, 'title', LIMITS.title);
    const cleanContent = requireString(content, 'content', LIMITS.text);
    const cleanImageUrl = optionalHttpUrl(imageUrl, 'imageUrl');

    const date = new Date().toISOString().split('T')[0];

    const result = await query(
      `INSERT INTO news (title, content, image_url, date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [cleanTitle, cleanContent, cleanImageUrl, date]
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
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('Error creating news:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH edit news item
newsRouter.patch('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, content, imageUrl } = req.body;

    // Validation typée et bornée au schéma : `!title` acceptait 123 (stocké
    // « 123 ») ou un objet (pg levait → 500). title > 255 (VARCHAR(255))
    // produisait une erreur 22001 → 500 illisible pour l'admin.
    const cleanTitle = requireString(title, 'title', LIMITS.title);
    const cleanContent = requireString(content, 'content', LIMITS.text);
    const cleanImageUrl = optionalHttpUrl(imageUrl, 'imageUrl');

    const result = await query(
      `UPDATE news SET title = $1, content = $2, image_url = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [cleanTitle, cleanContent, cleanImageUrl, id]
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
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
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
