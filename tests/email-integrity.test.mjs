import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('email infrastructure exists and keeps provider server-side', () => {
  const email = read('server/email.ts');
  const env = read('server/env.ts');
  const api = read('server/api/email.ts');
  assert.match(email, /api\.resend\.com\/emails/);
  assert.match(email, /env\.resendApiKey/);
  assert.match(email, /email_log/);
  assert.match(env, /RESEND_API_KEY/);
  assert.match(env, /EMAIL_FROM/);
  assert.match(api, /requireAdmin/);
});

test('registration sends welcome email without blocking the HTTP response', () => {
  const auth = read('server/auth.ts');
  assert.match(auth, /void sendWelcomeEmail/);
  assert.match(auth, /welcome email/);
});

test('email migration has deduplication and status tracking', () => {
  const sql = read('server/db/migrations/009_email.sql');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS email_log/);
  assert.match(sql, /event_key VARCHAR\(255\) UNIQUE/);
  assert.match(sql, /status VARCHAR\(20\)/);
});
