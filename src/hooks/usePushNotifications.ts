// usePushNotifications — robustesse de la chaîne push :
//  1. enable() : si POST /api/push/subscribe échouait APRÈS
//     pushManager.subscribe(), le navigateur restait abonné sans cible côté
//     serveur — état zombie invisible. Rollback ajouté.
//  2. enable()/disable() ne lèvent plus (appels `void` côté UI = rejets non
//     gérés) : résultat { ok, error }. test() lève encore — son appelant
//     l'encadre d'un try/catch avec repli local.
//  3. disable() : unsubscribe local systématique même si le DELETE serveur
//     échoue (le serveur nettoiera sur 410/404 du push service).
//  4. syncPreferences() ne lève plus sur panne réseau.
//  5. Événements 'push_subscribed'/'push_unsubscribed' de la liste blanche
//     analytics enfin émis (via track → conditionnés au consentement).
import { useCallback, useEffect, useState } from 'react';
import type { NotificationSettings } from './useNotificationSettings';
import { track } from '../lib/analytics';

interface PushState {
  enabled: boolean;
  publicKey: string | null;
  subscribed: boolean;
}

/** Résultat des actions qui ne doivent plus lever (appels `void` côté UI). */
export interface PushActionResult {
  ok: boolean;
  error?: string;
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function getConfig() {
  const response = await fetch('/api/push/config', { credentials: 'same-origin' });
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
        fetch('/api/push/state', { credentials: 'same-origin' }).then((r) => r.ok ? r.json() : ({ subscribed: false })),
      ]);
      setState({ enabled: Boolean(config.enabled && config.publicKey), publicKey: config.publicKey, subscribed: Boolean(saved.subscribed) });
    } catch {
      setState((prev) => ({ ...prev, enabled: false }));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const enable = useCallback(async (settings: NotificationSettings): Promise<PushActionResult> => {
    if (!state.enabled || !state.publicKey || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return { ok: false, error: 'Web Push n’est pas disponible sur ce navigateur.' };
    }

    setBusy(true);
    let subscription: PushSubscription | null = null;
    let createdHere = false;

    try {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();

      if (permission !== 'granted') {
        return {
          ok: false,
          error: permission === 'denied'
            ? 'إذن الإشعارات مرفوض في إعدادات المتصفح.'
            : 'Permission de notification refusée.',
        };
      }

      const registration = await navigator.serviceWorker.ready;
      subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(state.publicKey),
        });
        createdHere = true;
      }

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error(`subscribe → ${response.status}`);

      // L'échec de la synchro des préférences n'invalide pas l'abonnement :
      // le serveur applique ses valeurs par défaut et le prochain toggle
      // renverra l'état complet.
      await fetch('/api/push/preferences', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      }).catch((error) => console.warn('[CABBA] push preferences:', error));

      setState((prev) => ({ ...prev, subscribed: true }));
      void track('push_subscribed');
      return { ok: true };
    } catch (error) {
      console.error('[CABBA] activation push :', error);
      // Rollback : une souscription créée ici puis rejetée par le serveur ne
      // doit pas survivre — elle serait impossible à nettoyer via l'UI.
      if (createdHere && subscription) {
        await subscription.unsubscribe().catch(() => {});
      }
      return { ok: false, error: 'Impossible d’enregistrer les notifications.' };
    } finally {
      setBusy(false);
    }
  }, [state.enabled, state.publicKey]);

  const disable = useCallback(async (): Promise<PushActionResult> => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        // Ordre volontaire : DELETE d'abord (best-effort), unsubscribe local
        // ENSUITE et quoi qu'il arrive. Un DELETE en échec laisse au serveur
        // le soin de nettoyer la ligne sur réponse 410/404 du push service.
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch((error) => console.warn('[CABBA] push DELETE:', error));

        await subscription.unsubscribe().catch((error: unknown) =>
          console.warn('[CABBA] unsubscribe local:', error),
        );
      }

      setState((prev) => ({ ...prev, subscribed: false }));
      void track('push_unsubscribed');
      return { ok: true };
    } catch (error) {
      console.error('[CABBA] désactivation push :', error);
      setState((prev) => ({ ...prev, subscribed: false }));
      return { ok: false, error: 'Impossible de désactiver les notifications.' };
    } finally {
      setBusy(false);
    }
  }, []);

  const syncPreferences = useCallback(async (settings: NotificationSettings): Promise<void> => {
    if (!state.subscribed) return;
    try {
      await fetch('/api/push/preferences', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    } catch (error) {
      // Appelé en `void push.syncPreferences(...)` par les écrans de réglages :
      // lever ici produirait un rejet non géré. Journaliser suffit.
      console.warn('[CABBA] sync préférences push échouée :', error);
    }
  }, [state.subscribed]);

  const test = useCallback(async () => {
    // Seule action qui lève encore : son appelant (triggerTestNotification
    // dans NotificationCenter) l'encadre d'un try/catch avec repli local.
    const response = await fetch('/api/push/test', { method: 'POST', credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Échec du test');
    return data;
  }, []);

  return { ...state, loading, busy, enable, disable, syncPreferences, test, refresh };
}
