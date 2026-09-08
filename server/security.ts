import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  limit: number;
  message?: string;
  keyPrefix?: string;
  /**
   * Identité limitée. Par défaut : l'adresse IP (via `trust proxy`).
   * Une `keyFn` permet de limiter par compte (ex. /api/chat par `req.user.id`) :
   * derrière un NAT — campus, cybercafé, réseau mobile — des dizaines
   * d'utilisateurs partagent une IP et se voleraient mutuellement leur quota.
   * La keyFn est appelée APRÈS le middleware d'authentification lorsque le
   * quota doit porter sur le compte.
   */
  keyFn?: (req: Parameters<RequestHandler>[0]) => string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Petit rate limiter mémoire, adapté à un serveur CABBA mono-instance.
 * Pour plusieurs instances, REDIS_URL active le backend partagé de
 * server/rateLimit.ts — ce limiteur mémoire y sert de repli automatique.
 */
export function createRateLimiter({ windowMs, limit, message, keyPrefix = 'global', keyFn }: RateLimitOptions): RequestHandler {
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

    const identity = keyFn ? keyFn(req) : (req.ip || req.socket.remoteAddress || 'unknown');
    const key = `${keyPrefix}:${identity}`;
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

/**
 * Origine R2 dérivée de R2_PUBLIC_BASE_URL, si définie et valide.
 * Les uploads PUT pré-signés (MediaUploader) sont des fetch navigateur :
 * ils doivent être explicitement autorisés par `connect-src`.
 */
function r2OriginForCsp(): string | null {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) return null;
  try {
    return new URL(base).origin;
  } catch {
    console.warn('[CABBA] R2_PUBLIC_BASE_URL invalide : ignorée dans la CSP.');
    return null;
  }
}

/** En-têtes de sécurité sans dépendance supplémentaire. */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  if (process.env.NODE_ENV === 'production') {
    const r2Origin = r2OriginForCsp();
    const r2Suffix = r2Origin ? ` ${r2Origin}` : '';

    // Politique finale :
    //  - script-src 'self' : build Vite 100 % externe (polyfill modulepreload
    //    désactivé dans vite.config.ts, SW versionné par le build) ;
    //  - style-src 'unsafe-inline' conservé : React pose des attributs style={} ;
    //  - font-src 'self' data: : polices auto-hébergées ;
    //  - frame-src : résumés vidéo YouTube (MatchHighlights) — sans cette
    //    directive, le repli default-src 'self' bloquerait les iframes ;
    //  - frame-ancestors 'none' : personne n'intègre CABBA dans une iframe ;
    //  - img/media-src https: : logos d'équipes (API-Football) et médias R2 ;
    //  - connect-src 'self' (+ R2) : Gemini/Resend/API-Football restent côté
    //    serveur, le SSE est même-origine.
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `media-src 'self' blob: https:${r2Suffix}`,
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
      `connect-src 'self'${r2Suffix}`,
    ].join('; ') + ';';

    res.setHeader('Content-Security-Policy', csp);
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
