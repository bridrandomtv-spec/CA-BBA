/*
 * Service Worker — منصة أنصار الكابا (CABBA)
 *
 * Stratégies :
 *  - التنقل (navigation) : الشبكة أولاً، مع الرجوع إلى النسخة المخزنة عند انقطاع الاتصال.
 *  - الملفات الثابتة (JS/CSS/صور/خطوط) : stale-while-revalidate.
 *  - نداءات /api/ وكل ما ليس GET : لا تخزين إطلاقاً (تمرير مباشر إلى الشبكة).
 *
 * Incrémenter CACHE_VERSION à chaque déploiement qui change l'app shell.
 */

// `__BUILD_ID__` est remplacé par un hash unique à chaque `npm run build`
// (plugin cabba-sw-version dans vite.config.ts) : plus besoin d'incrémenter
// CACHE_VERSION à la main. Si le placeholder survit (service direct de
// public/ hors build), la version reste stable — sans conséquence, le SW
// n'étant enregistré qu'en production.
const CACHE_VERSION = '__BUILD_ID__';
const STATIC_CACHE = `cabba-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `cabba-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = '/index.html';

// On ne précache que le strict minimum : les bundles de Vite portent un hash
// qui change à chaque build, ils sont donc mis en cache à l'exécution.
const APP_SHELL = ['/', OFFLINE_URL, '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // addAll échoue en bloc si une seule URL renvoie 404 : on tolère les absences.
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('cabba-') && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.disable();
      }
      await self.clients.claim();
    })(),
  );
});

// Permet à la page de forcer l'activation d'une nouvelle version.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

const isStaticAsset = (request) =>
  ['script', 'style', 'image', 'font'].includes(request.destination);

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = (await cache.match(request)) || (await caches.match(OFFLINE_URL));
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached || (await network) || Response.error();
}

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const title = payload.title || 'CABBA';
  const options = {
    body: payload.body || 'لديك تحديث جديد من الكابا.',
    icon: '/icon-192.png', badge: '/icon-192.png',
    tag: payload.tag || 'cabba-notification',
    data: payload.data || { url: payload.url || '/' },
    dir: 'rtl', lang: 'ar',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const existing = list.find((client) => 'focus' in client);
    if (existing) { existing.navigate(target); return existing.focus(); }
    return clients.openWindow(target);
  }));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // On ne touche jamais aux requêtes non-GET (POST /api/chat notamment).
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // L'API doit toujours partir sur le réseau : une réponse de chat mise en cache
  // serait servie indéfiniment.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Fichiers du site (polices Cairo comprises — auto-hébergées, la branche
  // Google Fonts n'a plus de raison d'être et laisserait le worker mettre en
  // cache des réponses opaques d'un tiers qui n'est plus jamais contacté).
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && isStaticAsset(request)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
