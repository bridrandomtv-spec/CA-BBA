import { query } from '../db/index.js';
import { env } from '../env.js';
import { footballQuotaStatus } from './client.js';
import { syncCompetitionFixtures, syncFixture, syncFixtureEvents, syncFixtureLineups, syncFixtureStatistics, syncStandings } from './sync.js';
import { getCompetitionCoverage } from './coverage.js';
import { broadcastPush } from '../notifications.js';
import { maybeSendMonthlyReport } from '../reporting.js';

const LIVE_INTERVAL_MS = 180_000;       // 3 min: protects the 100/day free quota.
const EVENTS_INTERVAL_MS = 360_000;     // 6 min while live.
const STATS_INTERVAL_MS = 45 * 60_000;  // roughly HT + end, without wasting calls.
const IDLE_INTERVAL_MS = 6 * 60 * 60_000;
const PUSH_REMINDER_INTERVAL_MS = 5 * 60_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let reminderTimer: ReturnType<typeof setInterval> | null = null;
let reportTimer: ReturnType<typeof setInterval> | null = null;

// Cadence is tracked per fixture, not globally: two simultaneous CABBA matches
// must each receive their own events/statistics refresh when applicable.
const lastEventsAt = new Map<number, number>();
const lastStatsAt = new Map<number, number>();
const lineupsSynced = new Set<number>();


async function sendUpcomingMatchReminders() {
  try {
    // match_date/match_time stockent l'heure LOCALE algérienne (sync.ts) :
    // NOW() (UTC sur Cloud Run) doit être converti dans le même référentiel,
    // sinon la fenêtre « 25-35 min » tombe une heure à côté et les rappels
    // ne partent jamais au bon moment.
    const result = await query<{ id:string; home_team:string; away_team:string; match_date:string; match_time:string }>(
      `SELECT id, home_team, away_team, match_date, match_time FROM matches
       WHERE status='scheduled' AND match_date IS NOT NULL AND match_time IS NOT NULL
       AND ((match_date::date + match_time::time)
            BETWEEN (NOW() AT TIME ZONE 'Africa/Algiers') + INTERVAL '25 minutes'
                AND (NOW() AT TIME ZONE 'Africa/Algiers') + INTERVAL '35 minutes')
       ORDER BY match_date, match_time`,
    );
    for (const match of result.rows) {
      await broadcastPush('matches', `match-reminder-${match.id}-${match.match_date}-${match.match_time}`, {
        title: 'مباراة الكابا بعد قليل! 🟡⚫',
        body: `${match.home_team} ضد ${match.away_team} تبدأ خلال حوالي 30 دقيقة.`,
        url: '/#/match', tag: `cabba-reminder-${match.id}`, data: { url: '/#/match', matchId: match.id },
      });
    }
  } catch (error) { console.error('[CABBA] match reminder push:', error); }
}

function quotaUsed() {
  return footballQuotaStatus().used;
}

async function logOperation(operation: string, fixtureId: number | null, success: boolean, errorMessage?: string) {
  try {
    await query(
      `INSERT INTO football_sync_log(operation, fixture_id, success, quota_used, error_message)
       VALUES ($1,$2,$3,$4,$5)`,
      [operation, fixtureId, success, quotaUsed(), errorMessage ?? null],
    );
  } catch (error) {
    console.error('[CABBA] football sync log:', error);
  }
}

async function safeOperation(
  operation: string,
  fixtureId: number | null,
  fn: () => Promise<void>,
) {
  try {
    await fn();
    await logOperation(operation, fixtureId, true);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[CABBA] football ${operation}:`, error);
    await logOperation(operation, fixtureId, false, message);
    return false;
  }
}

async function tick() {
  if (running || !env.apiFootballKey) return schedule(IDLE_INTERVAL_MS);
  running = true;
  try {
    const coverage = await getCompetitionCoverage();
    if (coverage?.apiAccessBlocked) {
      console.warn(`[CABBA] API-Football season ${coverage.season} is blocked by the current plan; scheduler is pausing provider calls.`);
      schedule(IDLE_INTERVAL_MS);
      return;
    }

    const live = await query<{ id:string; api_fixture_id:number }>(
      `SELECT id, api_fixture_id FROM matches
       WHERE status='live' AND api_fixture_id IS NOT NULL
       ORDER BY match_date, match_time`,
    );

    if (live.rows.length) {
      for (const row of live.rows) {
        if (footballQuotaStatus().remaining < 1) break;

        const synced = await safeOperation('fixture', Number(row.api_fixture_id), async () => {
          await syncFixture(Number(row.api_fixture_id));
        });
        if (!synced) continue;

        const fixtureId = Number(row.api_fixture_id);
        const now = Date.now();
        // Compositions are fetched once per fixture. This is deliberately
        // separate from the live polling cadence: lineups are relatively
        // expensive and do not need to be refreshed every cycle.
        if (!lineupsSynced.has(fixtureId) && footballQuotaStatus().remaining >= 1) {
          if (await safeOperation('lineups', fixtureId, async () => {
            await syncFixtureLineups(fixtureId, row.id);
          })) lineupsSynced.add(fixtureId);
        }

        const eventsDue = now - (lastEventsAt.get(fixtureId) ?? 0) >= EVENTS_INTERVAL_MS;
        const statsDue = now - (lastStatsAt.get(fixtureId) ?? 0) >= STATS_INTERVAL_MS;

        if (footballQuotaStatus().remaining >= 1 && eventsDue) {
          if (await safeOperation('events', fixtureId, async () => {
            await syncFixtureEvents(fixtureId, row.id);
          })) lastEventsAt.set(fixtureId, now);
        }

        if (footballQuotaStatus().remaining >= 1 && statsDue) {
          if (await safeOperation('statistics', fixtureId, async () => {
            await syncFixtureStatistics(fixtureId, row.id);
          })) lastStatsAt.set(fixtureId, now);
        }

        // syncFixture updates the match status. If it just finished, capture
        // final statistics once even when the regular statistics interval is not due.
        const current = await query<{ status:string }>('SELECT status FROM matches WHERE id=$1', [row.id]);
        if (current.rows[0]?.status === 'finished' && footballQuotaStatus().remaining >= 1) {
          if (await safeOperation('statistics_final', fixtureId, async () => {
            await syncFixtureStatistics(fixtureId, row.id);
          })) lastStatsAt.set(fixtureId, Date.now());
          lastEventsAt.delete(fixtureId);
          lastStatsAt.delete(fixtureId);
          lineupsSynced.delete(fixtureId);
        }
      }
      schedule(LIVE_INTERVAL_MS);
    } else {
      // One request for the competition fixtures + one for standings per idle cycle.
      if (footballQuotaStatus().remaining >= 1) {
        await safeOperation('competition_fixtures', null, async () => {
          await syncCompetitionFixtures();
        });
      }
      if (footballQuotaStatus().remaining >= 1) {
        await safeOperation('standings', null, async () => {
          await syncStandings();
        });
      }
      schedule(IDLE_INTERVAL_MS);
    }
  } catch (error) {
    console.error('[CABBA] football scheduler:', error);
    schedule(LIVE_INTERVAL_MS);
  } finally {
    running = false;
  }
}

function schedule(delay:number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void tick(), delay);
}

export function startFootballScheduler() {
  if (!env.apiFootballKey) return console.log('[CABBA] API-Football disabled: no API_FOOTBALL_KEY.');
  console.log('[CABBA] API-Football scheduler started.');
  void tick();
  void sendUpcomingMatchReminders();
  reminderTimer = setInterval(() => void sendUpcomingMatchReminders(), PUSH_REMINDER_INTERVAL_MS);
  // Rapport mensuel : vérification horaire, envoi le 1er du mois ≥ 9 h (dédupliqué).
  reportTimer = setInterval(() => void maybeSendMonthlyReport(), 60 * 60_000);
}

export function stopFootballScheduler() {
  if (reportTimer) { clearInterval(reportTimer); reportTimer = null; }
  if (timer) clearTimeout(timer);
  timer = null;
  lastEventsAt.clear();
  lastStatsAt.clear();
  lineupsSynced.clear();
  if (reminderTimer) clearInterval(reminderTimer);
  reminderTimer = null;
}

