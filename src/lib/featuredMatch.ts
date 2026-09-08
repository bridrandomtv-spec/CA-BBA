// Résolution de la rencontre pertinente, partagée par MatchMVP,
// InGameNotifications et MatchStatsVisualization : sans `matchId` fourni,
// on cible le match en direct, sinon le dernier match terminé synchronisé
// (seuls ceux-ci ont lineups/statistiques/événements en base).

import type { Match } from '../types';

function toMatchArray(payload: unknown): Match[] {
  if (Array.isArray(payload)) return payload as Match[];
  if (payload && typeof payload === 'object') {
    const nested = (payload as { matches?: unknown }).matches;
    if (Array.isArray(nested)) return nested as Match[];
  }
  return [];
}

export async function resolveFeaturedMatchId(): Promise<string | null> {
  try {
    const res = await fetch('/api/matches', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const matches = toMatchArray(await res.json());
    const live = matches.find((match) => match.status === 'live');
    if (live) return live.id;
    const synced = matches.find((match) => match.status === 'finished' && match.apiFixtureId != null);
    return synced?.id ?? null;
  } catch (error) {
    console.error('[CABBA] featured match:', error);
    return null;
  }
}
