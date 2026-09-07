import { query, withTransaction } from '../db/index.js';
import { footballApi } from './client.js';
import { footballEvents } from './events.js';
import { env } from '../env.js';
import { getCompetitionCoverage, markCompetitionAccessBlocked, coverageAllows } from './coverage.js';
import { broadcastPush } from '../notifications.js';

type ApiResponse<T> = { response: T[] };

function apiStatusToApp(status?: string): string {
  if (!status) return 'scheduled';
  if (['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(status)) return 'live';
  if (['FT', 'AET', 'PEN'].includes(status)) return 'finished';
  if (status === 'PST') return 'postponed';
  if (['CANC', 'ABD', 'AWD', 'WO'].includes(status)) return 'cancelled';
  return 'scheduled';
}

async function upsertFixture(fixture: any): Promise<string> {
  const date = fixture.fixture?.date ? new Date(fixture.fixture.date) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error(`Fixture ${fixture.fixture?.id} has no valid date`);
  return withTransaction(async (execute) => {
    const result = await execute(
      `INSERT INTO matches (
        home_team, away_team, competition, match_date, match_time, stadium, status,
        home_score, away_score, api_fixture_id, api_league_id, api_season, api_round,
        api_status, elapsed_minute, extra_minute, home_team_api_id, away_team_api_id,
        home_logo_url, away_logo_url, venue_api_id, api_last_synced_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW())
      ON CONFLICT (api_fixture_id) DO UPDATE SET
        home_team=EXCLUDED.home_team, away_team=EXCLUDED.away_team,
        competition=EXCLUDED.competition, match_date=EXCLUDED.match_date,
        match_time=EXCLUDED.match_time, stadium=EXCLUDED.stadium,
        status=EXCLUDED.status, home_score=EXCLUDED.home_score,
        away_score=EXCLUDED.away_score, api_league_id=EXCLUDED.api_league_id,
        api_season=EXCLUDED.api_season, api_round=EXCLUDED.api_round,
        api_status=EXCLUDED.api_status, elapsed_minute=EXCLUDED.elapsed_minute,
        extra_minute=EXCLUDED.extra_minute, home_team_api_id=EXCLUDED.home_team_api_id,
        away_team_api_id=EXCLUDED.away_team_api_id, home_logo_url=EXCLUDED.home_logo_url,
        away_logo_url=EXCLUDED.away_logo_url, venue_api_id=EXCLUDED.venue_api_id,
        api_last_synced_at=NOW()
      RETURNING id`,
      [fixture.teams?.home?.name ?? 'Équipe locale', fixture.teams?.away?.name ?? 'Équipe visiteuse',
        fixture.league?.name ?? 'Football', date.toISOString().slice(0, 10), date.toISOString().slice(11, 19),
        fixture.fixture?.venue?.name ?? '—', apiStatusToApp(fixture.fixture?.status?.short),
        fixture.goals?.home ?? 0, fixture.goals?.away ?? 0, fixture.fixture?.id,
        fixture.league?.id ?? null, fixture.league?.season ?? null, fixture.league?.round ?? null,
        fixture.fixture?.status?.short ?? null, fixture.fixture?.status?.elapsed ?? null,
        fixture.fixture?.status?.extra ?? null, fixture.teams?.home?.id ?? null, fixture.teams?.away?.id ?? null,
        fixture.teams?.home?.logo ?? null, fixture.teams?.away?.logo ?? null, fixture.fixture?.venue?.id ?? null],
    );
    return result.rows[0].id as string;
  });
}

export async function syncFixture(fixtureId: number) {
  let data: ApiResponse<any>;
  try {
    data = await footballApi<ApiResponse<any>>('/fixtures', { id: fixtureId });
  } catch (error) {
    await markCompetitionAccessBlocked(error);
    throw error;
  }
  const fixture = data.response?.[0];
  if (!fixture) throw new Error(`Fixture ${fixtureId} not found`);
  const before = await query<{ status:string; home_score:number; away_score:number }>(
    'SELECT status, home_score, away_score FROM matches WHERE api_fixture_id=$1 LIMIT 1', [fixtureId],
  );
  const previous = before.rows[0];
  const matchId = await upsertFixture(fixture);
  await query('INSERT INTO football_sync_log(operation, fixture_id, success, quota_used) VALUES ($1,$2,true,$3)',
    ['fixture', fixtureId, null]);
  footballEvents.emit('match:changed', { matchId, fixtureId, reason: 'fixture', updatedAt: new Date().toISOString() });

  const nextStatus = apiStatusToApp(fixture.fixture?.status?.short);
  const homeScore = Number(fixture.goals?.home ?? 0);
  const awayScore = Number(fixture.goals?.away ?? 0);
  if (nextStatus === 'finished' && previous?.status !== 'finished') {
    void broadcastPush('finalScores', `fixture-finished-${fixtureId}-${homeScore}-${awayScore}`, {
      title: 'نهاية المباراة! 🏁',
      body: `${fixture.teams?.home?.name ?? 'الفريق المضيف'} ${homeScore} - ${awayScore} ${fixture.teams?.away?.name ?? 'الفريق الضيف'}`,
      url: '/?tab=match', tag: `cabba-final-${fixtureId}`, data: { url: '/?tab=match', fixtureId },
    }).catch((error) => console.error('[CABBA] final score push:', error));
  }
  return { matchId, status: fixture.fixture?.status?.short, elapsed: fixture.fixture?.status?.elapsed ?? null };
}

export async function syncFixtureEvents(fixtureId: number, matchId: string) {
  const coverage = await getCompetitionCoverage();
  if (!coverageAllows(coverage, 'events')) return { skipped: true, reason: coverage?.apiAccessBlocked ? 'plan_access' : 'coverage' };
  let data: ApiResponse<any>;
  try {
    data = await footballApi<ApiResponse<any>>('/fixtures/events', { fixture: fixtureId });
  } catch (error) {
    await markCompetitionAccessBlocked(error);
    throw error;
  }
  const previousEvents = await query<{ api_event_id:number | null }>('SELECT api_event_id FROM match_events WHERE match_id=$1', [matchId]);
  const previousIds = new Set(previousEvents.rows.map((row) => row.api_event_id).filter((id): id is number => id !== null));
  await query('DELETE FROM match_events WHERE match_id=$1', [matchId]);
  const newGoalEvents: any[] = [];
  for (const event of data.response ?? []) {
    if (event.type === 'Goal' && event.detail !== 'Missed Penalty' && event.id && !previousIds.has(Number(event.id))) newGoalEvents.push(event);
    await query(
      `INSERT INTO match_events (match_id, api_event_id, minute, extra_minute, type, detail, comments, team_api_id, player_api_id, player_name, assist_player_api_id, assist_player_name, raw_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (match_id, api_event_id) DO UPDATE SET minute=EXCLUDED.minute, extra_minute=EXCLUDED.extra_minute, type=EXCLUDED.type, detail=EXCLUDED.detail, comments=EXCLUDED.comments, raw_json=EXCLUDED.raw_json`,
      [matchId, event.id ?? null, event.time?.elapsed ?? 0, event.time?.extra ?? null, event.type ?? null,
        event.detail ?? null, event.comments ?? null, event.team?.id ?? null, event.player?.id ?? null,
        event.player?.name ?? null, event.assist?.id ?? null, event.assist?.name ?? null, JSON.stringify(event)],
    );
  }
  for (const event of newGoalEvents) {
    const scorer = event.player?.name ? ` — ${event.player.name}` : '';
    void broadcastPush('goals', `goal-${fixtureId}-${event.id}`, {
      title: 'هدف في مباراة الكابا! ⚽',
      body: `${event.team?.name ?? 'الفريق'} يسجل في الدقيقة ${event.time?.elapsed ?? '?'}${event.time?.extra ? `+${event.time.extra}` : ''}${scorer}`,
      url: '/?tab=match', tag: `cabba-goal-${fixtureId}-${event.id}`, data: { url: '/?tab=match', fixtureId, eventId: event.id },
    }).catch((error) => console.error('[CABBA] goal push:', error));
  }
  footballEvents.emit('match:changed', { matchId, fixtureId, reason: 'events', updatedAt: new Date().toISOString() });
}

export async function syncFixtureLineups(fixtureId: number, matchId: string) {
  const coverage = await getCompetitionCoverage();
  if (!coverageAllows(coverage, 'lineups')) return { skipped: true, reason: coverage?.apiAccessBlocked ? 'plan_access' : 'coverage' };
  let data: ApiResponse<any>;
  try {
    data = await footballApi<ApiResponse<any>>('/fixtures/lineups', { fixture: fixtureId });
  } catch (error) {
    await markCompetitionAccessBlocked(error);
    throw error;
  }
  await query('DELETE FROM match_lineups WHERE match_id=$1', [matchId]);
  for (const lineup of data.response ?? []) {
    for (const starter of lineup.startXI ?? []) await saveLineup(matchId, lineup.team?.id, starter, true);
    for (const substitute of lineup.substitutes ?? []) await saveLineup(matchId, lineup.team?.id, substitute, false);
  }
  footballEvents.emit('match:changed', { matchId, fixtureId, reason: 'lineups', updatedAt: new Date().toISOString() });
}

async function saveLineup(matchId: string, teamApiId: number | undefined, entry: any, starter: boolean) {
  const p = entry.player ?? {};
  if (!teamApiId || !p.id) return;
  await query(
    `INSERT INTO match_lineups (match_id, team_api_id, player_api_id, player_name, number, position, grid, starter, raw_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (match_id, team_api_id, player_api_id) DO UPDATE SET player_name=EXCLUDED.player_name, number=EXCLUDED.number, position=EXCLUDED.position, grid=EXCLUDED.grid, starter=EXCLUDED.starter, raw_json=EXCLUDED.raw_json, updated_at=NOW()`,
    [matchId, teamApiId, p.id, p.name ?? null, p.number ?? null, p.pos ?? null, p.grid ?? null, starter, JSON.stringify(entry)],
  );
}

export async function syncFixtureStatistics(fixtureId: number, matchId: string) {
  const coverage = await getCompetitionCoverage();
  if (!coverageAllows(coverage, 'statisticsFixtures')) return { skipped: true, reason: coverage?.apiAccessBlocked ? 'plan_access' : 'coverage' };
  let data: ApiResponse<any>;
  try {
    data = await footballApi<ApiResponse<any>>('/fixtures/statistics', { fixture: fixtureId });
  } catch (error) {
    await markCompetitionAccessBlocked(error);
    throw error;
  }
  for (const team of data.response ?? []) {
    if (!team.team?.id) continue;
    await query(
      `INSERT INTO match_statistics (match_id, team_api_id, statistics, raw_json)
       VALUES ($1,$2,$3,$4) ON CONFLICT (match_id, team_api_id) DO UPDATE SET statistics=EXCLUDED.statistics, raw_json=EXCLUDED.raw_json, updated_at=NOW()`,
      [matchId, team.team.id, JSON.stringify(team.statistics ?? []), JSON.stringify(team)],
    );
  }
  footballEvents.emit('match:changed', { matchId, fixtureId, reason: 'statistics', updatedAt: new Date().toISOString() });
}

export async function syncCompetitionFixtures() {
  if (!env.apiFootballLeagueId || !env.apiFootballSeason) return { synced: 0 };
  const coverage = await getCompetitionCoverage();
  if (!coverageAllows(coverage, 'fixtures')) {
    return { synced: 0, skipped: true, reason: coverage?.apiAccessBlocked ? 'plan_access' : 'coverage' };
  }

  let data: ApiResponse<any>;
  try {
    data = await footballApi<ApiResponse<any>>('/fixtures', {
      league: env.apiFootballLeagueId,
      season: env.apiFootballSeason,
      team: env.apiFootballTeamId,
    });
  } catch (error) {
    await markCompetitionAccessBlocked(error);
    throw error;
  }

  let synced = 0;
  for (const fixture of data.response ?? []) {
    await upsertFixture(fixture);
    synced++;
  }
  return { synced };
}

export async function syncStandings() {
  if (!env.apiFootballLeagueId || !env.apiFootballSeason) return { synced: false, count: 0 };
  const coverage = await getCompetitionCoverage();
  if (!coverageAllows(coverage, 'standings')) {
    return { synced: false, count: 0, skipped: true, reason: coverage?.apiAccessBlocked ? 'plan_access' : 'coverage' };
  }

  let data: ApiResponse<any>;
  try {
    data = await footballApi<ApiResponse<any>>('/standings', {
      league: env.apiFootballLeagueId,
      season: env.apiFootballSeason,
    });
  } catch (error) {
    await markCompetitionAccessBlocked(error);
    throw error;
  }

  const groups = data.response?.[0]?.league?.standings ?? [];
  const standings = groups.flat?.() ?? [];
  await query('DELETE FROM league_standings WHERE league_api_id=$1 AND season=$2', [env.apiFootballLeagueId, env.apiFootballSeason]);
  for (const row of standings) {
    await query(
      `INSERT INTO league_standings (league_api_id, season, rank, team_api_id, team_name, team_logo_url, points, goals_diff, played, win, draw, lose, goals_for, goals_against, form, raw_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [env.apiFootballLeagueId, env.apiFootballSeason, row.rank, row.team?.id, row.team?.name, row.team?.logo,
        row.points, row.goalsDiff, row.all?.played, row.all?.win, row.all?.draw, row.all?.lose,
        row.all?.goals?.for, row.all?.goals?.against, row.form, JSON.stringify(row)],
    );
  }
  return { synced: true, count: standings.length };
}
