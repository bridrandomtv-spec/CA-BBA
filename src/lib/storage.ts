/**
 * Accès centralisé au localStorage.
 *
 * Deux raisons d'exister :
 *  1. localStorage lève une exception (SecurityError / QuotaExceededError) en
 *     navigation privée Safari ou quand l'utilisateur bloque le stockage.
 *     Un appel non protégé dans un initialiseur de useState fait planter tout
 *     le rendu React — écran blanc, sans message.
 *  2. Les clés étaient dispersées dans six fichiers, avec des conventions
 *     différentes (`cabba-theme` vs `cabba_favorites`). Les regrouper ici évite
 *     qu'un composant lise une clé que personne n'écrit.
 *
 * Les noms de clés historiques sont conservés tels quels : les changer
 * réinitialiserait les préférences des utilisateurs déjà installés.
 */

export const STORAGE_KEYS = {
  theme: 'cabba-theme',
  onboarded: 'cabba-onboarded',
  notifications: 'cabba-notifications',
  /** Verrue historique : underscore au lieu du tiret. Conservé volontairement. */
  favorites: 'cabba_favorites',
  appLang: 'cabba-app-lang',
  userAvatar: 'cabba-user-avatar',
  /**
   * Consentement analytics (RGPD) : 'granted' | 'denied' ;
   * clé absente = aucun choix, le bandeau s'affiche.
   */
  analyticsConsent: 'cabba-consent-analytics',
  /**
   * Conversation de l'assistant IA : les 40 derniers tours, par appareil.
   * Sérialisée en JSON avec timestamps ISO — les `Date` ne survivent pas
   * telles quelles à localStorage.
   */
  assistantHistory: 'cabba-assistant-history',
} as const;

export function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible : la valeur reste valable pour la session courante */
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignoré */
  }
}

/**
 * Lit une valeur JSON. Renvoie `fallback` si la clé est absente, si le JSON est
 * corrompu, ou si le stockage est inaccessible — jamais d'exception.
 */
export function readJSON<T>(key: string, fallback: T): T {
  const raw = readString(key);
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    writeString(key, JSON.stringify(value));
  } catch {
    /* valeur non sérialisable : on n'écrit rien plutôt que d'écrire du JSON invalide */
  }
}
