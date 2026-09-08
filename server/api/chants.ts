import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAdmin } from '../auth.js';
import { createRateLimiter } from '../rateLimit.js';
import { isValidationError, LIMITS, requireString, requireHttpUrl, optionalHttpUrl } from './validate.js';

export const chantsRouter = Router();

/** Lectures audio : 30/min/IP (relectures légitimes larges, script de
 *  gonflement exclu). */
const viewRateLimit = createRateLimiter({
  windowMs: 60_000,
  limit: 30,
  message: 'Trop de lectures comptabilisées. Réessayez dans une minute.',
  keyPrefix: 'chant-view',
});

// GET all chants
chantsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query('SELECT * FROM chants ORDER BY created_at DESC');
    
    const chants = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      lyrics: row.lyrics,
      audioUrl: row.audio_url,
      imageUrl: row.image_url,
      category: row.category,
      views: row.views,
      createdAt: new Date(row.created_at).getTime()
    }));

    res.json({ chants });
  } catch (error) {
    console.error('Error fetching chants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST new chant
chantsRouter.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, lyrics, audioUrl, imageUrl, category } = req.body;
    
    // Validation typée + bornée au schéma (title/category VARCHAR, audio_url
    // TEXT mais http(s) obligatoire — un `javascript:` stocké serait servi).
    const cleanTitle = requireString(title, 'title', LIMITS.title);
    const cleanLyrics = requireString(lyrics, 'lyrics', LIMITS.text);
    const cleanAudioUrl = requireHttpUrl(audioUrl, 'audioUrl');
    const cleanImageUrl = optionalHttpUrl(imageUrl, 'imageUrl');
    const cleanCategory = requireString(category, 'category', LIMITS.category);

    const result = await query(
      `INSERT INTO chants (title, lyrics, audio_url, image_url, category)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [cleanTitle, cleanLyrics, cleanAudioUrl, cleanImageUrl, cleanCategory]
    );

    const row = result.rows[0];
    res.status(201).json({
      chant: {
        id: row.id,
        title: row.title,
        lyrics: row.lyrics,
        audioUrl: row.audio_url,
        imageUrl: row.image_url,
        category: row.category,
        views: row.views,
        createdAt: new Date(row.created_at).getTime()
      }
    });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('Error creating chant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH edit chant
chantsRouter.patch('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, lyrics, audioUrl, imageUrl, category } = req.body;

    // Validation typée + bornée au schéma (title/category VARCHAR, audio_url
    // TEXT mais http(s) obligatoire — un `javascript:` stocké serait servi).
    const cleanTitle = requireString(title, 'title', LIMITS.title);
    const cleanLyrics = requireString(lyrics, 'lyrics', LIMITS.text);
    const cleanAudioUrl = requireHttpUrl(audioUrl, 'audioUrl');
    const cleanImageUrl = optionalHttpUrl(imageUrl, 'imageUrl');
    const cleanCategory = requireString(category, 'category', LIMITS.category);

    const result = await query(
      `UPDATE chants SET title = $1, lyrics = $2, audio_url = $3, image_url = $4, category = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [cleanTitle, cleanLyrics, cleanAudioUrl, cleanImageUrl, cleanCategory, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Chant not found' });
      return;
    }

    const row = result.rows[0];
    res.json({
      chant: {
        id: row.id,
        title: row.title,
        lyrics: row.lyrics,
        audioUrl: row.audio_url,
        imageUrl: row.image_url,
        category: row.category,
        views: row.views,
        createdAt: new Date(row.created_at).getTime()
      }
    });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('Error updating chant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE chant
chantsRouter.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const result = await query('DELETE FROM chants WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Chant not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting chant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST increment views
chantsRouter.post('/:id/view', viewRateLimit, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const result = await query('UPDATE chants SET views = views + 1 WHERE id = $1 RETURNING views', [id]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Chant not found' });
      return;
    }

    res.json({ views: result.rows[0].views });
  } catch (error) {
    console.error('Error incrementing chant views:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
