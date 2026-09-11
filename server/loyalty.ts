// وفاء الجراد — moteur de fidélité : grand livre de points, paliers,
// et fonction grantPoints utilisée par les autres routes (scan,
// commandes, admin). Un échec de grant ne casse jamais l'action source.

import { query } from './db/index.js';

export interface LoyaltyTier { key: string; label: string; min: number; }

export const TIERS: LoyaltyTier[] = [
  { key: 'gold', label: 'جراد ذهبي', min: 300 },
  { key: 'silver', label: 'جراد فضي', min: 150 },
  { key: 'bronze', label: 'جراد برونزي', min: 50 },
  { key: 'member', label: 'عضو وفيّ', min: 0 },
];

export function tierOf(points: number): LoyaltyTier {
  return TIERS.find((t) => points >= t.min) ?? TIERS[TIERS.length - 1];
}

export async function grantPoints(
  userId: string,
  delta: number,
  reason: string,
  ref = '',
): Promise<void> {
  if (!userId || !Number.isInteger(delta) || delta === 0) return;
  try {
    await query(
      `INSERT INTO loyalty_ledger (user_id, delta, reason, ref) VALUES ($1,$2,$3,$4)`,
      [userId, delta, reason.slice(0, 60), ref.slice(0, 120)],
    );
  } catch (err) {
    console.error('[CABBA] loyalty grant:', err);
  }
}

export async function pointsOf(userId: string): Promise<number> {
  const r = await query(
    `SELECT COALESCE(SUM(delta),0)::int AS points FROM loyalty_ledger WHERE user_id=$1`,
    [userId],
  );
  return Number(r.rows[0].points);
}
