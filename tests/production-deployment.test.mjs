import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('production deployment scripts exist and are executable', () => {
  for (const file of ['deploy/bootstrap-gcp.sh', 'deploy/deploy-cloudrun.sh']) {
    const stat = fs.statSync(path.join(root, file));
    assert.ok(stat.mode & 0o111, `${file} must be executable`);
    assert.match(read(file), /^#!\/usr\/bin\/env bash/m);
  }
});

test('web service never receives the API-Football secret', () => {
  const web = read('deploy/cloudrun-web.yaml');
  assert.doesNotMatch(web, /name:\s*API_FOOTBALL_KEY/);
  assert.match(web, /FOOTBALL_SCHEDULER_ENABLED[\s\S]*value:\s*"false"/);
});

test('football worker receives API-Football and runs as a singleton', () => {
  const worker = read('deploy/cloudrun-worker.yaml');
  assert.match(worker, /autoscaling\.knative\.dev\/maxScale:\s*"1"/);
  assert.match(worker, /name:\s*API_FOOTBALL_KEY/);
  assert.match(worker, /name:\s*FOOTBALL_SCHEDULER_ENABLED[\s\S]*value:\s*"true"/);
  assert.match(worker, /args:\s*\["dist\/football-worker\.cjs"\]/);
});

test('migration job runs the compiled migration artifact', () => {
  const job = read('deploy/cloudrun-migrations-job.yaml');
  assert.match(job, /kind:\s*Job/);
  assert.match(job, /args:\s*\["dist\/migrate\.cjs"\]/);
  assert.match(job, /name:\s*cabba-database-url/);
  assert.doesNotMatch(job, /SESSION_SECRET/);
});

test('release script gates service deployment behind a successful migration', () => {
  const script = read('deploy/deploy-cloudrun.sh');
  const migrationIndex = script.indexOf('gcloud run jobs execute cabba-migrations');
  const webIndex = script.indexOf('gcloud run services replace "$rendered_web"');
  const workerIndex = script.indexOf('gcloud run services replace "$rendered_worker"');
  assert.ok(migrationIndex > 0);
  assert.ok(webIndex > migrationIndex);
  assert.ok(workerIndex > webIndex);
  assert.match(script, /set -euo pipefail/);
});

test('runtime image contains the three production entrypoints', () => {
  const docker = read('Dockerfile');
  assert.match(docker, /dist\/server\.cjs/);
  assert.match(docker, /dist\/football-worker\.cjs/);
  assert.match(docker, /dist\/migrate\.cjs/);
  assert.match(docker, /USER node/);
});
