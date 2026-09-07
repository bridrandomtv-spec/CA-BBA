import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('production Docker image is multi-stage and exposes healthcheck', () => {
  const dockerfile = read('Dockerfile');
  assert.match(dockerfile, /FROM node:22-alpine AS build/);
  assert.match(dockerfile, /FROM node:22-alpine AS runtime/);
  assert.match(dockerfile, /npm run build/);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /api\/health/);
});

test('deployment documentation forbids automatic per-instance migrations', () => {
  const docs = read('deploy/README.md');
  assert.match(docs, /Ne lancez pas les migrations au démarrage/);
  assert.match(docs, /max instances = 1/);
  assert.match(docs, /Rollback/i);
});

test('production compose does not embed PostgreSQL', () => {
  const compose = read('deploy/docker-compose.production.yml');
  assert.doesNotMatch(compose, /postgres/i);
  assert.match(compose, /env_file/);
});
