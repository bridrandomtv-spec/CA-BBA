import { Router } from 'express';
import { requireAdmin } from '../auth.js';
import { isEmailConfigured, sendEmail } from '../email.js';
import { query } from '../db/index.js';

export const emailRouter = Router();

emailRouter.get('/status', requireAdmin, async (_req, res) => {
  try {
    const result = await query(`SELECT status, COUNT(*)::int AS count FROM email_log GROUP BY status ORDER BY status`);
    res.json({ enabled: isEmailConfigured(), stats: result.rows });
  } catch (error) {
    console.error('[CABBA] email status:', error);
    res.status(500).json({ error: 'Failed to read email status' });
  }
});

emailRouter.post('/test', requireAdmin, async (req, res) => {
  const to = req.body?.to;
  if (typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    res.status(400).json({ error: 'A valid email address is required' });
    return;
  }
  try {
    const result = await sendEmail({
      to,
      kind: 'system',
      subject: 'CABBA — test email',
      html: '<p>Cette adresse confirme que les emails transactionnels CABBA sont correctement configurés.</p>',
    });
    res.json(result);
  } catch (error) {
    console.error('[CABBA] email test:', error);
    res.status(502).json({ error: 'Email provider unavailable' });
  }
});
