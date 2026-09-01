import { describe, expect, it } from 'vitest';
import { isTrialExpired, trialDaysLeft } from '@/lib/trial';

const NOW = new Date('2026-09-02T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

describe('isTrialExpired', () => {
  it('returns false for non-trial subscription statuses', () => {
    expect(isTrialExpired('ACTIVE', new Date(NOW.getTime() - DAY), NOW)).toBe(false);
    expect(isTrialExpired('CANCELLED', new Date(NOW.getTime() - DAY), NOW)).toBe(false);
  });

  it('returns false when there is no trial end date', () => {
    expect(isTrialExpired('TRIAL', null, NOW)).toBe(false);
  });

  it('returns false while the trial is still running', () => {
    expect(isTrialExpired('TRIAL', new Date(NOW.getTime() + DAY), NOW)).toBe(false);
  });

  it('returns true once the trial end date arrives', () => {
    expect(isTrialExpired('TRIAL', NOW, NOW)).toBe(true);
    expect(isTrialExpired('TRIAL', new Date(NOW.getTime() - 1), NOW)).toBe(true);
  });
});

describe('trialDaysLeft', () => {
  it('returns null when there is no end date', () => {
    expect(trialDaysLeft(null, NOW)).toBeNull();
  });

  it('returns the number of full days and rounds up partial days', () => {
    expect(trialDaysLeft(new Date(NOW.getTime() + 14 * DAY), NOW)).toBe(14);
    expect(trialDaysLeft(new Date(NOW.getTime() + DAY - 1), NOW)).toBe(1);
    expect(trialDaysLeft(new Date(NOW.getTime() + 25 * 60 * 60 * 1000), NOW)).toBe(2);
  });

  it('accepts ISO strings', () => {
    expect(trialDaysLeft(new Date(NOW.getTime() + DAY).toISOString(), NOW)).toBe(1);
  });

  it('clamps to zero once expired', () => {
    expect(trialDaysLeft(new Date(NOW.getTime() - 1), NOW)).toBe(0);
  });

  it('returns null for an unparseable date', () => {
    expect(trialDaysLeft('not-a-date', NOW)).toBeNull();
  });
});