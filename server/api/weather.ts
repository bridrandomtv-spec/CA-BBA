// Proxy météo serveur : le navigateur appelle /api/weather, jamais open-meteo.
//
// Trois raisons :
//  1. CSP : connect-src est borné à 'self' (+R2) — un fetch direct vers
//     api.open-meteo.com serait bloqué en production ;
//  2. cohérence avec API-Football : « le navigateur ne contacte jamais le
//     fournisseur » est déjà la règle du projet ;
//  3. cache 10 min + single-flight : UNE requête fournisseur pour toute la
//     base utilisateurs, au lieu d'une par client toutes les 15 minutes.
//
// Monté sous /api : le rate limiter global (120/min/IP) s'applique déjà.

import { Router } from 'express';

export const weatherRouter = Router();

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

// Coordonnées du stade du 20-Août, Bordj Bou Arreridj — fixes, ce ne sont
// pas des entrées utilisateur : aucune injection possible dans l'URL.
const STADIUM_LAT = 36.0732;
const STADIUM_LON = 4.7611;

/** Fraîcheur acceptable pour une météo de stade : 10 minutes. */
const CACHE_TTL_MS = 10 * 60_000;

/** Budget fournisseur : au-delà, on échoue vite et on sert le cache périmé. */
const FETCH_TIMEOUT_MS = 5_000;

interface CachedWeather {
  payload: unknown;
  fetchedAt: number;
  expiresAt: number;
}

let cache: CachedWeather | null = null;
let inflight: Promise<unknown> | null = null;

async function fetchFromProvider(): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url =
      `${OPEN_METEO_URL}?latitude=${STADIUM_LAT}&longitude=${STADIUM_LON}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&wind_speed_unit=kmh`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`open-meteo a répondu ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

weatherRouter.get('/', async (_req, res) => {
  const now = Date.now();

  // 1. Cache frais : réponse immédiate, zéro appel fournisseur.
  if (cache && cache.expiresAt > now) {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(cache.payload);
    return;
  }

  try {
    // 2. Single-flight : N clients simultanés ne déclenchent qu'UNE requête
    //    fournisseur — les suivants attendent la même promesse.
    if (!inflight) {
      inflight = fetchFromProvider().finally(() => {
        inflight = null;
      });
    }
    const payload = await inflight;
    cache = { payload, fetchedAt: now, expiresAt: now + CACHE_TTL_MS };
    res.set('Cache-Control', 'public, max-age=60');
    res.json(payload);
  } catch (error) {
    // 3. Fournisseur en panne : on sert le cache périmé (mieux qu'un écran
    //    d'erreur pour une donnée décorative), sinon 502 explicite.
    if (cache) {
      const ageMin = Math.round((now - cache.fetchedAt) / 60_000);
      console.warn(`[CABBA] météo : fournisseur injoignable, cache périmé servi (${ageMin} min).`);
      res.set('Cache-Control', 'public, max-age=60');
      res.json(cache.payload);
      return;
    }
    console.error('[CABBA] météo :', error instanceof Error ? error.message : error);
    res.status(502).json({ error: 'Données météo indisponibles' });
  }
});
