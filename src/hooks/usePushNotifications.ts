import { useCallback, useEffect, useState } from 'react';
import type { NotificationSettings } from './useNotificationSettings';

interface PushState {
  enabled: boolean;
  publicKey: string | null;
  subscribed: boolean;
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function getConfig() {
  const response = await fetch('/api/push/config', { credentials: 'include' });
  if (!response.ok) throw new Error('Push config unavailable');
  return response.json() as Promise<{ enabled: boolean; publicKey: string | null }>;
}

export default function usePushNotifications() {
  const [state, setState] = useState<PushState>({ enabled: false, publicKey: null, subscribed: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [config, saved] = await Promise.all([
        getConfig(),
        fetch('/api/push/state', { credentials: 'include' }).then((r) => r.ok ? r.json() : ({ subscribed: false })),
      ]);
      setState({ enabled: Boolean(config.enabled && config.publicKey), publicKey: config.publicKey, subscribed: Boolean(saved.subscribed) });
    } catch {
      setState((prev) => ({ ...prev, enabled: false }));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const enable = useCallback(async (settings: NotificationSettings) => {
    if (!state.enabled || !state.publicKey || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      throw new Error('Web Push n’est pas disponible sur ce navigateur.');
    }
    setBusy(true);
    try {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Permission de notification refusée.');
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(state.publicKey) });
      const response = await fetch('/api/push/subscribe', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription.toJSON()) });
      if (!response.ok) throw new Error('Impossible d’enregistrer les notifications.');
      await fetch('/api/push/preferences', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      setState((prev) => ({ ...prev, subscribed: true }));
    } finally { setBusy(false); }
  }, [state.enabled, state.publicKey]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/subscribe', { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setState((prev) => ({ ...prev, subscribed: false }));
    } finally { setBusy(false); }
  }, []);

  const syncPreferences = useCallback(async (settings: NotificationSettings) => {
    if (!state.subscribed) return;
    await fetch('/api/push/preferences', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
  }, [state.subscribed]);

  const test = useCallback(async () => {
    const response = await fetch('/api/push/test', { method: 'POST', credentials: 'include' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Échec du test');
    return data;
  }, []);

  return { ...state, loading, busy, enable, disable, syncPreferences, test, refresh };
}
