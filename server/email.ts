import { query } from './db/index.js';
import { env } from './env.js';

export type EmailKind = 'welcome' | 'match_reminder' | 'final_score' | 'system';

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
    html: `<!doctype html><html lang="ar" dir="rtl"><body style="font-family:Arial,sans-serif;background:#f4f4f5;padding:24px"><div style="max-width:620px;margin:auto;background:white;border-radius:16px;padding:32px"><h1>مرحباً ${safeName} 👋</h1><p>أهلاً بك في منصة أنصار شباب أهلي برج بوعريريج.</p><p>حسابك أصبح جاهزاً. يمكنك متابعة الأخبار، المباريات، المجتمع ومحتوى النادي من مكان واحد.</p><p><a href="${escapeHtml(env.appBaseUrl)}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;border-radius:10px;text-decoration:none">فتح منصة CABBA</a></p><p style="color:#71717a">إذا لم تنشئ هذا الحساب، يمكنك تجاهل هذه الرسالة.</p></div></body></html>`,
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

async function deliver(input: SendEmailInput) {
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
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email provider returned ${response.status}: ${detail.slice(0, 500)}`);
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
