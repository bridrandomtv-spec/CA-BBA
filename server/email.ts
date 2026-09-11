import { query } from './db/index.js';
import { env } from './env.js';

export type EmailKind = 'welcome' | 'match_reminder' | 'final_score' | 'order' | 'password_reset' | 'system';

export interface SendEmailInput {
  userId?: string;
  to: string;
  subject: string;
  html: string;
  kind: EmailKind;
  eventKey?: string;
}

const configured = Boolean(env.resendApiKey && env.emailFrom && env.appBaseUrl);
const RESEND_URL = 'https://api.resend.com/emails';

export function isEmailConfigured() {
  return configured;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function welcomeEmail(displayName: string) {
  const safeName = escapeHtml(displayName);
  return {
    subject: 'مرحباً بك في منصة أنصار CABBA',
    html: `<!doctype html><html lang="ar" dir="rtl"><body style="font-family:Tahoma,Arial,sans-serif;background:#0d0d0d;padding:24px"><div style="max-width:620px;margin:auto;border-radius:16px;overflow:hidden;background:#ffffff"><div style="background:#f5c400;padding:16px;text-align:center"><img src="${env.appBaseUrl}/icon-192.png" width="56" height="56" alt="CABBA" style="border-radius:50%;display:inline-block" /><p style="margin:8px 0 0;color:#111;font-weight:800;font-size:16px">نادي شباب أهلي برج بوعريريج (CABBA)</p></div><div style="padding:28px"><h1>مرحباً ${safeName} 👋</h1><p>أهلاً بك في منصة أنصار شباب أهلي برج بوعريريج.</p><p>حسابك أصبح جاهزاً. يمكنك متابعة الأخبار، المباريات، المجتمع ومحتوى النادي من مكان واحد.</p><p><a href="${escapeHtml(env.appBaseUrl)}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;border-radius:10px;text-decoration:none">فتح منصة CABBA</a></p><p style="color:#71717a">إذا لم تنشئ هذا الحساب، يمكنك تجاهل هذه الرسالة.</p></div><div style="background:#111111;color:#9ca3af;padding:14px 22px;font-size:11px;line-height:1.8">ملعب 20 أوت 1955 — برج بوعريريج · <a href="${env.appBaseUrl}" style="color:#f5c400;text-decoration:none">فتح منصة الأنصار</a><br/>رسالة آلية من منصة الأنصار الرسمية — سياسة الخصوصية وشروط الاستخدام داخل التطبيق (الملف الشخصي).</div></div></body></html>`,
  };
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  confirmed: 'تم تأكيد طلبك ✅',
  processing: 'جاري تحضير طلبك 📦',
  shipped: 'طلبك في الطريق إليك 🚚',
  delivered: 'تم تسليم طلبك 🎉',
  cancelled: 'تم إلغاء طلبك',
};

export interface OrderEmailItem {
  name: string;
  quantity: number;
  price: number;
}

const ORDER_HTML_SHELL = (inner: string) =>
  `<!doctype html><html lang="ar" dir="rtl"><body style="font-family:Tahoma,Arial,sans-serif;background:#0d0d0d;padding:24px">` +
  `<div style="max-width:620px;margin:auto;border-radius:16px;overflow:hidden;background:#ffffff">` +
  `<div style="background:#f5c400;padding:16px;text-align:center"><img src="${env.appBaseUrl}/icon-192.png" width="56" height="56" alt="CABBA" style="border-radius:50%;display:inline-block" /><p style="margin:8px 0 0;color:#111;font-weight:800;font-size:16px">نادي شباب أهلي برج بوعريريج (CABBA)</p></div>` +
  `<div style="padding:28px">${inner}</div>` +
  `<div style="background:#111111;color:#9ca3af;padding:14px 22px;font-size:11px;line-height:1.8">ملعب 20 أوت 1955 — برج بوعريريج · <a href="${env.appBaseUrl}" style="color:#f5c400;text-decoration:none">فتح منصة الأنصار</a><br/>رسالة آلية من منصة الأنصار الرسمية — سياسة الخصوصية وشروط الاستخدام داخل التطبيق (الملف الشخصي).</div>` +
  `</div></body></html>`;

/** Référence courte lisible : les 8 premiers caractères de l'UUID. */
function shortRef(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

export function orderConfirmationEmail(items: OrderEmailItem[], total: number, orderId: string) {
  const rows = items
    .map(
      (item) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #f4f4f5;font-size:14px">` +
        `${escapeHtml(item.name)} <span style="color:#71717a">×${item.quantity}</span></td>` +
        `<td style="padding:8px 0;border-bottom:1px solid #f4f4f5;font-size:14px;text-align:left">` +
        `${item.price * item.quantity} د.ج</td></tr>`,
    )
    .join('');

  return {
    subject: `طلبك في متجر CABBA — ${shortRef(orderId)}`,
    html: ORDER_HTML_SHELL(
      `<h1>شكراً لطلبك 🟡⚫</h1>` +
      `<p>تم تسجيل طلبك لدى متجر أنصار شباب أهلي برج بوعريريج وهو قيد المعالجة.</p>` +
      `<table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}</table>` +
      `<p style="font-weight:bold;font-size:16px">المجموع: ${total} د.ج</p>` +
      `<p style="color:#71717a;font-size:12px">رقم الطلب: <span dir="ltr">${escapeHtml(shortRef(orderId))}</span></p>` +
      `<p style="color:#71717a;font-size:12px">ستصلك رسالة عند كل تغيير في حالة الطلب.</p>`,
    ),
  };
}

export function orderStatusEmail(status: string, orderId: string) {
  const label = ORDER_STATUS_LABELS[status] ?? `تحديث حالة طلبك: ${status}`;
  const isCancellation = status === 'cancelled';

  return {
    subject: `متجر CABBA — ${label} (${shortRef(orderId)})`,
    html: ORDER_HTML_SHELL(
      `<h1>${escapeHtml(label)}</h1>` +
      `<p>طلبك رقم <span dir="ltr"><strong>${escapeHtml(shortRef(orderId))}</strong></span> ` +
      (isCancellation
        ? `تم إلغاؤه. إذا كنت قد دفعت مسبقاً، تواصل مع إدارة النادي للترتيبات.`
        : `أصبح بحالة «${escapeHtml(label)}». يمكنك متابعة طلباتك من التطبيق في أي وقت.`) +
      `</p>` +
      `<p><a href="${escapeHtml(env.appBaseUrl)}/#/store" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;border-radius:10px;text-decoration:none">فتح متجر CABBA</a></p>`,
    ),
  };
}

export function passwordResetEmail(displayName: string, resetUrl: string) {
  const safeName = escapeHtml(displayName);
  const safeUrl = escapeHtml(resetUrl);
  return {
    subject: 'استعادة كلمة المرور — منصة أنصار CABBA',
    html: `<!doctype html><html lang="ar" dir="rtl"><body style="font-family:Tahoma,Arial,sans-serif;background:#0d0d0d;padding:24px"><div style="max-width:620px;margin:auto;border-radius:16px;overflow:hidden;background:#ffffff"><div style="background:#f5c400;padding:16px;text-align:center"><img src="${env.appBaseUrl}/icon-192.png" width="56" height="56" alt="CABBA" style="border-radius:50%;display:inline-block" /><p style="margin:8px 0 0;color:#111;font-weight:800;font-size:16px">نادي شباب أهلي برج بوعريريج (CABBA)</p></div><div style="padding:28px"><h1>استعادة كلمة المرور 🔑</h1><p>مرحباً ${safeName}،</p><p>وصلنا طلب لاستعادة كلمة المرور الخاصة بحسابك في منصة أنصار الكابا. اضغط على الزر التالي لاختيار كلمة مرور جديدة:</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;border-radius:10px;text-decoration:none">إعادة تعيين كلمة المرور</a></p><p style="color:#71717a;font-size:12px">الرابط صالح لمدة 30 دقيقة ولا يمكن استعماله إلا مرة واحدة.</p><p style="color:#71717a;font-size:12px">إن لم تطلب ذلك، تجاهل هذه الرسالة — حسابك يبقى آمناً.</p><p style="color:#a1a1aa;font-size:11px;word-break:break-all" dir="ltr">${safeUrl}</p></div><div style="background:#111111;color:#9ca3af;padding:14px 22px;font-size:11px;line-height:1.8">ملعب 20 أوت 1955 — برج بوعريريج · <a href="${env.appBaseUrl}" style="color:#f5c400;text-decoration:none">فتح منصة الأنصار</a><br/>رسالة آلية من منصة الأنصار الرسمية — سياسة الخصوصية وشروط الاستخدام داخل التطبيق (الملف الشخصي).</div></div></body></html>`,
  };
}

export async function sendEmail(input: SendEmailInput) {
  if (!configured) return { sent: false, skipped: 'not_configured' as const };

  if (input.eventKey) {
    const claim = await query(
      `INSERT INTO email_log (user_id, recipient, kind, event_key, subject, status)
       VALUES ($1,$2,$3,$4,$5,'pending')
       ON CONFLICT (event_key) DO UPDATE
         SET status='pending', error_message=NULL, recipient=EXCLUDED.recipient, subject=EXCLUDED.subject
         WHERE email_log.status='failed'
       RETURNING id`,
      [input.userId ?? null, input.to, input.kind, input.eventKey, input.subject],
    );
    if (!claim.rowCount) return { sent: false, skipped: 'already_sent' as const };
    const logId = claim.rows[0].id;

    try {
      await deliver(input);
      await query('UPDATE email_log SET status=\'sent\', sent_at=NOW() WHERE id=$1', [logId]);
      return { sent: true };
    } catch (error: any) {
      await query('UPDATE email_log SET status=\'failed\', error_message=$2 WHERE id=$1', [logId, String(error?.message ?? error).slice(0, 1000)]);
      throw error;
    }
  }

  await deliver(input);
  return { sent: true };
}

/** Budget de livraison : un fournisseur muet ne suspend pas le scheduler
 *  (rappels de match, résultats) — l'échec passe la ligne en status='failed'
 *  et le retry existant (ON CONFLICT WHERE status='failed') prend le relais. */
const RESEND_TIMEOUT_MS = 10_000;

async function deliver(input: SendEmailInput) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Email provider returned ${response.status}: ${detail.slice(0, 500)}`);
    }
  } catch (error) {
    // AbortError → message explicite dans email_log.error_message.
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Email provider timed out after ${RESEND_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function sendWelcomeEmail(user: { id: string; email: string; displayName: string }) {
  const content = welcomeEmail(user.displayName);
  return sendEmail({
    userId: user.id,
    to: user.email,
    subject: content.subject,
    html: content.html,
    kind: 'welcome',
    eventKey: `welcome:${user.id}`,
  });
}
