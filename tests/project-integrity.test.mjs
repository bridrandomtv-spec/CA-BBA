import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Firebase is removed from application dependencies and source', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies?.firebase, undefined);
  for (const dir of ['src', 'server']) {
    const base = path.join(root, dir);
    const stack = [base];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (entry.name === 'legacy') continue;
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) {
          assert.doesNotMatch(fs.readFileSync(full, 'utf8'), /from ['"](?:[^'"]*\/)?firebase(?:['"]|\/)/i, full);
        }
      }
    }
  }
});

test('session fallback and hard-coded port are gone', () => {
  const env = read('server/env.ts');
  const auth = read('server/auth.ts');
  const server = read('server.ts');
  assert.doesNotMatch(auth, /fallback-secret-do-not-use-in-prod/);
  assert.match(env, /process\.env\.PORT/);
  assert.match(server, /const PORT = env\.port/);
});

test('migrations are tracked and fail on error', () => {
  const migrate = read('server/db/migrate.ts');
  assert.match(migrate, /schema_migrations/);
  assert.match(migrate, /process\.exitCode = 1/);
  assert.match(migrate, /BEGIN/);
  assert.match(migrate, /ROLLBACK/);
});

test('PWA manifest references real PNG icons', () => {
  const manifest = JSON.parse(read('public/manifest.json'));
  for (const size of ['192', '512']) {
    const icon = manifest.icons.find((item) => item.src === `/icon-${size}.png`);
    assert.ok(icon, `icon-${size}.png is declared`);
    assert.ok(fs.existsSync(path.join(root, 'public', `icon-${size}.png`)));
  }
});

test('localStorage access is centralized', () => {
  const stack = [path.join(root, 'src')];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.(ts|tsx)$/.test(entry.name) && entry.name !== 'storage.ts') {
        assert.doesNotMatch(fs.readFileSync(full, 'utf8'), /\blocalStorage\./, full);
      }
    }
  }
});

test('application user roles have one authoritative model', () => {
  const types = read('src/types.ts');
  assert.doesNotMatch(types, /'member'|'staff'/);
  assert.match(types, /role:\s*'user'\s*\|\s*'admin'/);
});

test('API-Football coverage is persisted and feature sync is coverage-aware', () => {
  const migration = read('server/db/migrations/006_football_coverage.sql');
  const coverage = read('server/football/coverage.ts');
  const sync = read('server/football/sync.ts');
  const scheduler = read('server/football/scheduler.ts');
  assert.match(migration, /football_competition_coverage/);
  assert.match(migration, /api_access_blocked/);
  assert.match(coverage, /getCompetitionCoverage/);
  assert.match(coverage, /apiAccessBlocked/);
  assert.match(sync, /coverageAllows\(coverage, 'events'\)/);
  assert.match(sync, /coverageAllows\(coverage, 'lineups'\)/);
  assert.match(sync, /coverageAllows\(coverage, 'statisticsFixtures'\)/);
  assert.match(scheduler, /getCompetitionCoverage/);
});

test('football lookup does not send the unsupported Algeria country filter', () => {
  const api = read('server/api/football.ts');
  assert.doesNotMatch(api, /footballApi\(['"]\/leagues['"],\s*\{[^}]*country:\s*['"]Algeria['"]/s);
  assert.match(api, /filter\(\(x:any\) => String\(x\.country\?\.name/);
});


test('Match Center is PostgreSQL-backed and SSE carries change reasons', () => {
  const api = read('server/api/matches.ts');
  const sync = read('server/football/sync.ts');
  const events = read('server/football/events.ts');
  const center = read('src/components/MatchCenter.tsx');
  assert.match(api, /\/:id\/center/);
  assert.match(api, /text\/event-stream/);
  assert.match(api, /reason/);
  assert.match(sync, /reason: 'fixture'/);
  assert.match(sync, /reason: 'events'/);
  assert.match(sync, /reason: 'lineups'/);
  assert.match(sync, /reason: 'statistics'/);
  assert.match(events, /FootballMatchChangeReason/);
  // L'URL du flux peut porter le nom de variable et l'échappement qu'elle
  // veut (encodeURIComponent(matchId) depuis le correctif SSE) : ce qui est
  // verrouillé, c'est l'usage d'EventSource sur /api/matches/:id/stream —
  // jamais de polling navigateur pour le direct.
  assert.match(center, /EventSource\(\`\/api\/matches\/.*\/stream\`\)/);
  assert.doesNotMatch(center, /setInterval\(/);
});

test('Web Push is server-side, persisted, authenticated and handled by the service worker', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.dependencies?.['web-push']);
  const migration = read('server/db/migrations/007_web_push.sql');
  const api = read('server/api/push.ts');
  const push = read('server/notifications.ts');
  const server = read('server.ts');
  const sw = read('public/sw.js');
  assert.match(migration, /push_subscriptions/);
  assert.match(migration, /push_notification_log/);
  assert.match(api, /requireAuth/);
  assert.match(api, /\/subscribe/);
  assert.match(push, /setVapidDetails/);
  assert.match(push, /sendNotification/);
  assert.match(server, /app\.use\("\/api\/push", pushRouter\)/);
  assert.match(sw, /addEventListener\('push'/);
  assert.match(sw, /showNotification/);
  assert.match(sw, /notificationclick/);
});

test('Football events and final scores can trigger deduplicated Push notifications', () => {
  const sync = read('server/football/sync.ts');
  const scheduler = read('server/football/scheduler.ts');
  assert.match(sync, /broadcastPush\('goals'/);
  assert.match(sync, /broadcastPush\('finalScores'/);
  assert.match(sync, /previousIds/);
  assert.match(scheduler, /broadcastPush\('matches'/);
  assert.match(scheduler, /PUSH_REMINDER_INTERVAL_MS/);
});
