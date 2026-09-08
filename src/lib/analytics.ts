export type AnalyticsEvent =
  | 'page_view'
  | 'feature_use'
  | 'match_view'
  | 'media_upload'
  | 'push_subscribed'
  | 'push_unsubscribed'
  | 'notification_opened'
  | 'search'
  | 'error';

import { hasAnalyticsConsent } from './consent';

let lastPage = '';

export async function track(eventName: AnalyticsEvent, metadata: Record<string, unknown> = {}, path = window.location.pathname) {
  // RGPD : sans consentement explicite, aucune requête ne part. Effet de
  // bord voulu : le cookie HTTP-only anonyme du serveur n'est posé qu'à la
  // première requête reçue — un visiteur qui refuse n'en a donc jamais.
  // Le consentement est relu à chaque appel (et non mis en cache) : un
  // retrait via le profil prend effet immédiatement, sans rechargement.
  if (!hasAnalyticsConsent()) return;

  try {
    await fetch('/api/analytics/event', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ eventName, path, metadata }),
    });
  } catch {
    // Analytics must never interfere with the application.
  }
}

export function trackPageView(path: string, metadata: Record<string, unknown> = {}) {
  if (path === lastPage) return;
  lastPage = path;
  void track('page_view', metadata, path);
}
