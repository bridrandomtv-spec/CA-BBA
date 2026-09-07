import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  limit: number;
  message?: string;
  keyPrefix?: string;
}

/**
 * Petit rate limiter mémoire, adapté à un serveur CABBA mono-instance.
 * Il ne remplace pas un rate limiter distribué si plusieurs instances sont
 * déployées : dans ce cas, déplacer le compteur vers Redis/Upstash.
 */
export function createRateLimiter({ windowMs, limit, message, keyPrefix = 'global' }: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();
  let lastCleanup = Date.now();

  return (req, res, next) => {
    const now = Date.now();
    if (now - lastCleanup > windowMs) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
      lastCleanup = now;
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(0, limit - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > limit) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      res.status(429).json({ error: message ?? 'Too many requests. Please try again later.' });
      return;
    }

    next();
  };
}

/** En-têtes de sécurité sans dépendance supplémentaire. */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // CSP suffisamment permissive pour les médias R2 et les connexions SSE,
  // tout en interdisant les frames tierces et les destinations arbitraires.
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; " +
        "object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https:; " +
        "img-src 'self' data: blob: https:; font-src 'self' data: https:; " +
        "media-src 'self' blob: https:; connect-src 'self' https: wss:;",
    );
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

/** Identifiant de corrélation renvoyé au client et ajouté aux logs serveur. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get('X-Request-ID');
  const id = incoming && /^[A-Za-z0-9._:-]{1,100}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-ID', id);
  res.locals.requestId = id;
  next();
};
