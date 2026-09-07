import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('analytics is PostgreSQL-backed, privacy-conscious and admin-protected', () => {
  const migration = read('server/db/migrations/010_analytics.sql');
  const analytics = read('server/analytics.ts');
  const api = read('server/api/analytics.ts');
  const server = read('server.ts');
  const client = read('src/lib/analytics.ts');
  const app = read('src/App.tsx');
  const admin = read('src/components/admin/AdminAnalytics.tsx');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS analytics_events/);
  assert.match(migration, /metadata JSONB/);
  assert.match(analytics, /ALLOWED_EVENT_NAMES/);
  assert.match(analytics, /MAX_METADATA_BYTES/);
  assert.doesNotMatch(analytics, /req\.ip|remoteAddress/);
  assert.match(api, /\/overview/);
  assert.match(api, /requireAdmin/);
  assert.match(server, /app\.use\("\/api\/analytics", analyticsRouter\)/);
  assert.match(client, /keepalive: true/);
  assert.match(app, /trackPageView/);
  assert.match(admin, /تحليلات التطبيق/);
});
