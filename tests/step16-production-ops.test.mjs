import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('CI workflow runs tests, typecheck, build and Docker build', () => {
  const s = read('.github/workflows/ci.yml');
  assert.match(s, /npm test/);
  assert.match(s, /npm run typecheck/);
  assert.match(s, /npm run build/);
  assert.match(s, /docker build/);
  assert.match(s, /node-version: 22/);
});

test('production preflight is a non-deploying guard', () => {
  const s = read('deploy/preflight-production.sh');
  const stat = fs.statSync(path.join(root, 'deploy/preflight-production.sh'));
  assert.ok(stat.mode & 0o111);
  assert.match(s, /^#!\/usr\/bin\/env bash/m);
  assert.match(s, /set -euo pipefail/);
  assert.match(s, /gcloud run services describe/);
  assert.match(s, /gcloud secrets describe/);
  assert.match(s, /curl --fail/);
  assert.doesNotMatch(s, /gcloud run services replace/);
  assert.doesNotMatch(s, /gcloud run jobs execute/);
});

test('football worker has internal ingress and remains single instance', () => {
  const s = read('deploy/cloudrun-worker.yaml');
  assert.match(s, /run\.googleapis\.com\/ingress: internal/);
  assert.match(s, /autoscaling\.knative\.dev\/maxScale: "1"/);
  assert.match(s, /FOOTBALL_SCHEDULER_ENABLED[\s\S]*value: "true"/);
});

test('monitoring runbook covers core production failure signals', () => {
  const s = read('deploy/monitoring.md');
  for (const term of ['5xx', 'p95', 'Worker', 'PostgreSQL', 'API-Football', 'Resend', 'R2', 'Web Push']) {
    assert.match(s, new RegExp(term.replace('-', '\\-'), 'i'));
  }
});
