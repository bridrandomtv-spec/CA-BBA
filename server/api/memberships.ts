import { Router } from 'express';
import { randomInt, randomUUID } from 'node:crypto';
import { query } from '../db/index.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { isValidationError, requireString, requireDateString } from './validate.js';

export const membershipsRouter = Router();

const VALID_TYPES = ['standard', 'gold', 'vip'] as const;
const VALID_STATUSES = ['pending', 'active', 'suspended', 'expired'] as const;

/**
 * Numéro de carte unique : l'ancien `Math.floor(Math.random()*1_000_000)`
 * sur un espace de 10^6 donnait ~50 % de collision dès ~1 180 adhérents
 * (paradoxe des anniversaires) — la contrainte UNIQUE la transformait en 409
 * « Une adhésion active existe déjà », message FAUX qui envoyait l'admin
 * chercher un doublon inexistant. Tirage cryptographique + contrôle
 * d'existence + repli UUID ; la course entre deux requêtes concurrentes
 * reste tranchée par la contrainte UNIQUE et le catch discriminé.
 */
async function generateMemberNumber(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `CABBA-${String(randomInt(0, 1_000_000)).padStart(6, '0')}`;
    const existing = await query('SELECT 1 FROM memberships WHERE member_number = $1', [candidate]);
    if (!existing.rows.length) return candidate;
  }
  return `CABBA-${randomUUID().slice(0, 8).toUpperCase()}`;
}

const mapMembership = (row: any) => ({
  id: row.id, userId: row.user_id, userName: row.user_name ?? '',
  memberNumber: row.member_number, type: row.type, status: row.status,
  startDate: row.start_date, expirationDate: row.expiration_date,
  createdAt: new Date(row.created_at).getTime(),
});

membershipsRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT m.*, u.display_name AS user_name FROM memberships m
       JOIN users u ON u.id=m.user_id WHERE m.user_id=$1
       ORDER BY m.created_at DESC LIMIT 1`, [req.user!.id],
    );
    res.json({ membership: result.rows[0] ? mapMembership(result.rows[0]) : null });
  } catch (error) {
    console.error('[CABBA] membership me:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

membershipsRouter.get('/', requireAdmin, async (_req, res) => {
  try {
    const result = await query(
      `SELECT m.*, u.display_name AS user_name FROM memberships m
       JOIN users u ON u.id=m.user_id ORDER BY m.created_at DESC`,
    );
    res.json({ memberships: result.rows.map(mapMembership) });
  } catch (error) {
    console.error('[CABBA] memberships:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

membershipsRouter.post('/', requireAdmin, async (req, res) => {
  try {
    const { userId, type='standard', status='active', startDate, expirationDate } = req.body ?? {};
    const validTypes = ['standard','gold','vip'];
    const validStatuses = ['pending','active','suspended','expired'];
    if (typeof userId !== 'string' || !validTypes.includes(type) || !validStatuses.includes(status)
      || typeof startDate !== 'string' || typeof expirationDate !== 'string') {
      res.status(400).json({ error: 'Invalid membership data' }); return;
    }
    const user = await query('SELECT id, display_name FROM users WHERE id=$1', [userId]);
    if (!user.rows.length) { res.status(404).json({ error: 'User not found' }); return; }
    const memberNumber = await generateMemberNumber();
    const result = await query(
      `INSERT INTO memberships (user_id,member_number,type,status,start_date,expiration_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [userId, memberNumber, type, status, startDate, expirationDate],
    );
    res.status(201).json({ membership: mapMembership({...result.rows[0], user_name:user.rows[0].display_name}) });
  } catch (error: any) {
    if (error?.code === '23505') {
      // Discriminer par le NOM de contrainte : le message « adhésion active
      // existante » ne doit pas servir pour une collision de numéro.
      if (error?.constraint === 'memberships_member_number_key') {
        res.status(500).json({ error: 'Numéro de carte en collision. Réessayez.' });
        return;
      }
      res.status(409).json({ error: 'Une adhésion active existe déjà pour cet utilisateur.' });
      return;
    }
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] create membership:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

membershipsRouter.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { userId, type, status, startDate, expirationDate } = req.body ?? {};

    // L'ancien PATCH ne validait RIEN (alors que POST valide) : un `status`
    // arbitraire violait la contrainte CHECK → 500 ; `userId` absent →
    // violation NOT NULL → 500. Fusion partielle : chaque champ fourni est
    // validé, les autres conservés — puis l'état RÉSULTANT est validé.
    const current = await query('SELECT * FROM memberships WHERE id=$1', [req.params.id]);
    if (!current.rows.length) { res.status(404).json({ error: 'Membership not found' }); return; }
    const row = current.rows[0];

    const mergedUserId = userId !== undefined ? requireString(userId, 'userId', 36) : row.user_id;
    const mergedType = type !== undefined ? requireString(type, 'type', 20) : row.type;
    const mergedStatus = status !== undefined ? requireString(status, 'status', 20) : row.status;
    const mergedStart = startDate !== undefined ? requireDateString(startDate, 'startDate') : row.start_date;
    const mergedExpiration = expirationDate !== undefined ? requireDateString(expirationDate, 'expirationDate') : row.expiration_date;

    if (!(VALID_TYPES as readonly string[]).includes(mergedType)) {
      res.status(400).json({ error: 'Type d’adhésion invalide.' }); return;
    }
    if (!(VALID_STATUSES as readonly string[]).includes(mergedStatus)) {
      res.status(400).json({ error: 'Statut invalide.' }); return;
    }
    if (new Date(mergedExpiration) < new Date(mergedStart)) {
      res.status(400).json({ error: "La date d'expiration doit suivre la date de début." }); return;
    }
    if (userId !== undefined) {
      const user = await query('SELECT id FROM users WHERE id=$1', [mergedUserId]);
      if (!user.rows.length) { res.status(404).json({ error: 'User not found' }); return; }
    }

    const result = await query(
      `UPDATE memberships SET user_id=$1, type=$2, status=$3, start_date=$4, expiration_date=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [mergedUserId, mergedType, mergedStatus, mergedStart, mergedExpiration, req.params.id],
    );
    const user = await query('SELECT display_name FROM users WHERE id=$1', [result.rows[0].user_id]);
    res.json({ membership: mapMembership({ ...result.rows[0], user_name: user.rows[0]?.display_name ?? '' }) });
  } catch (error: any) {
    if (error?.code === '23505') {
      if (error?.constraint === 'memberships_member_number_key') {
        res.status(500).json({ error: 'Numéro de carte en collision. Réessayez.' }); return;
      }
      res.status(409).json({ error: 'Une adhésion active existe déjà pour cet utilisateur.' }); return;
    }
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] update membership:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

membershipsRouter.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const result = await query('DELETE FROM memberships WHERE id=$1 RETURNING id',[req.params.id]);
    if (!result.rows.length) { res.status(404).json({ error: 'Membership not found' }); return; }
    res.json({ success:true });
  } catch (error) {
    console.error('[CABBA] delete membership:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
