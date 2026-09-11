// Journal d'audit : trace horodatée de chaque action admin sensible.
// L'écriture ne doit JAMAIS casser l'action elle-même : tout échec
// est journalisé en log serveur, pas renvoyé à l'appelant.

import { query } from './db/index.js';

export interface AuditActor {
  id?: string;
  displayName?: string;
  email?: string;
}

export async function logAdmin(
  actor: AuditActor | null | undefined,
  action: string,
  target = '',
  detail = '',
): Promise<void> {
  try {
    await query(
      `INSERT INTO admin_audit_log (actor_id, actor_name, action, target, detail)
       VALUES ($1,$2,$3,$4,$5)`,
      [actor?.id ?? null, actor?.displayName || actor?.email || 'système', action, target.slice(0, 200), detail.slice(0, 500)],
    );
  } catch (err) {
    console.error('[CABBA] audit log:', err);
  }
}
