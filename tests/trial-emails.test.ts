import { describe, expect, it } from 'vitest';
import { trialEmailAction, milestoneRank } from '@/lib/trial-emails';

const none = (a: ReturnType<typeof trialEmailAction>) => expect(a.kind).toBe('none');
const reminder = (a: ReturnType<typeof trialEmailAction>) =>
  (a.kind === 'reminder' ? a : { kind: 'none' }) as Extract<ReturnType<typeof trialEmailAction>, { kind: 'reminder' }>;
const expired = (a: ReturnType<typeof trialEmailAction>) => a.kind === 'expired';

describe('milestoneRank', () => {
  it('orders the milestones', () => {
    expect(milestoneRank(null)).toBe(-1);
    expect(milestoneRank(undefined)).toBe(-1);
    expect(milestoneRank('7')).toBe(0);
    expect(milestoneRank('3')).toBe(1);
    expect(milestoneRank('1')).toBe(2);
    expect(milestoneRank('expired')).toBe(3);
  });
  it('treats unknown sentinels as past', () => {
    expect(milestoneRank('garbage')).toBe(3);
  });
});

describe('doing nothing', () => {
  it('is quiet early in a fresh trial (more than 7 days left)', () => {
    none(trialEmailAction({ expired: false, daysLeft: 12, sentFor: null }));
    none(trialEmailAction({ expired: false, daysLeft: 8, sentFor: null }));
  });
  it('is quiet once the trial is over and expired was already sent', () => {
    none(trialEmailAction({ expired: true, daysLeft: 0, sentFor: 'expired' }));
  });
  it('is quiet in a trial with 0 days left but not yet flagged expired by caller', () => {
    none(trialEmailAction({ expired: false, daysLeft: 0, sentFor: null }));
  });
});

describe('forward reminder progression', () => {
  it('fires the 7-day reminder on a fresh trial at 7 days', () => {
    const a = trialEmailAction({ expired: false, daysLeft: 7, sentFor: null });
    expect(reminder(a)).toEqual({ kind: 'reminder', daysLeft: 7, milestone: '7' });
  });
  it('fires 7d once below the threshold, then 3d and 1d in order', () => {
    expect(reminder(trialEmailAction({ expired: false, daysLeft: 5, sentFor: null })).milestone).toBe('7');
    expect(reminder(trialEmailAction({ expired: false, daysLeft: 3, sentFor: '7' })).milestone).toBe('3');
    expect(reminder(trialEmailAction({ expired: false, daysLeft: 1, sentFor: '3' })).milestone).toBe('1');
  });
  it('does not re-fire a milestone already sent', () => {
    none(trialEmailAction({ expired: false, daysLeft: 7, sentFor: '7' }));
    none(trialEmailAction({ expired: false, daysLeft: 3, sentFor: '3' }));
    none(trialEmailAction({ expired: false, daysLeft: 1, sentFor: '1' }));
  });
});

describe('extension / restart', () => {
  it('does not re-fire older milestones when the trial is simply extended', () => {
    // Sent 7d, extension pushes back to 10 days left. Nothing new due yet.
    none(trialEmailAction({ expired: false, daysLeft: 10, sentFor: '7' }));
    // Sent 3d, extended back to 5 days left: both 7d and 3d thresholds already consumed,
    // and it isn't at 1 day yet, so nothing fires again.
    none(trialEmailAction({ expired: false, daysLeft: 5, sentFor: '3' }));
  });
  it('resumes from where it left off after a full extension', () => {
    // Was at "1" then extended back to 6 days: the 7d threshold (already sent) is skipped,
    // and neither 3d nor 1d is reached yet at 6 days.
    none(trialEmailAction({ expired: false, daysLeft: 6, sentFor: '1' }));
  });
});

describe('expiry', () => {
  it('fires the expired email once', () => {
    expect(expired(trialEmailAction({ expired: true, daysLeft: 0, sentFor: null }))).toBe(true);
    expect(expired(trialEmailAction({ expired: true, daysLeft: 0, sentFor: '1' }))).toBe(true);
  });
  it('stays quiet after expired is sent', () => {
    none(trialEmailAction({ expired: true, daysLeft: 0, sentFor: 'expired' }));
  });
  it('still keeps quiet for a trial that has not reached its end day', () => {
    none(trialEmailAction({ expired: false, daysLeft: 1, sentFor: '1' }));
  });
});