import { Router } from 'express';
import { query } from '../db/index.js';
import { requireAdmin, requireAuth } from '../auth.js';

export const membershipsRouter = Router();

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
    const memberNumber = 'CABBA-' + Math.floor(Math.random()*1_000_000).toString().padStart(6,'0');
    const result = await query(
      `INSERT INTO memberships (user_id,member_number,type,status,start_date,expiration_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [userId, memberNumber, type, status, startDate, expirationDate],
    );
    res.status(201).json({ membership: mapMembership({...result.rows[0], user_name:user.rows[0].display_name}) });
  } catch (error: any) {
    if (error?.code === '23505') { res.status(409).json({ error: 'Une adhésion active existe déjà pour cet utilisateur.' }); return; }
    console.error('[CABBA] create membership:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

membershipsRouter.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { userId, type='standard', status='active', startDate, expirationDate } = req.body ?? {};
    const result = await query(
      `UPDATE memberships SET user_id=$1,type=$2,status=$3,start_date=$4,expiration_date=$5,updated_at=NOW()
       WHERE id=$6 RETURNING *`, [userId,type,status,startDate,expirationDate,req.params.id],
    );
    if (!result.rows.length) { res.status(404).json({ error: 'Membership not found' }); return; }
    const user = await query('SELECT display_name FROM users WHERE id=$1',[result.rows[0].user_id]);
    res.json({ membership: mapMembership({...result.rows[0],user_name:user.rows[0]?.display_name ?? ''}) });
  } catch (error: any) {
    if (error?.code === '23505') { res.status(409).json({ error: 'Une adhésion active existe déjà pour cet utilisateur.' }); return; }
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
