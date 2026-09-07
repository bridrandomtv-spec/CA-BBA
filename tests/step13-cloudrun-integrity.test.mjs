import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }

test('football worker exposes a Cloud Run health endpoint and scheduler', () => {
  const s = read('scripts/football-worker.mts');
  assert.match(s, /createServer/);
  assert.match(s, /\/api\/health/);
  assert.match(s, /startFootballScheduler/);
  assert.match(s, /stopFootballScheduler/);
});

test('Cloud Run web service disables embedded scheduler and stays single-instance', () => {
  const s = read('deploy/cloudrun-web.yaml');
  assert.match(s, /name: cabba-web/);
  assert.match(s, /FOOTBALL_SCHEDULER_ENABLED[\s\S]*value: "false"/);
  assert.match(s, /autoscaling\.knative\.dev\/maxScale: "5"/);
});

test('Cloud Run worker is single-instance with CPU always allocated', () => {
  const s = read('deploy/cloudrun-worker.yaml');
  assert.match(s, /name: cabba-football-worker/);
  assert.match(s, /FOOTBALL_SCHEDULER_ENABLED[\s\S]*value: "true"/);
  assert.match(s, /autoscaling\.knative\.dev\/maxScale: "1"/);
  assert.match(s, /run\.googleapis\.com\/cpu-throttling: "false"/);
  assert.match(s, /dist\/football-worker\.cjs/);
});

test('Cloud Run migration job uses compiled migration artifact', () => {
  const s = read('deploy/cloudrun-migrations-job.yaml');
  assert.match(s, /kind: Job/);
  assert.match(s, /dist\/migrate\.cjs/);
  assert.match(s, /DATABASE_URL/);
});

test('production image contains compiled worker and migration artifacts', () => {
  const s = read('Dockerfile');
  assert.match(s, /dist\/football-worker\.cjs/);
  assert.match(s, /dist\/migrate\.cjs/);
});
