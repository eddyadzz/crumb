/** Pure email content builders — no server/env imports so they can be unit-tested. */

export type EmailContent = { subject: string; html: string; text: string };

const accent = '#16a34a';
const surface = '#f0fdf4';
const border = '#bbf7d0';
const muted = '#78716c';

function shell(subject: string, intro: string, bodyHtml: string, textLines: string[]): EmailContent {
  const text = textLines.join('\n');
  return { subject, text, html: `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f6f5f1;color:#1c1917;">
    <div style="max-width:420px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e7e5e4;">
      <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;"><span style="color:${accent};">Crumb</span></div>
      <p style="margin:24px 0 8px;font-size:16px;">${intro}</p>
      ${bodyHtml}
      <p style="margin:8px 0;font-size:14px;color:${muted};">— Crumb by BoliFlow</p>
    </div>
  </body>
</html>`,
  };
}

function codeBlock(code: string): string {
  return `<div style="margin:20px 0;padding:16px;background:${surface};border:1px solid ${border};border-radius:12px;text-align:center;font-size:32px;font-weight:700;letter-spacing:0.3em;color:#166534;">${code}</div>`;
}

function copy(text: string): string {
  return `<p style="margin:16px 0;font-size:15px;line-height:1.5;">${text}</p>`;
}

export function otpEmailContent({ otp, type }: { otp: string; type: string }): EmailContent {
  const verification = type === 'email-verification';
  const subject = verification ? 'Your Crumb verification code' : 'Your Crumb login code';
  const intro = verification
    ? 'Use the code below to verify your email address.'
    : 'Use the code below to sign in to Crumb.';
  return shell(
    subject,
    intro,
    codeBlock(otp) +
      `<p style="margin:8px 0;font-size:14px;color:${muted};">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</p>`,
    [`Use your Crumb ${verification ? 'verification' : 'login'} code: ${otp}`, 'It expires in 10 minutes.']
  );
}

export function welcomeEmailContent({ name }: { name: string }): EmailContent {
  const subject = 'Welcome to Crumb';
  return shell(
    subject,
    `Hi ${name}, welcome to Crumb!`,
    copy(`Your bake shop operations workspace is ready — track ingredients, recipes, production and sales from one place.`),
    ['Welcome to Crumb, ' + name + '!', 'Your bake shop workspace is ready.']
  );
}

export function trialStartedEmailContent({
  tenantName,
  planName,
  trialEndsAt,
}: {
  tenantName: string;
  planName: string;
  trialEndsAt: Date;
}): EmailContent {
  const subject = `Your ${planName} trial for ${tenantName} has started`;
  const ends = trialEndsAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return shell(
    subject,
    `${tenantName} is on the ${planName} plan.`,
    copy(`Your 14-day free trial runs until ${ends}. You can keep editing until then — upgrade any time to keep ${planName} features.`),
    [`${tenantName} is on the ${planName} plan.`, `The free trial runs until ${ends}.`]
  );
}

export function subscriptionActivatedEmailContent({
  tenantName,
  planName,
  amount,
  interval,
}: {
  tenantName: string;
  planName: string;
  amount: number;
  interval: string;
}): EmailContent {
  const subject = `${planName} is active for ${tenantName}`;
  const price = `MVR ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}/${interval.toLowerCase()}`;
  return shell(
    subject,
    `You're on the ${planName} plan.`,
    copy(`Your ${planName} subscription at ${price} is now active for ${tenantName}. Full feature access is unlocked.`),
    [`${planName} subscription is now active for ${tenantName}.`, `Billed at ${price}.`]
  );
}

/** Urgency copy for the N-days-left reminder. Pure so it is unit-testable. */
export function trialReminderEmailContent({
  tenantName,
  planName,
  trialEndsAt,
  daysLeft,
}: {
  tenantName: string;
  planName: string;
  trialEndsAt: Date;
  daysLeft: number;
}): EmailContent {
  const ends = trialEndsAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const subject = `${daysLeft} ${
    daysLeft === 1 ? 'day' : 'days'
  } left on your ${planName} trial for ${tenantName}`;
  return shell(
    subject,
    `Your ${planName} trial for ${tenantName} ends in ${daysLeft} ${
      daysLeft === 1 ? 'day' : 'days'
    }.`,
    copy(`Your trial runs until ${ends}. Upgrade to keep ${planName} features and pricing — no credit card needed to keep your workspace, you'll only be billed once your trial ends.`),
    [
      `Your ${planName} trial for ${tenantName} ends in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} (${ends}).`,
      'Upgrade any time to keep your workspace.',
    ]
  );
}

export function trialExpiredEmailContent({
  tenantName,
  planName,
}: {
  tenantName: string;
  planName: string;
}): EmailContent {
  const subject = `Your ${planName} trial for ${tenantName} has ended`;
  return shell(
    subject,
    `Your ${planName} trial for ${tenantName} has ended.`,
    copy(`Your workspace is paused for editing. Nothing has been deleted — upgrade any time to reactivate ${planName} features and pick up right where you left off.`),
    [
      `Your ${planName} trial for ${tenantName} has ended.`,
      'Editing is paused, but your workspace is safe.',
      'Upgrade any time to reactivate your plan.',
    ]
  );
}

export function subscriptionRequestReceivedEmailContent({
  tenantName,
  planName,
}: {
  tenantName: string;
  planName: string;
}): EmailContent {
  const subject = `We received your ${planName} upgrade request for ${tenantName}`;
  return shell(
    subject,
    `We've received your request to upgrade ${tenantName} to ${planName}.`,
    copy(`Our team will review your payment and activate your subscription shortly. You'll get an email once it's approved — usually within a few hours during business hours.`),
    [
      `We received your ${planName} upgrade request for ${tenantName}.`,
      'Our team will review your payment and activate your subscription shortly.',
    ]
  );
}

export function subscriptionApprovedEmailContent({
  tenantName,
  planName,
}: {
  tenantName: string;
  planName: string;
}): EmailContent {
  const subject = `Your ${planName} subscription for ${tenantName} is now active`;
  return shell(
    subject,
    `Great news — your ${planName} subscription for ${tenantName} is now active.`,
    copy(`All ${planName} features are unlocked. Thank you for upgrading to Crumb. You can close this email — no further action needed.`),
    [
      `Your ${planName} subscription for ${tenantName} is now active.`,
      'All ' + planName + ' features are unlocked. Thanks for choosing Crumb.',
    ]
  );
}

export function subscriptionRejectedEmailContent({
  tenantName,
  planName,
  reason,
}: {
  tenantName: string;
  planName: string;
  reason?: string | null;
}): EmailContent {
  const subject = `We couldn't process your ${planName} upgrade for ${tenantName}`;
  return shell(
    subject,
    `We couldn't approve your ${planName} upgrade for ${tenantName}.`,
    reason
      ? copy(`Reason: ${reason}. Please double-check your payment and submit a new upgrade request.`)
      : copy(`Please double-check your payment and submit a new upgrade request, or contact us for help.`),
    [
      `We couldn't approve your ${planName} upgrade for ${tenantName}.`,
      reason ? `Reason: ${reason}` : 'Please check your payment and submit a new request.',
      'Your workspace and data are unchanged.',
    ]
  );
}

export function notificationDigestEmailContent({
  tenantName,
  lines,
}: {
  tenantName: string;
  lines: Array<{ severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'; text: string }>;
}): EmailContent {
  const subject = `Crumb update — ${lines.length} ${lines.length === 1 ? 'thing' : 'things'} to check for ${tenantName}`;
  const rowsHtml = lines
    .map(
      (l) =>
        `<tr><td style="padding:10px 12px;border-top:1px solid #e7e5e4;font-size:15px;color:#1c1917;">${
          l.severity === 'ERROR'
            ? '🔴'
            : l.severity === 'WARNING'
              ? '🟠'
              : l.severity === 'SUCCESS'
                ? '🟢'
                : '🔵'
        }&nbsp; ${l.text}</td></tr>`
    )
    .join('');
  const table = `<table style="width:100%;border-collapse:collapse;margin:16px 0;"><tbody>${rowsHtml}</tbody></table>`;
  return shell(
    subject,
    `Here's what's waiting for ${tenantName} in Crumb.`,
    table + copy('Open Crumb to review these now — no further action is needed if everything looks good.'),
    [`Crumb update for ${tenantName}:`].concat(lines.map((l) => `- ${l.text}`))
  );
}