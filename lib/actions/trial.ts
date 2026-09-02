'use server';

import { prisma } from '@/lib/prisma';
import { trialEmailAction, type TrialEmailAction } from '@/lib/trial-emails';
import { trialDaysLeft } from '@/lib/trial';
import {
  sendTrialReminderEmail,
  sendTrialExpiredEmail,
} from '@/lib/mail';

export type CronSummary = {
  scanned: number;
  sent: { kind: string; count: number }[];
  errors: { tenantId: string; message: string }[];
};

const reminderDays: Record<'7' | '3' | '1', number> = { '7': 7, '3': 3, '1': 1 };

/**
 * Run one trial-email pass. Safe to call daily (or more often) — every
 * subscription that qualifies to send at all is guarded by its persisted
 * sentinel, so re-runs only advance the sequence, never duplicate.
 */
export async function sendTrialEmails(input: { next: number } = { next: 1 }): Promise<CronSummary> {
  void input.next;
  const summary: CronSummary = { scanned: 0, sent: [], errors: [] };

  const subs = await prisma.subscription.findMany({
    where: { status: 'TRIAL' },
    include: {
      plan: { select: { name: true } },
      tenant: {
        select: {
          id: true,
          name: true,
          email: true,
          memberships: {
            where: { role: 'OWNER' },
            select: { user: { select: { email: true } } },
            take: 1,
          },
        },
      },
    },
  });

  const sentTally: Record<string, number> = {};

  for (const sub of subs) {
    summary.scanned += 1;
    if (!sub.trialEndsAt) continue;

    const now = new Date();
    const expired = sub.trialEndsAt.getTime() <= now.getTime();
    const daysLeft = trialDaysLeft(sub.trialEndsAt, now) ?? 0;
    const action = trialEmailAction({ expired, daysLeft, sentFor: sub.trialEmailSentFor });

    if (action.kind === 'none') continue;

    const to = sub.tenant.email ?? sub.tenant.memberships[0]?.user.email;
    if (!to) continue;

    const wasSent = await deliver(action, to, sub.plan.name, sub.tenant.name, sub.trialEndsAt);
    if (wasSent) {
      const milestone = action.milestone ?? 'expired';
      sentTally[milestone] = (sentTally[milestone] ?? 0) + 1;
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { trialEmailSentFor: milestone },
      });
    }
  }

  summary.sent = Object.entries(sentTally).map(([kind, count]) => ({ kind, count }));
  return summary;
}

/** Send the email; returns true only when the send cast "succeeded". */
async function deliver(
  action: Exclude<TrialEmailAction, { kind: 'none' }>,
  to: string,
  planName: string,
  tenantName: string,
  trialEndsAt: Date
): Promise<boolean> {
  try {
    if (action.kind === 'expired') {
      await sendTrialExpiredEmail({ to, tenantName, planName });
    } else {
      await sendTrialReminderEmail({
        to,
        tenantName,
        planName,
        trialEndsAt,
        daysLeft: reminderDays[action.milestone],
      });
    }
    return true;
  } catch {
    // Best-effort: don't advance the sentinel so a later run retries.
    return false;
  }
}