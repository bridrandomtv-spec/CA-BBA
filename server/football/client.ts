import { env } from '../env.js';

const BASE_URL = 'https://v3.football.api-sports.io';
const DEFAULT_TIMEOUT_MS = 8_000;

let usedToday = 0;
let quotaDay = new Date().toISOString().slice(0, 10);

function resetQuotaIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== quotaDay) {
    quotaDay = today;
    usedToday = 0;
  }
}

export class FootballApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'FootballApiError';
    this.status = status;
  }
}

export function footballQuotaStatus() {
  resetQuotaIfNeeded();
  return {
    date: quotaDay,
    used: usedToday,
    limit: env.apiFootballDailyQuota,
    remaining: Math.max(0, env.apiFootballDailyQuota - usedToday),
  };
}

export async function footballApi<T = unknown>(
  endpoint: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  if (!env.apiFootballKey) throw new FootballApiError('API_FOOTBALL_KEY is not configured');
  resetQuotaIfNeeded();
  if (usedToday >= env.apiFootballDailyQuota) {
    throw new FootballApiError(`Daily API-Football quota reached (${env.apiFootballDailyQuota})`);
  }

  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.apiFootballTimeoutMs ?? DEFAULT_TIMEOUT_MS);
  usedToday += 1;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'x-apisports-key': env.apiFootballKey },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null) as any;
    if (!response.ok) {
      throw new FootballApiError(body?.message || `API-Football HTTP ${response.status}`, response.status);
    }
    if (body?.errors && Object.keys(body.errors).length > 0) {
      throw new FootballApiError(`API-Football error: ${JSON.stringify(body.errors)}`);
    }
    return body as T;
  } catch (error) {
    // Connexion jamais établie (DNS refusé, TCP reset → TypeError de fetch) :
    // la requête n'a pas atteint le fournisseur, elle ne consomme aucun quota
    // réel — on rend l'unité au budget local. Distinction volontairement
    // prudente : AbortError (timeout) et erreurs HTTP (réponse reçue) restent
    // comptées, le fournisseur a peut-être traité l'appel.
    if (error instanceof TypeError) {
      usedToday = Math.max(0, usedToday - 1);
      throw new FootballApiError(`API-Football unreachable: ${error.message}`);
    }
    if (error instanceof FootballApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FootballApiError('API-Football request timed out');
    }
    throw new FootballApiError(error instanceof Error ? error.message : 'API-Football request failed');
  } finally {
    clearTimeout(timeout);
  }
}
