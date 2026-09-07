/**
 * Lecture et validation des variables d'environnement, en un seul endroit.
 *
 * Chaque module lisait `process.env` de son côté, avec des valeurs de repli
 * silencieuses : le serveur démarrait sans un mot alors qu'il était mal
 * configuré, et le problème n'apparaissait qu'à la première requête.
 *
 * Règle appliquée ici : en production, une variable indispensable qui manque
 * arrête le processus. En développement, on tolère l'absence mais on le dit.
 */

import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

export const isProduction = process.env.NODE_ENV === 'production';

/** Longueur minimale acceptée pour le secret de signature des sessions. */
const MIN_SECRET_LENGTH = 32;

function fatal(message: string): never {
  console.error(`[CABBA] configuration invalide : ${message}`);
  console.error('[CABBA] Copiez .env.example vers .env et renseignez les variables manquantes.');
  process.exit(1);
}

/**
 * Secret de signature des JWT de session.
 *
 * L'ancienne valeur de repli (`'fallback-secret-do-not-use-in-prod'`) était
 * publiée dans le dépôt : n'importe qui pouvait forger un cookie de session
 * portant `role: "admin"`. Il n'y a donc plus de repli en production.
 *
 * En développement, un secret aléatoire est tiré à chaque démarrage : les
 * sessions ouvertes sont invalidées à chaque redémarrage, ce qui est sans
 * conséquence en local et évite d'avoir un secret connu qui traîne.
 */
function readSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    if (isProduction) {
      fatal('SESSION_SECRET est absente. Sans elle les sessions ne peuvent pas être signées.');
    }
    console.warn(
      '[CABBA] SESSION_SECRET absente : un secret temporaire est généré pour cette session de ' +
        'développement. Les connexions seront perdues au prochain redémarrage.',
    );
    return randomBytes(48).toString('hex');
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    const message = `SESSION_SECRET fait ${secret.length} caractères, ${MIN_SECRET_LENGTH} au minimum sont attendus.`;
    if (isProduction) fatal(message);
    console.warn(`[CABBA] ${message}`);
  }

  return secret;
}

function readDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;

  if (!url) {
    if (isProduction) {
      fatal("DATABASE_URL est absente. L'application ne peut pas fonctionner sans base de données.");
    }
    console.warn(
      "[CABBA] DATABASE_URL absente : toutes les requêtes PostgreSQL échoueront. " +
        'Renseignez-la dans .env pour utiliser les écrans qui lisent la base.',
    );
  }

  return url;
}

function readGeminiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY;

  // L'assistant est une fonctionnalité parmi d'autres : son absence dégrade
  // l'application mais ne l'empêche pas de servir. On avertit sans arrêter,
  // même en production, et /api/chat répond 503 de façon explicite.
  if (!key) {
    console.warn(
      "[CABBA] GEMINI_API_KEY absente : l'assistant renverra une erreur 503. " +
        'Renseignez-la dans .env pour l’activer.',
    );
  }

  return key;
}

function readTrustProxy(): boolean | number {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw) return false;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0) {
    fatal(`TRUST_PROXY invalide : \"${raw}\". Utilisez true, false ou un nombre de sauts.`);
  }
  return hops;
}

function readPort(): number {
  const raw = process.env.PORT;
  if (!raw) return 3000;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fatal(`PORT invalide : "${raw}". Utilisez un entier entre 1 et 65535.`);
  }
  return port;
}

export const env = {
  isProduction,
  port: readPort(),
  host: process.env.HOST ?? '0.0.0.0',
  trustProxy: readTrustProxy(),
  sessionSecret: readSessionSecret(),
  databaseUrl: readDatabaseUrl(),
  geminiApiKey: readGeminiKey(),
  apiFootballKey: process.env.API_FOOTBALL_KEY,
  apiFootballLeagueId: process.env.API_FOOTBALL_LEAGUE_ID ? Number(process.env.API_FOOTBALL_LEAGUE_ID) : undefined,
  apiFootballTeamId: process.env.API_FOOTBALL_TEAM_ID ? Number(process.env.API_FOOTBALL_TEAM_ID) : undefined,
  apiFootballSeason: process.env.API_FOOTBALL_SEASON ? Number(process.env.API_FOOTBALL_SEASON) : undefined,
  apiFootballDailyQuota: Number(process.env.API_FOOTBALL_DAILY_QUOTA ?? 90),
  apiFootballTimeoutMs: Number(process.env.API_FOOTBALL_TIMEOUT_MS ?? 8000),
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidSubject: process.env.VAPID_SUBJECT,
  r2AccountId: process.env.R2_ACCOUNT_ID,
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  r2Bucket: process.env.R2_BUCKET,
  r2PublicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM,
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  footballSchedulerEnabled: process.env.FOOTBALL_SCHEDULER_ENABLED === undefined
    ? !isProduction
    : process.env.FOOTBALL_SCHEDULER_ENABLED === 'true',
} as const;
