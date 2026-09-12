// المدفوعات — déclaration CCP/BaridiMob par référence + file de
// validation admin. Chaque paiement est une pièce traçable reliée à
// sa commande ou son don ; la confirmation commande déclenche email
// et points de fidélité (avec garde anti-double).

import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { isValidationError, optionalString } from './validate.js';
import { addPoints } from '../loyaltyLog.js';
import { sendEmail } from '../email.js';

export const paymentsRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const METHODS = ['ccp', 'cash', 'cod_cib'] as const;

const mapPayment = (row: any) => ({
  id: row.id,
  kind: row.kind,
  refId: row.ref_id,
  method: row.method,
  bankRef: row.bank_ref,
  amount: Number(row.amount),
  status: row.status,
  payerName: row.payer_name,
  payerEmail: row.payer_email ?? null,
  orderStatus: row.order_status ?? null,
  at: new Date(row.created_at).toISOString(),
  checkedAt: row.checked_at ? new Date(row.checked_at).toISOString() : null,
});

/** Coordonnées CCP du club (à renseigner dans .env : CLUB_CCP). */
paymentsRouter.get('/config', async (_req: Request, res: Response): Promise<void> => {
  res.json({
    ccp: process.env.CLUB_CCP ?? '',
    holder: process.env.CLUB_CCP_HOLDER ?? 'نادي شباب أهلي برج بوعريريج (CABBA)',
    methods: METHODS,
  });
});

/** Déclaration publique : uniquement pour ses propres commandes. */
paymentsRouter.post('/declare', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    if (String(req.body?.kind ?? '') !== 'order') {
      res.status(403).json({ error: 'التصريح العام متاح للطلبات فقط.' });
      return;
    }
    const refId = String(req.body?.refId ?? '');
    if (!UUID_RE.test(refId)) { res.status(400).json({ error: 'Identifiant invalide.' }); return; }
    const method = String(req.body?.method ?? '');
    if (!(METHODS as readonly string[]).includes(method)) { res.status(400).json({ error: 'طريقة دفع غير صالحة.' }); return; }
    const bankRef = optionalString(req.body?.bankRef, 'bankRef', 64) ?? '';
    if (method === 'ccp' && bankRef.trim().length < 4) {
      res.status(400).json({ error: 'أدخل مرجع عملية BaridiMob / CCP.' });
      return;
    }
    const payerName = optionalString(req.body?.payerName, 'payerName', 120) ?? '';
    const order = await query('SELECT id, total FROM orders WHERE id=$1 AND user_id=$2', [refId, req.user!.id]);
    if (!order.rows.length) { res.status(404).json({ error: 'الطلب غير موجود.' }); return; }
    const existing = await query('SELECT id FROM payments WHERE kind=$1 AND ref_id=$2', ['order', refId]);
    if (existing.rows.length) { res.status(409).json({ error: 'تصريح موجود بالفعل لهذا الطلب.' }); return; }
    const inserted = await query(
      `INSERT INTO payments (kind, ref_id, method, bank_ref, amount, payer_name)
       VALUES ('order', $1, $2, $3, $4, $5) RETURNING *`,
      [refId, method, bankRef.trim(), Number(order.rows[0].total), payerName],
    );
    res.status(201).json({ payment: mapPayment(inserted.rows[0]) });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] payment declare:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** File de validation + historique (admin). */
paymentsRouter.get('/admin', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT p.*, o.status AS order_status, u.email AS payer_email
       FROM payments p
       LEFT JOIN orders o ON p.kind = 'order' AND o.id = p.ref_id
       LEFT JOIN users u ON o.user_id = u.id
       ORDER BY (p.status = 'pending') DESC, p.created_at DESC
       LIMIT 100`,
    );
    res.json({ payments: result.rows.map(mapPayment) });
  } catch (error) {
    console.error('[CABBA] payments admin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Confirmation : pièce soldée + commande confirmée + email + fidélité. */
paymentsRouter.post('/:id/confirm', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ error: 'Identifiant invalide.' }); return; }
    const updated = await query(
      `UPDATE payments SET status='confirmed', checked_by=$2, checked_at=NOW()
       WHERE id=$1 AND status='pending' RETURNING *`,
      [req.params.id, req.user!.id],
    );
    if (!updated.rows.length) { res.status(404).json({ error: 'الدفع غير موجود أو ليس قيد الانتظار.' }); return; }
    const pay = updated.rows[0];
    if (pay.kind === 'order') {
      await query(`UPDATE orders SET status='confirmed' WHERE id=$1 AND status='pending'`, [pay.ref_id]);
      // fidélité avec garde anti-double : une seule fois par commande
      const already = await query(`SELECT 1 FROM loyalty_ledger WHERE reason='order' AND ref=$1`, [pay.ref_id]);
      if (!already.rows.length) {
        const owner = await query('SELECT user_id FROM orders WHERE id=$1', [pay.ref_id]);
        if (owner.rows.length) void addPoints(owner.rows[0].user_id, 10, 'order', pay.ref_id);
      }
      const mail = await query(
        `SELECT u.email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id=$1`, [pay.ref_id]);
      if (mail.rows.length) {
        void sendEmail({
          to: mail.rows[0].email,
          subject: 'تم تأكيد دفعك — طلبك قيد التحضير',
          html: `<!doctype html><html lang="ar" dir="rtl"><body style="font-family:Tahoma,Arial,sans-serif;background:#0d0d0d;padding:24px"><div style="max-width:620px;margin:auto;border-radius:16px;background:#ffffff;padding:28px;text-align:center"><p style="font-weight:800;font-size:16px;margin:0 0 8px">تم تأكيد دفعك (${Number(pay.amount).toLocaleString('ar-DZ')} د.ج)</p><p style="color:#555;font-size:13px;margin:0">طلبك انتقل إلى حالة « قيد التحضير » — ستصلك حالة الشحن بالبريد.</p></div></body></html>`,
          kind: 'system',
        }).catch((err) => console.error('[CABBA] payment email:', err));
      }
    }
    res.json({ payment: mapPayment(pay) });
  } catch (error) {
    console.error('[CABBA] payment confirm:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

paymentsRouter.post('/:id/reject', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ error: 'Identifiant invalide.' }); return; }
    const updated = await query(
      `UPDATE payments SET status='rejected', checked_by=$2, checked_at=NOW()
       WHERE id=$1 AND status='pending' RETURNING *`,
      [req.params.id, req.user!.id],
    );
    if (!updated.rows.length) { res.status(404).json({ error: 'الدفع غير موجود أو ليس قيد الانتظار.' }); return; }
    res.json({ payment: mapPayment(updated.rows[0]) });
  } catch (error) {
    console.error('[CABBA] payment reject:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
