import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('production security middleware, proxy handling and request correlation are enabled', () => {
  const server = read('server.ts');
  const env = read('server/env.ts');
  const security = read('server/security.ts');
  assert.match(server, /app\.disable\('x-powered-by'\)/);
  assert.match(server, /app\.set\('trust proxy', env\.trustProxy\)/);
  assert.match(server, /securityHeaders/);
  assert.match(server, /requestId/);
  assert.match(server, /express\.json\(\{ limit: '128kb' \}\)/);
  assert.match(env, /TRUST_PROXY/);
  assert.match(security, /X-Content-Type-Options/);
  assert.match(security, /Content-Security-Policy/);
  assert.match(security, /Strict-Transport-Security/);
  assert.match(security, /X-Request-ID/);
});

test('API and authentication rate limits exist', () => {
  const server = read('server.ts');
  const security = read('server/security.ts');
  assert.match(server, /limit: 120/);
  assert.match(server, /limit: 20/);
  assert.match(server, /app\.use\('\/api', apiRateLimit\)/);
  assert.match(server, /app\.use\('\/api\/auth\/login', authRateLimit\)/);
  assert.match(server, /app\.use\('\/api\/auth\/register', authRateLimit\)/);
  assert.match(security, /Retry-After/);
  assert.match(security, /X-RateLimit-Remaining/);
});

test('liveness/readiness and graceful shutdown are implemented', () => {
  const server = read('server.ts');
  assert.match(server, /app\.get\('\/api\/health'/);
  assert.match(server, /app\.get\('\/api\/ready'/);
  assert.match(server, /SELECT 1/);
  assert.match(server, /status\(503\)/);
  assert.match(server, /process\.once\('SIGTERM'/);
  assert.match(server, /process\.once\('SIGINT'/);
  assert.match(server, /stopFootballScheduler\(\)/);
  assert.match(server, /pool\.end\(\)/);
});
