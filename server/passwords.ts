/**
 * Vérification des mots de passe contre les corpus de fuites connues, via
 * l'API « Pwned Passwords » en k-anonymity : seuls les 5 premiers caractères
 * du SHA-1 quittent le serveur — le mot de passe (ni son hachage complet)
 * n'est jamais transmis.
 *
 * Tolérance aux pannes volontaire : HIBP injoignable renvoie `null` (inconnu)
 * et ne bloque pas l'inscription. Une panne d'un service tiers ne doit pas
 * mettre le club hors ligne ; le rate limit existant sur /register limite de
 * toute façon les tentatives.
 *
 * Désactivation : `PASSWORD_BREACH_CHECK=false` (ex. environnement sans
 * sortie réseau). Sortie HTTPS côté serveur : la CSP du navigateur ne
 * s'applique pas à cet appel.
 */

import crypto from 'node:crypto';

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

/** Budget de latence ajouté à l'inscription : au-delà, on renonce. */
const TIMEOUT_MS = 3_000;

const isEnabled = process.env.PASSWORD_BREACH_CHECK !== 'false';

/**
 * @returns `true`  → mot de passe retrouvé dans une fuite connue ;
 *          `false` → absent du corpus ;
 *          `null`  → vérification impossible (désactivée, réseau, timeout).
 */
export async function isPasswordCompromised(password: string): Promise<boolean | null> {
  if (!isEnabled) return null;

  const sha1 = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      signal: controller.signal,
      headers: {
        // Demande à HIBP de remplir la réponse avec des suffixes aléatoires :
        // le fournisseur ne peut pas déduire quel hachage était recherché.
        'Add-Padding': 'true',
      },
    });

    if (!response.ok) {
      console.warn(`[CABBA] HIBP a répondu ${response.status} — vérification ignorée.`);
      return null;
    }

    const body = await response.text();
    // Format : `<SUFFIXE>:<nombre>` — une ligne par hachage du préfixe.
    const compromised = body
      .split('\n')
      .some((line) => line.split(':')[0].trim().toUpperCase() === suffix);

    return compromised;
  } catch (error) {
    console.warn(
      '[CABBA] vérification HIBP indisponible (inscription non bloquée) :',
      error instanceof Error ? error.message : error,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}
