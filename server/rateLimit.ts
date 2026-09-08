/**
 * Rate limiter à backend Redis optionnel (correctif d'audit n°8).
 *
 * Constat : `deploy/cloudrun-web.yaml` déclare `maxScale: "5"` — le limiteur
 * mémoire tient ses compteurs par instance et la limite effective vaut
 * 5 × la limite nominale.
 *
 * Comportement :
 *  - `REDIS_URL` définie + `ioredis` installé  → compteurs partagés Redis ;
 *  - `REDIS_URL` absente, paquet manquant ou Redis en panne → repli
 *    automatique sur le limiteur mémoire (security.ts) : l'API ne tombe
 *    jamais à cause du limiter ;
 *  - même signature que createRateLimiter de security.ts : les points de
 *    montage dans server.ts sont inchangés.
 *
 * Installation (uniquement si Redis est provisionné) : `npm install ioredis`.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { createRateLimiter as createMemoryRateLimiter, type RateLimitOptions } from './security.js';

/** Sous-ensemble de ioredis réellement utilisé : incrément + expiration. */
interface RedisLike {
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<unknown>;
  pttl(key: string): Promise<number>;
}

/**
 * Spécificateur dynamique VOLONTAIRE : ioredis est une dépendance optionnelle.
 * Un `import('ioredis')` littéral ferait échouer `tsc --noEmit`
 * (« Cannot find module ») tant que le paquet n'est pas installé ; avec une
 * variable, TypeScript renvoie `any` et esbuild (--packages=external) laisse
 * l'appel au runtime — une absence du paquet est rattrapée par le try/catch.
 */
const REDIS_PACKAGE = 'ioredis';

let redisPromise: Promise<RedisLike | null> | null = null;

/**
 * Connexion paresseuse et mémoïsée. `enableOfflineQueue: false` : quand Redis
 * est injoignable, les commandes échouent vite au lieu de s'accumuler — le
 * middleware bascule alors sur le limiteur mémoire.
 */
async function getRedis(): Promise<RedisLike | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (!redisPromise) {
    redisPromise = (async () => {
      try {
        const { default: Redis } = await import(REDIS_PACKAGE);
        const client = new Redis(url, {
          maxRetriesPerRequest: 2,
          enableOfflineQueue: false,
        });
        client.on('error', (error: Error) => {
          console.error('[CABBA] Redis rate-limit :', error.message);
        });
        console.log('[CABBA] rate limiter Redis activé.');
        return client as RedisLike;
      } catch (error) {
        console.warn(
          '[CABBA] REDIS_URL définie mais ioredis indisponible — repli sur le ' +
            'limiteur mémoire. Installez ioredis (`npm install ioredis`) pour ' +
            'des compteurs partagés entre instances.',
          error instanceof Error ? error.message : error,
        );
        return null;
      }
    })();
  }

  return redisPromise;
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const { windowMs, limit, message, keyPrefix = 'global', keyFn } = options;

  // Repli : le limiteur mémoire d'origine, avec ses propres compteurs. En
  // mode dégradé les compteurs Redis et mémoire divergent — acceptable, la
  // priorité est que la protection existe toujours plutôt qu'elle soit exacte.
  const memoryFallback = createMemoryRateLimiter(options);

  return (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const redis = await getRedis();
      if (!redis) {
        memoryFallback(req, res, next);
        return;
      }

      try {
        const identity = keyFn ? keyFn(req) : (req.ip || req.socket.remoteAddress || 'unknown');
        const key = `cabba:ratelimit:${keyPrefix}:${identity}`;

        // INCR puis PEXPIRE au premier coup : fenêtre fixe par clé.
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.pexpire(key, windowMs);
        }

        let ttlMs = await redis.pttl(key);
        if (ttlMs <= 0) {
          // Clé orpheline (PEXPIRE manqué) : on réarme l'expiration.
          await redis.pexpire(key, windowMs);
          ttlMs = windowMs;
        }

        const remaining = Math.max(0, limit - count);
        res.setHeader('X-RateLimit-Limit', String(limit));
        res.setHeader('X-RateLimit-Remaining', String(remaining));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil((Date.now() + ttlMs) / 1000)));

        if (count > limit) {
          res.setHeader('Retry-After', String(Math.max(1, Math.ceil(ttlMs / 1000))));
          res.status(429).json({ error: message ?? 'Too many requests. Please try again later.' });
          return;
        }

        next();
      } catch (error) {
        // Fail-open vers le limiteur mémoire : une panne Redis ne doit ni
        // couper l'API ni supprimer toute protection.
        console.error(
          '[CABBA] rate limiter Redis en échec, repli mémoire pour cette requête :',
          error instanceof Error ? error.message : error,
        );
        memoryFallback(req, res, next);
      }
    })();
  };
}
