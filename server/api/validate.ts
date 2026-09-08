// Validation partagée des entrées (CRUD admin et publications).
//
// Findings couverts :
//  1. `if (!title)` acceptait toute valeur truthy : `title: 123` était stocké
//     « 123 », `title: {a:1}` faisait lever pg → 500 au lieu d'un 400 ;
//  2. aucune borne de longueur : title > 255 (VARCHAR(255), migration 002)
//     → erreur PG 22001 → 500 illisible pour l'admin ;
//  3. URLs jamais validées : une chaîne arbitraire (y compris `javascript:`)
//     pouvait être stockée puis servie à tous les écrans.

/** Erreur de validation : les routeurs la convertissent en 400 JSON. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/** Bornes alignées sur le schéma (migration 002) et sur express.json (128 Ko). */
export const LIMITS = {
  title: 255,        // VARCHAR(255)
  category: 100,     // VARCHAR(100)
  url: 2_048,        // TEXT, mais une URL au-delà est suspecte
  text: 100_000,     // TEXT : plafond métier (description, content, lyrics)
} as const;

export function requireString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${field} est requis.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new ValidationError(`${field} dépasse ${max} caractères.`);
  }
  return trimmed;
}

/** Champ optionnel : absent/null → null ; présent mais invalide → erreur. */
export function optionalString(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} doit être une chaîne.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new ValidationError(`${field} dépasse ${max} caractères.`);
  }
  return trimmed || null;
}

export function requireHttpUrl(value: unknown, field: string): string {
  const raw = requireString(value, field, LIMITS.url);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ValidationError(`${field} doit être une URL valide.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ValidationError(`${field} doit utiliser http(s).`);
  }
  return raw;
}

export function optionalHttpUrl(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requireHttpUrl(value, field);
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${field} doit être un booléen.`);
  }
  return value;
}

/** 'YYYY-MM-DD' strict : évite les casts timestamptz surprises en 500. */
export function requireDateString(value: unknown, field: string): string {
  const raw = requireString(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
    throw new ValidationError(`${field} doit être une date AAAA-MM-JJ.`);
  }
  return raw;
}
