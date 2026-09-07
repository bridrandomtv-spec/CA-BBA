import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');

test('R2 media migration defines isolated object metadata', () => {
  const sql = read('server/db/migrations/008_r2_media.sql');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS media_assets/);
  assert.match(sql, /object_key TEXT NOT NULL UNIQUE/);
  assert.match(sql, /owner_id UUID NOT NULL REFERENCES users\(id\)/);
  assert.match(sql, /status VARCHAR\(12\).*pending.*uploaded/s);
});

test('R2 credentials stay server-side and browser uses presigned upload', () => {
  const media = read('server/media.ts');
  const client = read('src/lib/mediaUpload.ts');
  assert.match(media, /r2AccessKeyId/);
  assert.match(media, /r2SecretAccessKey/);
  assert.match(client, /\/api\/media\/presign/);
  assert.match(client, /method: 'PUT'/);
  assert.doesNotMatch(client, /R2_SECRET|R2_ACCESS_KEY|R2_ACCOUNT_ID/);
});

test('media API is mounted', () => {
  const server = read('server.ts');
  assert.match(server, /mediaRouter/);
  assert.match(server, /\/api\/media/);
});
