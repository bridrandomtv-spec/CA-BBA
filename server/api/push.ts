import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { deletePushSubscription, getPushState, isPushConfigured, savePushSubscription, sendPushToUser, updatePushPreferences } from '../notifications.js';

export const pushRouter = Router();

pushRouter.get('/config', (_req, res) => {
  res.json({ enabled: isPushConfigured(), publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
});

pushRouter.get('/state', requireAuth, async (req, res) => {
  try { res.json(await getPushState(req.user!.id)); }
  catch (error) { console.error('[CABBA] push state:', error); res.status(500).json({ error: 'Failed to read push state' }); }
});

pushRouter.post('/subscribe', requireAuth, async (req, res) => {
  try { await savePushSubscription(req.user!.id, req.body); res.status(201).json({ success: true }); }
  catch (error) { console.error('[CABBA] push subscribe:', error); res.status(400).json({ error: 'Invalid push subscription' }); }
});

pushRouter.delete('/subscribe', requireAuth, async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (typeof endpoint !== 'string' || !endpoint) { res.status(400).json({ error: 'Endpoint is required' }); return; }
    await deletePushSubscription(req.user!.id, endpoint);
    res.json({ success: true });
  } catch (error) { console.error('[CABBA] push unsubscribe:', error); res.status(500).json({ error: 'Failed to unsubscribe' }); }
});

pushRouter.put('/preferences', requireAuth, async (req, res) => {
  try {
    const value = req.body ?? {};
    const settings = { goals: Boolean(value.goals), matches: Boolean(value.matches), teamNews: Boolean(value.teamNews), finalScores: Boolean(value.finalScores) };
    await updatePushPreferences(req.user!.id, settings);
    res.json({ success: true, settings });
  } catch (error) { console.error('[CABBA] push preferences:', error); res.status(500).json({ error: 'Failed to update push preferences' }); }
});

pushRouter.post('/test', requireAuth, async (req, res) => {
  try {
    const result = await sendPushToUser(req.user!.id, 'teamNews', `test-${Date.now()}`, {
      title: 'CABBA 🔔', body: 'إشعار تجريبي من تطبيق أنصار الكابا.', url: '/', tag: 'cabba-test',
    });
    res.json(result);
  } catch (error) { console.error('[CABBA] push test:', error); res.status(500).json({ error: 'Failed to send test notification' }); }
});
