import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth, requireAdmin, AuthUser } from '../auth.js';
import { query } from '../db/index.js';
import { env } from '../env.js';
import { ANALYTICS_COOKIE, ensureAnonymousId, getAnalyticsOverview, recordAnalyticsEvent } from '../analytics.js';

export const analyticsRouter = Router();

const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const token = req.cookies?.session;
  if (!token) { next(); return; }
  try {
    const decoded = jwt.verify(token, env.sessionSecret) as { sub?: unknown };
    if (typeof decoded.sub !== 'string') { next(); return; }
    const result = await query('SELECT id,email,display_name,avatar_url,role,created_at FROM users WHERE id = $1', [decoded.sub]);
    if (result.rows.length) {
      const row = result.rows[0];
      req.user = { id: row.id, email: row.email, displayName: row.display_name, avatarUrl: row.avatar_url, role: row.role, createdAt: row.created_at } as AuthUser;
    }
  } catch { /* anonymous analytics remains valid */ }
  next();
};

analyticsRouter.post('/event', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const { eventName, path, metadata } = req.body ?? {};
  if (typeof eventName !== 'string') {
    res.status(400).json({ error: 'eventName is required' });
    return;
  }

  const anonymousId = ensureAnonymousId(req.cookies?.[ANALYTICS_COOKIE]);
  res.cookie(ANALYTICS_COOKIE, anonymousId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 180 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  try {
    await recordAnalyticsEvent({
      eventName,
      path: typeof path === 'string' ? path : null,
      anonymousId,
      userId: req.user?.id ?? null,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });
    res.status(204).end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analytics error';
    const status = message.includes('Invalid analytics') || message.includes('too large') ? 400 : 500;
    console.error('[CABBA] analytics event:', message);
    res.status(status).json({ error: status === 400 ? message : 'Internal server error' });
  }
});

analyticsRouter.get('/overview', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const days = Number(req.query.days ?? 7);
    res.json(await getAnalyticsOverview(Number.isFinite(days) ? days : 7));
  } catch (error) {
    console.error('[CABBA] analytics overview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

analyticsRouter.post('/event-authenticated', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { eventName, path, metadata } = req.body ?? {};
  if (typeof eventName !== 'string') {
    res.status(400).json({ error: 'eventName is required' });
    return;
  }
  try {
    await recordAnalyticsEvent({
      eventName,
      path: typeof path === 'string' ? path : null,
      anonymousId: ensureAnonymousId(req.cookies?.[ANALYTICS_COOKIE]),
      userId: req.user!.id,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });
    res.status(204).end();
  } catch (error) {
    console.error('[CABBA] authenticated analytics:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid analytics event' });
  }
});
