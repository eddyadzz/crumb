import 'server-only';

const MAILGUN_BASE = 'https://api.mailgun.net/v3';
const MAILGUN_BASE_EU = 'https://api.eu.mailgun.net/v3';

type SendMailArgs = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

function mailgunConfigured() {
  return Boolean(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
}

export async function sendMail({ to, subject, text, html }: SendMailArgs): Promise<boolean> {
  if (!mailgunConfigured()) {
    console.warn(
      `[crumb:email] Mailgun not configured (MAILGUN_API_KEY/MAILGUN_DOMAIN missing). Skipped sending "${subject}" to ${to}.`
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
  form.set('subject', subject);
  form.set('text', text ?? '');
  if (html) form.set('html', html);

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
    console.error(`[crumb:email] Mailgun send failed (${res.status}): ${detail}`);
    throw new Error(`Mailgun send failed with status ${res.status}`);
  }

  return true;
}

export function otpEmailContent({ otp, type }: { otp: string; type: string }) {
  const subject =
    type === 'email-verification'
      ? 'Your Crumb verification code'
      : 'Your Crumb login code';
  const intro =
    type === 'email-verification'
      ? 'Use the code below to verify your email address.'
      : 'Use the code below to sign in to Crumb.';
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f6f5f1;color:#1c1917;">
    <div style="max-width:420px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e7e5e4;">
      <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;">
        <span style="color:#16a34a;">Crumb</span>
      </div>
      <p style="margin:24px 0 8px;font-size:16px;">${intro}</p>
      <div style="margin:20px 0;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;text-align:center;font-size:32px;font-weight:700;letter-spacing:0.3em;color:#166534;">${otp}</div>
      <p style="margin:8px 0;font-size:14px;color:#78716c;">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</p>
    </div>
  </body>
</html>`;
  return { subject, html };
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
  if (!mailgunConfigured()) {
    console.log(
      `\n=== Crumb OTP (dev fallback - Mailgun not configured) ===\nTo: ${to} (${type})\nCode: ${otp}\nExpires in 10 minutes.\n=========================================================================\n`
    );
    return;
  }
  const { subject, html } = otpEmailContent({ otp, type });
  await sendMail({ to, subject, html, text: `Your Crumb code is ${otp}. It expires in 10 minutes.` });
}