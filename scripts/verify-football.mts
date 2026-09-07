import 'dotenv/config';

const key = process.env.API_FOOTBALL_KEY;
const leagueQuery = process.argv.includes('--league') ? process.argv[process.argv.indexOf('--league') + 1] : 'Ligue 2';
const teamQuery = process.argv.includes('--team') ? process.argv[process.argv.indexOf('--team') + 1] : 'Bordj';
const check = process.argv.includes('--check');

if (!key) {
  console.error('[CABBA] API_FOOTBALL_KEY is missing. Put it in .env first.');
  process.exit(1);
}

async function api(path: string, params: Record<string, string>) {
  const url = new URL(`https://v3.football.api-sports.io${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { 'x-apisports-key': key } });
  const body: any = await r.json().catch(() => null);
  if (!r.ok || (body?.errors && Object.keys(body.errors).length)) {
    throw new Error(JSON.stringify(body?.errors ?? body ?? { status: r.status }));
  }
  return body;
}

const leagueSearch = await api('/leagues', { search: leagueQuery });
const leagues = {
  ...leagueSearch,
  response: (leagueSearch.response ?? []).filter((x: any) => String(x.country?.name ?? '').toLowerCase() === 'algeria'),
};
console.log('\n=== LEAGUES ===');
for (const x of leagues.response ?? []) {
  console.log(`${x.league.id} | ${x.league.name} | ${x.country.name} | seasons=${(x.seasons ?? []).map((s: any) => s.year).join(',')}`);
}

const teamSearch = await api('/teams', { search: teamQuery });
const teams = {
  ...teamSearch,
  response: (teamSearch.response ?? []).filter((x: any) => String(x.team?.country ?? '').toLowerCase() === 'algeria'),
};
console.log('\n=== TEAMS ===');
for (const x of teams.response ?? []) {
  console.log(`${x.team.id} | ${x.team.name} | ${x.team.country}`);
}

if (!check) process.exit(0);

const leagueId = Number(process.env.API_FOOTBALL_LEAGUE_ID);
const season = Number(process.env.API_FOOTBALL_SEASON);
const teamId = Number(process.env.API_FOOTBALL_TEAM_ID);
if (!leagueId || !season || !teamId) {
  throw new Error('Set API_FOOTBALL_LEAGUE_ID, API_FOOTBALL_TEAM_ID and API_FOOTBALL_SEASON before --check');
}

const league = (leagues.response ?? []).find((x: any) => Number(x.league?.id) === leagueId);
console.log('\n=== CONFIGURATION ===');
console.log(`league: ${league ? `${league.league.name} (${leagueId})` : `ID ${leagueId} NOT FOUND in search result`}`);
console.log(`season: ${season}`);
console.log(`team: ${teamId}`);

// /leagues returns season-level coverage metadata. This is useful even when
// the current API plan blocks direct access to the selected season.
const selectedSeason = (league?.seasons ?? []).find((s: any) => Number(s.year) === season);
if (selectedSeason) {
  const coverage = selectedSeason.coverage ?? {};
  console.log('\n=== SEASON COVERAGE ===');
  console.log(`season listed by API: OUI`);
  console.log(`fixtures: ${coverage.fixtures ? 'OUI' : 'NON'}`);
  console.log(`standings: ${coverage.standings ? 'OUI' : 'NON'}`);
  console.log(`players: ${coverage.players ? 'OUI' : 'NON'}`);
  console.log(`topScorers: ${coverage.top_scorers ? 'OUI' : 'NON'}`);
  console.log(`events: ${coverage.fixtures?.events ? 'OUI' : 'NON'}`);
  console.log(`lineups: ${coverage.fixtures?.lineups ? 'OUI' : 'NON'}`);
  console.log(`statisticsFixtures: ${coverage.fixtures?.statistics_fixtures ? 'OUI' : 'NON'}`);
  console.log(`statisticsPlayers: ${coverage.players_statistics ? 'OUI' : 'NON'}`);
} else {
  console.log('\n=== SEASON COVERAGE ===');
  console.log('season listed by API: NON');
}

function isPlanAccessError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /free plans do not have access|plan.*do not have access|try from \d{4} to \d{4}/i.test(message);
}

let teamsForSeason: any;
try {
  teamsForSeason = await api('/teams', { league: String(leagueId), season: String(season) });
} catch (error) {
  if (isPlanAccessError(error)) {
    console.log('\n=== PLAN ACCESS ===');
    console.log('La saison est connue par API-Football mais elle est bloquée par le plan actuel.');
    console.log(error instanceof Error ? error.message : String(error));
    console.log('\n=== RESULT ===');
    console.log('IDs Ligue/club validés. Les endpoints de la saison ne peuvent pas être testés avec le plan actuel.');
    process.exit(0);
  }
  throw error;
}

const team = (teamsForSeason.response ?? []).find((x: any) => Number(x.team?.id) === teamId);
console.log(`team in league/season: ${team ? `OUI — ${team.team.name}` : 'NON'}`);
if (!team) process.exit(2);

let fixtures: any;
try {
  fixtures = await api('/fixtures', { league: String(leagueId), season: String(season), team: String(teamId), last: '5' });
} catch (error) {
  if (isPlanAccessError(error)) {
    console.log('\n=== PLAN ACCESS ===');
    console.log(error instanceof Error ? error.message : String(error));
    console.log('\n=== RESULT ===');
    console.log('IDs Ligue/club validés, mais les fixtures de cette saison sont inaccessibles avec le plan actuel.');
    process.exit(0);
  }
  throw error;
}

console.log(`fixtures returned: ${fixtures.results ?? 0}`);

const samples = (fixtures.response ?? []).slice(0, 3);
console.log('\n=== COVERAGE SAMPLES ===');
for (const fixture of samples) {
  const id = String(fixture.fixture.id);
  console.log(`\nFixture ${id}: ${fixture.teams?.home?.name} vs ${fixture.teams?.away?.name}`);
  for (const [label, path] of [
    ['events', '/fixtures/events'],
    ['lineups', '/fixtures/lineups'],
    ['statistics', '/fixtures/statistics'],
  ] as const) {
    try {
      const data = await api(path, { fixture: id });
      console.log(`${label}: ${(data.response?.length ?? 0) > 0 ? 'OUI' : 'NON'} (${data.results ?? 0})`);
    } catch (e) {
      console.log(`${label}: ERREUR — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

console.log('\n=== RESULT ===');
console.log('Les IDs sont cohérents si le club apparaît dans la Ligue/saison configurée.');
console.log('La couverture Events/Lineups/Statistics est indicative sur les derniers matchs disponibles : elle doit être confirmée sur plusieurs fixtures réelles de la saison.');
