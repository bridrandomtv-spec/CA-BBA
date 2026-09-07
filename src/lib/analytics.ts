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

let lastPage = '';

export async function track(eventName: AnalyticsEvent, metadata: Record<string, unknown> = {}, path = window.location.pathname) {
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
