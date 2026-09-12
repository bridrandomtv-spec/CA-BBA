// التقرير الشهري التلقائي — كل أول شهر عند التاسعة، تcompile المنصة
// حصيلة الشهر السابق (تذاكر، تبرعات، متجر، انخراطات، مراقبة) وترسلها
// إلى بريد الإدارة. Dédupliqué par event_key dans email_log : aucun
// double envoi, même si le worker redémarre dix fois.

import { query } from './db/index.js';
import { sendEmail } from './email.js';

const MANAGEMENT_EMAIL = process.env.MANAGEMENT_EMAIL ?? 'uncc.bba@gmail.com';

export interface MonthStats {
  ticketsIssued: number; ticketsRevenue: number; ticketsUsed: number;
  donationsCount: number; donationsTotal: number;
  storeOrders: number; storeRevenue: number;
  membershipsActive: number; scans: number;
  topMatches: Array<{ label: string; total: number }>;
}

export async function buildMonthStats(year: number, month: number): Promise<MonthStats> {
  const from = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const to = new Date(Date.UTC(year, month, 1)).toISOString();
  const P = [from, to];
  const RANGE = `created_at >= $1::timestamptz AND created_at < $2::timestamptz`;

  const t = await query(
    `SELECT COUNT(*) FILTER (WHERE status IN ('valid','used'))::int AS issued,
            COALESCE(SUM(price_dzd) FILTER (WHERE status IN ('valid','used')),0)::int AS revenue,
            COUNT(*) FILTER (WHERE status='used')::int AS used
     FROM tickets WHERE ${RANGE}`, P);
  const d = await query(
    `SELECT COUNT(*)::int AS c, COALESCE(SUM(amount_dzd),0)::int AS total
     FROM support_donations WHERE ${RANGE}`, P);
  const s = await query(
    `SELECT COUNT(*)::int AS c, COALESCE(SUM(total),0)::int AS total
     FROM orders WHERE status IN ('confirmed','processing','shipped','delivered') AND ${RANGE}`, P);
  const m = await query(
    `SELECT COUNT(*) FILTER (WHERE status='active')::int AS active FROM memberships WHERE ${RANGE}`, P);
  const sc = await query(`SELECT COUNT(*)::int AS n FROM ticket_scans WHERE ${RANGE}`, P);
  const tm = await query(
    `SELECT m.home_team, m.away_team, COALESCE(SUM(t.price_dzd),0)::int AS total
     FROM tickets t JOIN matches m ON m.id = t.match_id
     WHERE t.status IN ('valid','used') AND t.${RANGE.replace('created_at', 'created_at')}
     GROUP BY m.home_team, m.away_team ORDER BY total DESC LIMIT 3`, P);

  return {
    ticketsIssued: Number(t.rows[0].issued),
    ticketsRevenue: Number(t.rows[0].revenue),
    ticketsUsed: Number(t.rows[0].used),
    donationsCount: Number(d.rows[0].c),
    donationsTotal: Number(d.rows[0].total),
    storeOrders: Number(s.rows[0].c),
    storeRevenue: Number(s.rows[0].total),
    membershipsActive: Number(m.rows[0].active),
    scans: Number(sc.rows[0].n),
    topMatches: tm.rows.map((r: any) => ({ label: `${r.home_team} — ${r.away_team}`, total: Number(r.total) })),
  };
}

const row = (k: string, v: string) =>
  `<tr><td style="border:1px solid #333;padding:8px;font-size:12px">${k}</td>` +
  `<td style="border:1px solid #333;padding:8px;font-size:12px;font-weight:700;text-align:left">${v}</td></tr>`;

export function reportHtml(year: number, month: number, s: MonthStats): string {
  const fmt = (n: number) => n.toLocaleString('ar-DZ');
  return `<!doctype html><html lang="ar" dir="rtl"><body style="font-family:Tahoma,Arial,sans-serif;background:#0d0d0d;padding:24px">` +
    `<div style="max-width:620px;margin:auto;border-radius:16px;overflow:hidden;background:#ffffff">` +
    `<div style="background:#f5c400;padding:16px;text-align:center"><p style="margin:0;color:#111;font-weight:800;font-size:16px">التقرير الشهري — ${month}/${year}</p></div>` +
    `<div style="padding:24px"><table style="width:100%;border-collapse:collapse">` +
    row('التذاكر المصدرة', `${fmt(s.ticketsIssued)} تذكرة`) +
    row('حصيلة التذاكر', `${fmt(s.ticketsRevenue)} د.ج`) +
    row('الدخولات المسجلة', `${fmt(s.ticketsUsed)} مرور`) +
    row('تبرعات صندوق الدعم', `${fmt(s.donationsTotal)} د.ج (${fmt(s.donationsCount)} عملية)`) +
    row('المتجر المؤكد', `${fmt(s.storeRevenue)} د.ج (${fmt(s.storeOrders)} طلب)`) +
    row('الانخراطات النشطة', fmt(s.membershipsActive)) +
    row('عمليات المراقبة', fmt(s.scans)) +
    (s.topMatches.length ? row('أفضل مباراة حصيلة', `${s.topMatches[0].label} — ${fmt(s.topMatches[0].total)} د.ج`) : '') +
    `</table><p style="font-size:11px;color:#555;margin-top:14px">` +
    `المجموع العام : <b>${fmt(s.ticketsRevenue + s.donationsTotal + s.storeRevenue)} د.ج</b><br/>` +
    `وُلّد هذا التقرير آلياً من منصة أنصار CABBA — كل رقم قابل للتتبع إلى مستنده.</p>` +
    `</div></div></body></html>`;
}

export async function sendMonthlyReport(year: number, month: number) {
  const stats = await buildMonthStats(year, month);
  const key = `monthly-report-${year}-${String(month).padStart(2, '0')}`;
  return sendEmail({
    to: MANAGEMENT_EMAIL,
    subject: `تقرير الشهر ${month}/${year} — منصة أنصار CABBA`,
    html: reportHtml(year, month, stats),
    kind: 'system',
    eventKey: key,
  });
}

/** Appelé chaque heure par le worker : ne fait rien sauf le 1er du mois ≥ 9 h. */
export async function maybeSendMonthlyReport(): Promise<void> {
  const now = new Date();
  if (now.getDate() !== 1 || now.getHours() < 9) return;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  try {
    await sendMonthlyReport(prev.getFullYear(), prev.getMonth() + 1);
  } catch (err) {
    console.error('[CABBA] monthly report:', err);
  }
}
