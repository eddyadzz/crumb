import 'server-only';
import {
  otpEmailContent,
  welcomeEmailContent,
  trialStartedEmailContent,
  trialReminderEmailContent,
  trialExpiredEmailContent,
  subscriptionActivatedEmailContent,
  subscriptionRequestReceivedEmailContent,
  subscriptionApprovedEmailContent,
  subscriptionRejectedEmailContent,
  notificationDigestEmailContent,
  briefingEmailContent,
  inviteEmailContent,
  type EmailContent,
} from './templates';
import type { Briefing } from '@/lib/briefing';

const MAILGUN_BASE = 'https://api.mailgun.net/v3';
const MAILGUN_BASE_EU = 'https://api.eu.mailgun.net/v3';

type SendMailArgs = {
  to: string;
  content: EmailContent;
};

function mailgunConfigured() {
  return Boolean(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
}

/** Single delivery path for every email. No-op (with a log) when Mailgun isn't configured. */
export async function sendMail({ to, content }: SendMailArgs): Promise<boolean> {
  if (!mailgunConfigured()) {
    console.log(
      `\n=== Crumb email (dev fallback - Mailgun not configured) ===\nTo: ${to}\nSubject: ${content.subject}\n\n${content.text}\n=========================================================================\n`
    );
    return false;
  }

  const apiKey = process.env.MAILGUN_API_KEY as string;
  const domain = process.env.MAILGUN_DOMAIN as string;
  const base = process.env.MAILGUN_REGION === 'eu' ? MAILGUN_BASE_EU : MAILGUN_BASE;

  const fromEmail = process.env.MAILGUN_FROM_EMAIL?.trim() || `no-reply@${domain}`;
  const fromName = process.env.MAILGUN_FROM_NAME?.trim();
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const form = new URLSearchParams();
  form.set('from', from);
  form.set('to', to);
  form.set('subject', content.subject);
  form.set('text', content.text);
  form.set('html', content.html);

  const res = await fetch(`${base}/${domain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[crumb:mail] Mailgun send failed (${res.status}): ${detail}`);
    throw new Error(`Mailgun send failed with status ${res.status}`);
  }

  return true;
}

export async function sendOtpEmail({
  to,
  otp,
  type,
}: {
  to: string;
  otp: string;
  type: string;
}): Promise<void> {
  await sendMail({ to, content: otpEmailContent({ otp, type }) });
}

export async function sendWelcomeEmail({
  to,
  name,
}: {
  to: string;
  name: string;
}): Promise<void> {
  await sendMail({ to, content: welcomeEmailContent({ name }) });
}

export async function sendTrialStartedEmail({
  to,
  tenantName,
  planName,
  trialEndsAt,
}: {
  to: string;
  tenantName: string;
  planName: string;
  trialEndsAt: Date;
}): Promise<void> {
  await sendMail({
    to,
    content: trialStartedEmailContent({ tenantName, planName, trialEndsAt }),
  });
}

export async function sendTrialReminderEmail({
  to,
  tenantName,
  planName,
  trialEndsAt,
  daysLeft,
}: {
  to: string;
  tenantName: string;
  planName: string;
  trialEndsAt: Date;
  daysLeft: number;
}): Promise<void> {
  await sendMail({
    to,
    content: trialReminderEmailContent({ tenantName, planName, trialEndsAt, daysLeft }),
  });
}

export async function sendTrialExpiredEmail({
  to,
  tenantName,
  planName,
}: {
  to: string;
  tenantName: string;
  planName: string;
}): Promise<void> {
  await sendMail({
    to,
    content: trialExpiredEmailContent({ tenantName, planName }),
  });
}

export async function sendSubscriptionActivatedEmail({
  to,
  tenantName,
  planName,
  amount,
  interval,
}: {
  to: string;
  tenantName: string;
  planName: string;
  amount: number;
  interval: string;
}): Promise<void> {
  await sendMail({
    to,
    content: subscriptionActivatedEmailContent({ tenantName, planName, amount, interval }),
  });
}

export async function sendSubscriptionRequestReceivedEmail({
  to,
  tenantName,
  planName,
}: {
  to: string;
  tenantName: string;
  planName: string;
}): Promise<void> {
  await sendMail({
    to,
    content: subscriptionRequestReceivedEmailContent({ tenantName, planName }),
  });
}

export async function sendSubscriptionApprovedEmail({
  to,
  tenantName,
  planName,
}: {
  to: string;
  tenantName: string;
  planName: string;
}): Promise<void> {
  await sendMail({
    to,
    content: subscriptionApprovedEmailContent({ tenantName, planName }),
  });
}

export async function sendSubscriptionRejectedEmail({
  to,
  tenantName,
  planName,
  reason,
}: {
  to: string;
  tenantName: string;
  planName: string;
  reason?: string | null;
}): Promise<void> {
  await sendMail({
    to,
    content: subscriptionRejectedEmailContent({ tenantName, planName, reason }),
  });
}

export async function sendNotificationDigestEmail({
  to,
  tenantName,
  lines,
}: {
  to: string;
  tenantName: string;
  lines: Array<{ severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'; text: string }>;
}): Promise<void> {
  await sendMail({
    to,
    content: notificationDigestEmailContent({ tenantName, lines }),
  });
}

export async function sendInviteEmail({
  to,
  tenantName,
  role,
  inviteUrl,
}: {
  to: string;
  tenantName: string;
  role: string;
  inviteUrl: string;
}): Promise<void> {
  await sendMail({
    to,
    content: inviteEmailContent({ tenantName, role, inviteUrl }),
  });
}

export async function sendOrderReminderEmail({
  to,
  tenantName,
  briefing,
}: {
  to: string;
  tenantName: string;
  briefing: Briefing;
}): Promise<void> {
  await sendMail({
    to,
    content: briefingEmailContent({ tenantName, ...briefing }),
  });
}