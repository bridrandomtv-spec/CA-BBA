import { EventEmitter } from 'node:events';

export type FootballMatchChangeReason = 'fixture' | 'events' | 'lineups' | 'statistics';

export interface FootballMatchChangedEvent {
  matchId: string;
  fixtureId: number;
  reason: FootballMatchChangeReason;
  updatedAt: string;
}

export const footballEvents = new EventEmitter();

/**
 * Un listener par flux SSE ouvert + ceux du scheduler. 1 000 couvre un pic de
 * match en direct très suivi sur UNE instance ; au-delà, Node émet
 * MaxListenersExceededWarning — soit un pic réel à surveiller, soit une fuite
 * de listeners à corriger. L'ancien `setMaxListeners(0)` (illimité) masquait
 * les deux : une connexion SSE jamais fermée fuyait en silence jusqu'à
 * l'épuisement mémoire du worker.
 */
footballEvents.setMaxListeners(1000);
