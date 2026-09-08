// Client partagé pour /api/football/team-summary.
// Un seul module pour Home, TeamStats et SeasonStats : mêmes types, même
// tolérance aux erreurs (réponse non-JSON, route absente, API-Football non
// configurée → EMPTY_TEAM_SUMMARY, jamais d'exception vers le rendu).

export interface TeamSummaryMatch {
  id: string;
  date: string;                 // 'YYYY-MM-DD' (formaté côté serveur)
  opponent: string;
  venue: 'home' | 'away';
  goalsFor: number;
  goalsAgainst: number;
  result: 'W' | 'D' | 'L';
}

export interface TeamStandings {
  rank: number;
  points: number;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
  goalsDiff: number;
  form: string | null;
}

export interface TeamSummary {
  configured: boolean;
  standings: TeamStandings | null;
  matches: TeamSummaryMatch[];  // plus récent d'abord (max 30)
}

export const EMPTY_TEAM_SUMMARY: TeamSummary = {
  configured: false,
  standings: null,
  matches: [],
};

const asNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

export async function fetchTeamSummary(): Promise<TeamSummary> {
  try {
    const response = await fetch('/api/football/team-summary', { credentials: 'same-origin' });
    if (!response.ok) return EMPTY_TEAM_SUMMARY;

    const data = await response.json().catch(() => null);
    if (!data || typeof data !== 'object') return EMPTY_TEAM_SUMMARY;

    const standingsRaw = (data as { standings?: Record<string, unknown> | null }).standings;
    const matchesRaw = (data as { matches?: unknown }).matches;

    return {
      configured: Boolean((data as { configured?: unknown }).configured),
      standings: standingsRaw
        ? {
            rank: asNumber(standingsRaw.rank),
            points: asNumber(standingsRaw.points),
            played: asNumber(standingsRaw.played),
            win: asNumber(standingsRaw.win),
            draw: asNumber(standingsRaw.draw),
            lose: asNumber(standingsRaw.lose),
            goalsFor: asNumber(standingsRaw.goalsFor),
            goalsAgainst: asNumber(standingsRaw.goalsAgainst),
            goalsDiff: asNumber(standingsRaw.goalsDiff),
            form: typeof standingsRaw.form === 'string' ? standingsRaw.form : null,
          }
        : null,
      matches: Array.isArray(matchesRaw)
        ? (matchesRaw as TeamSummaryMatch[]).filter(
            (match) => match && typeof match.id === 'string' && typeof match.date === 'string',
          )
        : [],
    };
  } catch (error) {
    console.error('[CABBA] team summary:', error);
    return EMPTY_TEAM_SUMMARY;
  }
}

/** Chronologique (du plus ancien au plus récent) — pour les courbes. */
export function chronological(matches: TeamSummaryMatch[]): TeamSummaryMatch[] {
  return [...matches].reverse();
}
