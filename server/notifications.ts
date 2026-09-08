import webpush from 'web-push';
import { query } from './db/index.js';
import { env } from './env.js';

export type PushCategory = 'goals' | 'matches' | 'teamNews' | 'finalScores';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

const configured = Boolean(env.vapidPublicKey && env.vapidPrivateKey && env.vapidSubject);
if (configured) {
  webpush.setVapidDetails(env.vapidSubject!, env.vapidPublicKey!, env.vapidPrivateKey!);
} else {
  console.warn('[CABBA] Web Push désactivé : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT sont requis.');
}

export function isPushConfigured() {
  return configured;
}

export async function savePushSubscription(userId: string, subscription: any) {
  const endpoint = typeof subscription?.endpoint === 'string' ? subscription.endpoint : '';
  const p256dh = typeof subscription?.keys?.p256dh === 'string' ? subscription.keys.p256dh : '';
  const auth = typeof subscription?.keys?.auth === 'string' ? subscription.keys.auth : '';
  if (!endpoint || !p256dh || !auth) throw new Error('Invalid push subscription');

  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth, updated_at=NOW()`,
    [userId, endpoint, p256dh, auth],
  );
}

export async function deletePushSubscription(userId: string, endpoint: string) {
  await query('DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2', [userId, endpoint]);
}

export async function updatePushPreferences(userId: string, settings: Record<PushCategory, boolean>) {
  await query(
    `UPDATE push_subscriptions SET goals=$2, matches=$3, team_news=$4, final_scores=$5, updated_at=NOW()
     WHERE user_id=$1`,
    [userId, settings.goals, settings.matches, settings.teamNews, settings.finalScores],
  );
}

export async function getPushState(userId: string) {
  const result = await query(
    `SELECT COUNT(*)::int AS count,
            COALESCE(BOOL_OR(goals), FALSE) AS goals,
            COALESCE(BOOL_OR(matches), FALSE) AS matches,
            COALESCE(BOOL_OR(team_news), FALSE) AS team_news,
            COALESCE(BOOL_OR(final_scores), FALSE) AS final_scores
       FROM push_subscriptions WHERE user_id=$1`,
    [userId],
  );
  const row = result.rows[0];
  return {
    subscribed: Number(row?.count ?? 0) > 0,
    settings: {
      goals: Boolean(row?.goals), matches: Boolean(row?.matches),
      teamNews: Boolean(row?.team_news), finalScores: Boolean(row?.final_scores),
    },
  };
}

/** Délai par livraison : un push service muet ne suspend pas la boucle
 *  séquentielle de broadcast (tous les pushes suivants attendraient). */
const DELIVERY_TIMEOUT_MS = 10_000;

async function deliverRows(rows: any[], payload: PushPayload) {
  if (!configured) return { sent: 0, removed: 0, transientFailures: 0 };
  let sent = 0;
  let removed = 0;
  let transientFailures = 0;
  const body = JSON.stringify(payload);

  for (const row of rows) {
    const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    try {
      await webpush.sendNotification(subscription, body, { TTL: 300, timeout: DELIVERY_TIMEOUT_MS });
      await query('UPDATE push_subscriptions SET last_used_at=NOW() WHERE id=$1', [row.id]);
      sent++;
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        // Abonnement mort : nettoyage définitif.
        await query('DELETE FROM push_subscriptions WHERE id=$1', [row.id]);
        removed++;
      } else {
        // 429/5xx/timeout/réseau : transitoire — candidat au retry.
        transientFailures++;
        console.error('[CABBA] Web Push delivery:', error?.message ?? error);
      }
    }
  }
  return { sent, removed, transientFailures };
}

export async function sendPushToUser(userId: string, category: PushCategory, eventKey: string, payload: PushPayload) {
  if (!configured) return { sent: 0, removed: 0, skipped: 'not_configured' as const };
  const claim = await query(
    `INSERT INTO push_notification_log (user_id, category, event_key)
     VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`,
    [userId, category, eventKey],
  );
  if (!claim.rowCount) return { sent: 0, removed: 0, skipped: 'already_sent' as const };
  const claimId = claim.rows[0].id;
  const subscriptions = await query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id=$1 AND ' + categoryColumn(category) + '=TRUE', [userId]);
  const result = await deliverRows(subscriptions.rows, payload);

  // Rien n'est parti ET au moins un échec transitoire : on rend la claim pour
  // que le prochain passage du scheduler retente. Sans cela, un but notifié
  // pendant une panne du push service était perdu à jamais (la ligne
  // event_key restait acquise → « already_sent »). Un utilisateur sans
  // abonnement (sent=0, transientFailures=0) GARDE sa claim : rien à livrer.
  if (result.sent === 0 && result.transientFailures > 0) {
    await query('DELETE FROM push_notification_log WHERE id=$1', [claimId]).catch(() => {
      // Libération best-effort : au pire, la notification de ce tick est perdue.
    });
  }

  return { sent: result.sent, removed: result.removed };
}

function categoryColumn(category: PushCategory) {
  return ({ goals: 'goals', matches: 'matches', teamNews: 'team_news', finalScores: 'final_scores' } as const)[category];
}

export async function broadcastPush(category: PushCategory, eventKey: string, payload: PushPayload) {
  if (!configured) return { sent: 0, users: 0, removed: 0, skipped: 'not_configured' as const };
  const subscriptions = await query(
    `SELECT s.id, s.user_id, s.endpoint, s.p256dh, s.auth
       FROM push_subscriptions s
      WHERE s.${categoryColumn(category)}=TRUE`,
  );

  let sent = 0;
  let removed = 0;
  let users = 0;
  for (const row of subscriptions.rows) {
    const claim = await query(
      `INSERT INTO push_notification_log (user_id, category, event_key)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`,
      [row.user_id, category, eventKey],
    );
    if (!claim.rowCount) continue;
    users++;
    const result = await deliverRows([row], payload);
    sent += result.sent;
    removed += result.removed;
    if (result.sent === 0 && result.transientFailures > 0) {
      // Même politique par appareil : la claim de CE user est rendue pour
      // permettre un retry au prochain événement/tick.
      await query(
        `DELETE FROM push_notification_log WHERE user_id=$1 AND category=$2 AND event_key=$3`,
        [row.user_id, category, eventKey],
      ).catch(() => {});
    }
  }
  return { sent, users, removed };
}
