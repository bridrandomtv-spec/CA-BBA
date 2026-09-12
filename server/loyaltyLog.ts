// Fidélité : écriture de points non bloquante (un échec de ledger
// ne casse jamais le scan, la commande ou le pronostic).

import { query } from './db/index.js';

export async function addPoints(userId: string, delta: number, reason: string, ref = ''): Promise<void> {
  try {
    await query(
      `INSERT INTO loyalty_ledger (user_id, delta, reason, ref) VALUES ($1,$2,$3,$4)`,
      [userId, delta, reason, ref.slice(0, 120)],
    );
  } catch (err) {
    console.error('[CABBA] loyalty ledger:', err);
  }
}

export function tierOf(total: number): 'bronze' | 'silver' | 'gold' {
  return total >= 300 ? 'gold' : total >= 100 ? 'silver' : 'bronze';
}
