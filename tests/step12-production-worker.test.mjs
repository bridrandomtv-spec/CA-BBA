import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('Step 12: football worker is separate from the HTTP server', () => {
  const server = read('server.ts');
  const worker = read('scripts/football-worker.mts');
  assert.match(server, /footballSchedulerEnabled/);
  assert.match(server, /FOOTBALL_SCHEDULER_ENABLED=false|scheduler disabled/i);
  assert.match(worker, /startFootballScheduler\(\)/);
  assert.doesNotMatch(worker, /app\.listen/);
  assert.match(worker, /healthServer\.listen/);
});

test('Step 12: production web defaults to scheduler disabled', () => {
  const env = read('server/env.ts');
  assert.match(env, /footballSchedulerEnabled/);
  assert.match(env, /!isProduction/);
});

test('Step 12: migration runner is compiled and runtime-safe', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.build, /server\/db\/migrate\.ts.*dist\/migrate\.cjs/);
  assert.equal(pkg.scripts['migrate:production'], 'node -e "if(process.env.NODE_ENV !== \'production\') process.exit(1)" && node dist/migrate.cjs');
  const docker = read('Dockerfile');
  assert.match(docker, /dist\/server\.cjs/);
  assert.match(docker, /dist\/football-worker\.cjs/);
  assert.match(docker, /dist\/migrate\.cjs/);
});

test('Step 12: compose pins one web scheduler-off service and one worker scheduler-on service', () => {
  const compose = read('deploy/docker-compose.production.yml');
  assert.match(compose, /cabba-web:/);
  assert.match(compose, /cabba-football-worker:/);
  assert.match(compose, /FOOTBALL_SCHEDULER_ENABLED: "false"/);
  assert.match(compose, /FOOTBALL_SCHEDULER_ENABLED: "true"/);
  assert.match(compose, /dist\/football-worker\.cjs/);
});

test('Step 12: deployment docs describe one worker and migration order', () => {
  const docs = read('deploy/README.md');
  assert.match(docs, /une seule instance active/i);
  assert.match(docs, /dist\/migrate\.cjs/);
  assert.match(docs, /ne lancez pas le runner.*parallèle/i);
});

