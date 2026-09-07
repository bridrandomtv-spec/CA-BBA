import crypto from 'node:crypto';
import { query } from './db/index.js';

export const ANALYTICS_COOKIE = 'cabba_aid';
const MAX_EVENT_NAME = 80;
const MAX_PATH = 255;
const MAX_METADATA_BYTES = 4096;

const ALLOWED_EVENT_NAMES = new Set([
  'page_view',
  'feature_use',
  'match_view',
  'media_upload',
  'push_subscribed',
  'push_unsubscribed',
  'notification_opened',
  'search',
  'error',
]);

function safeJsonBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? {}), 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function ensureAnonymousId(raw: unknown): string {
  if (typeof raw === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    return raw;
  }
  return crypto.randomUUID();
}

export function isAllowedAnalyticsEvent(eventName: string): boolean {
  return ALLOWED_EVENT_NAMES.has(eventName);
}

export async function recordAnalyticsEvent(input: {
  eventName: string;
  path?: string | null;
  anonymousId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const eventName = input.eventName.trim();
  if (!eventName || eventName.length > MAX_EVENT_NAME || !isAllowedAnalyticsEvent(eventName)) {
    throw new Error('Invalid analytics event');
  }

  const path = input.path?.trim().slice(0, MAX_PATH) || null;
  const metadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
  if (safeJsonBytes(metadata) > MAX_METADATA_BYTES) throw new Error('Analytics metadata too large');

  await query(
    `INSERT INTO analytics_events (event_name, path, anonymous_id, user_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [eventName, path, input.anonymousId || null, input.userId || null, JSON.stringify(metadata)],
  );
}

export async function getAnalyticsOverview(days: number) {
  const safeDays = Math.min(Math.max(Math.floor(days || 7), 1), 90);
  const [totals, daily, topPages, topEvents] = await Promise.all([
    query(
      `SELECT
         COUNT(*)::int AS events,
         COUNT(*) FILTER (WHERE event_name = 'page_view')::int AS page_views,
         COUNT(DISTINCT COALESCE(user_id::text, anonymous_id::text))::int AS active_visitors,
         COUNT(DISTINCT user_id)::int AS active_users
       FROM analytics_events
       WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')`,
      [safeDays],
    ),
    query(
      `SELECT DATE(created_at AT TIME ZONE 'UTC') AS day,
              COUNT(*)::int AS events,
              COUNT(*) FILTER (WHERE event_name = 'page_view')::int AS page_views,
              COUNT(DISTINCT COALESCE(user_id::text, anonymous_id::text))::int AS visitors
       FROM analytics_events
       WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
       GROUP BY 1 ORDER BY 1 ASC`,
      [safeDays],
    ),
    query(
      `SELECT COALESCE(path, '/') AS path, COUNT(*)::int AS views
       FROM analytics_events
       WHERE event_name = 'page_view'
         AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
       GROUP BY 1 ORDER BY views DESC LIMIT 10`,
      [safeDays],
    ),
    query(
      `SELECT event_name AS name, COUNT(*)::int AS count
       FROM analytics_events
       WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
       GROUP BY event_name ORDER BY count DESC LIMIT 12`,
      [safeDays],
    ),
  ]);

  return {
    days: safeDays,
    totals: totals.rows[0],
    daily: daily.rows,
    topPages: topPages.rows,
    topEvents: topEvents.rows,
  };
}
