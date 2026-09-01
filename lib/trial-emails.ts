/** Pure trial-email scheduling — no server/DB/React imports so it is
 * unit-testable. Given the days left in a running trial and the milestone
 * already sent (or null), decide which kind of email fires now.
 *
 * Milestones advance forward, one per trial window, in order: 7d, 3d, 1d,
 * then Expired. Each fired milestone is persisted so re-running the cron is
 * a no-op rather than a duplicate send. Extending a trial does not re-fire
 * older milestones — the sequence only moves forward.
 */

export type TrialEmailAction =
  | { kind: 'reminder'; daysLeft: number; milestone: '7' | '3' | '1' }
  | { kind: 'expired'; milestone: 'expired' }
  | { kind: 'none'; milestone?: undefined };

/** Ordered milestone thresholds. Rank 0 = earliest (7d), 2 = latest (1d). */
const MILESTONES = [
  { days: 7, key: '7' as const },
  { days: 3, key: '3' as const },
  { days: 1, key: '1' as const },
];

/** Rank of a sentinel, or -1 when none (fresh trial). Throws for unknown. */
export function milestoneRank(sentFor: string | null | undefined): number {
  if (!sentFor) return -1;
  if (sentFor === 'expired') return 3;
  const idx = MILESTONES.findIndex((m) => m.key === sentFor);
  return idx >= 0 ? idx : 3; // treat unknown/stale sentinels as fully past
}

/**
 * Decide the single email to send for a subscription right now.
 *
 * @param expired true when the trial has already ended (status TRIAL and past end).
 * @param daysLeft integer days left until trial end (exclusive of the end day).
 * @param sentFor the milestone already sent for the current trial, or null.
 */
export function trialEmailAction(options: {
  expired: boolean;
  daysLeft: number;
  sentFor: string | null | undefined;
}): TrialEmailAction {
  const { expired, daysLeft, sentFor } = options;

  if (expired) {
    // Expired is the terminal milestone: fire once, then stay quiet.
    if (milestoneRank(sentFor) >= 3) return { kind: 'none' };
    return { kind: 'expired', milestone: 'expired' };
  }
  if (daysLeft <= 0) return { kind: 'none' };

  const sentRank = milestoneRank(sentFor);

  // Find the first milestone (by rank) that is now reached (daysLeft <= its days)
  // and hasn't been sent yet. Because milestones only advance, we skip thresholds
  // at or below the last sent rank.
  for (let i = 0; i < MILESTONES.length; i++) {
    const m = MILESTONES[i];
    if (i <= sentRank) continue; // already sent (or past) this milestone
    if (daysLeft <= m.days) return { kind: 'reminder', daysLeft, milestone: m.key };
  }

  return { kind: 'none' };
}