import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

for (const file of ['deploy/verify-release.sh', 'deploy/rollback-cloudrun.sh']) {
  test(`${file} exists and is executable`, () => {
    const stat = fs.statSync(path.join(root, file));
    assert.ok(stat.mode & 0o111);
    assert.match(read(file), /^#!\/usr\/bin\/env bash/m);
    assert.match(read(file), /set -euo pipefail/);
  });
}

test('web service can scale independently of football worker', () => {
  const web = read('deploy/cloudrun-web.yaml');
  const worker = read('deploy/cloudrun-worker.yaml');
  assert.match(web, /autoscaling\.knative\.dev\/maxScale: "5"/);
  assert.match(web, /FOOTBALL_SCHEDULER_ENABLED[\s\S]*value: "false"/);
  assert.match(worker, /autoscaling\.knative\.dev\/maxScale: "1"/);
  assert.match(worker, /FOOTBALL_SCHEDULER_ENABLED[\s\S]*value: "true"/);
});

test('post-release verification checks liveness and readiness', () => {
  const s = read('deploy/verify-release.sh');
  assert.match(s, /\/api\/health/);
  assert.match(s, /\/api\/ready/);
  assert.match(s, /cabba-web/);
  assert.match(s, /cabba-football-worker/);
});

test('rollback targets explicit known-good revisions and never runs a reverse migration', () => {
  const s = read('deploy/rollback-cloudrun.sh');
  assert.match(s, /WEB_REVISION=/);
  assert.match(s, /WORKER_REVISION=/);
  assert.match(s, /update-traffic/);
  assert.doesNotMatch(s, /migrate\.cjs/);
});

test('deployment documentation covers backups and incompatible schema rollback', () => {
  const s = read('deploy/README.md');
  assert.match(s, /Sauvegardes PostgreSQL et reprise/);
  assert.match(s, /PITR/);
  assert.match(s, /migration de schéma est incompatible/);
  assert.match(s, /verify-release\.sh/);
  assert.match(s, /rollback-cloudrun\.sh/);
});
