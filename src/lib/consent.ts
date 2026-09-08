// Gestion du consentement analytics (RGPD), sans cookie côté client.
//
// Principe : la porte est côté client. Tant que le consentement n'est pas
// accordé, `track()` n'envoie rien — donc le serveur ne reçoit aucune
// requête et ne pose jamais son cookie HTTP-only anonyme. Un refus est aussi
// persistant qu'un accord : le bandeau ne se représente plus.

import { readString, writeString, removeKey, STORAGE_KEYS } from './storage';

export type ConsentChoice = 'granted' | 'denied';

/** `null` = aucun choix enregistré → le bandeau doit s'afficher. */
export function getAnalyticsConsent(): ConsentChoice | null {
  const value = readString(STORAGE_KEYS.analyticsConsent);
  return value === 'granted' || value === 'denied' ? value : null;
}

export function setAnalyticsConsent(choice: ConsentChoice): void {
  writeString(STORAGE_KEYS.analyticsConsent, choice);
}

/** Utilisé par analytics.ts : aucun événement ne part sans consentement actif. */
export function hasAnalyticsConsent(): boolean {
  return getAnalyticsConsent() === 'granted';
}

/**
 * Réinitialise le choix (bouton « سحب الموافقة » du profil) : la clé est
 * supprimée, le bandeau réapparaîtra au prochain chargement. Les événements
 * déjà envoyés côté serveur ne sont pas effaçables depuis le client —
 * l'identifiant étant aléatoire et sans IP, ils ne sont pas rattachables à
 * la personne.
 */
export function clearAnalyticsConsent(): void {
  removeKey(STORAGE_KEYS.analyticsConsent);
}
