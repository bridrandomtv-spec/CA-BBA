import { EventEmitter } from 'node:events';

export type FootballMatchChangeReason = 'fixture' | 'events' | 'lineups' | 'statistics';

export interface FootballMatchChangedEvent {
  matchId: string;
  fixtureId: number;
  reason: FootballMatchChangeReason;
  updatedAt: string;
}

export const footballEvents = new EventEmitter();
footballEvents.setMaxListeners(0);
