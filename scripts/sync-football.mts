import { env } from '../server/env.js';
import { syncCompetitionFixtures, syncStandings } from '../server/football/sync.js';

if (!env.apiFootballKey) {
  console.error('[CABBA] API_FOOTBALL_KEY is missing.');
  process.exit(1);
}
const fixtures = await syncCompetitionFixtures();
const standings = await syncStandings();
console.log('[CABBA] football sync:', { fixtures, standings });
