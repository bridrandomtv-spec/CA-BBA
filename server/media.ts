import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { env } from './env.js';

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
]);

const MAX_BYTES: Record<string, number> = {
  image: 10 * 1024 * 1024,
  video: 250 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
};

function getClient(): S3Client {
  if (!env.r2AccountId || !env.r2AccessKeyId || !env.r2SecretAccessKey || !env.r2Bucket) {
    throw new Error('R2_NOT_CONFIGURED');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.r2AccessKeyId,
      secretAccessKey: env.r2SecretAccessKey,
    },
  });
}

function mediaKind(contentType: string): 'image' | 'video' | 'audio' | null {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  return null;
}

function extension(contentType: string): string {
  const ext = contentType.split('/')[1]?.split('+')[0]?.toLowerCase();
  return ext === 'jpeg' ? 'jpg' : ext || 'bin';
}

export function isR2Configured(): boolean {
  return Boolean(env.r2AccountId && env.r2AccessKeyId && env.r2SecretAccessKey && env.r2Bucket);
}

export function publicMediaUrl(key: string): string | null {
  if (!env.r2PublicBaseUrl) return null;
  return `${env.r2PublicBaseUrl.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export async function createUploadUrl(params: {
  userId: string;
  fileName: string;
  contentType: string;
  size: number;
  folder?: string;
}) {
  const client = getClient();
  const { userId, fileName, contentType, size } = params;
  if (!ALLOWED_TYPES.has(contentType)) throw new Error('UNSUPPORTED_MEDIA_TYPE');
  const kind = mediaKind(contentType);
  if (!kind || size <= 0 || size > MAX_BYTES[kind]) throw new Error('MEDIA_TOO_LARGE');

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || `file.${extension(contentType)}`;
  const folder = (params.folder || kind).replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '') || kind;
  const key = `media/${folder}/${userId}/${randomUUID()}-${safeName}`;
  const expiresIn = 600;

  const command = new PutObjectCommand({
    Bucket: env.r2Bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn });

  return { key, uploadUrl, expiresIn, kind, publicUrl: publicMediaUrl(key) };
}

export async function deleteMedia(key: string): Promise<void> {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: env.r2Bucket, Key: key }));
}
