import { describe, expect, it } from 'vitest';
import {
  canAccess,
  hasPlanFeature,
  isFreePlanCode,
  planDisplayName,
  resolvePlanFeatures,
  trialGrantsFullAccess,
} from '@/lib/plans';

const NOW = new Date('2026-09-02T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const free = { code: 'free' };
const pro = { code: 'pro' };
const business = { code: 'business' };

describe('resolvePlanFeatures', () => {
  it('returns no features for the free plan', () => {
    const f = resolvePlanFeatures(free);
    expect(f.analytics).toBe(false);
    expect(f.multiUser).toBe(false);
    expect(Object.values(f).every((v) => !v)).toBe(true);
  });

  it('grants pro its named features only', () => {
    const f = resolvePlanFeatures(pro);
    expect(f.analytics).toBe(true);
    expect(f.customerManagement).toBe(true);
    expect(f.multiUser).toBe(false);
  });

  it('grants everything to business', () => {
    const f = resolvePlanFeatures(business);
    expect(f.multiUser).toBe(true);
    expect(f.suppliers).toBe(true);
    expect(f.activityLogs).toBe(true);
    expect(f.analytics).toBe(true);
  });

  it('lets DB feature overrides win over the built-in defaults', () => {
    expect(resolvePlanFeatures({ ...pro, features: { analytics: false } }).analytics).toBe(false);
  });

  it('normalises codes and treats unknowns as free', () => {
    expect(resolvePlanFeatures({ code: 'PRO' }).analytics).toBe(true);
    expect(resolvePlanFeatures({ code: 'legacy' })).toEqual(resolvePlanFeatures(null));
    expect(resolvePlanFeatures({ code: 'legacy' }).analytics).toBe(false);
  });

  it('ignores non-object features payloads', () => {
    expect(resolvePlanFeatures({ ...pro, features: ['analytics'] as unknown }).analytics).toBe(true);
  });
});

describe('hasPlanFeature', () => {
  it('is false for free and null plans', () => {
    expect(hasPlanFeature(free, 'analytics')).toBe(false);
    expect(hasPlanFeature(null, 'analytics')).toBe(false);
  });
  it('is true on the right plans', () => {
    expect(hasPlanFeature(pro, 'analytics')).toBe(true);
    expect(hasPlanFeature(business, 'multiUser')).toBe(true);
    expect(hasPlanFeature(business, 'suppliers')).toBe(true);
  });
});

describe('trialGrantsFullAccess', () => {
  it('unlocks during a running trial', () => {
    expect(trialGrantsFullAccess({ status: 'TRIAL', trialEndsAt: new Date(NOW.getTime() + DAY), now: NOW })).toBe(true);
  });
  it('locks once the trial hits its end date', () => {
    expect(trialGrantsFullAccess({ status: 'TRIAL', trialEndsAt: NOW, now: NOW })).toBe(false);
    expect(trialGrantsFullAccess({ status: 'TRIAL', trialEndsAt: new Date(NOW.getTime() - 1), now: NOW })).toBe(false);
  });
  it('treats a trial without an end date as live', () => {
    expect(trialGrantsFullAccess({ status: 'TRIAL', trialEndsAt: null, now: NOW })).toBe(true);
  });
  it('never unlocks for other statuses', () => {
    expect(trialGrantsFullAccess({ status: 'ACTIVE', trialEndsAt: new Date(NOW.getTime() + DAY), now: NOW })).toBe(false);
  });
});

describe('canAccess', () => {
  it('gives a live trial access to everything', () => {
    expect(canAccess(free, 'analytics', { status: 'TRIAL', trialEndsAt: new Date(NOW.getTime() + DAY), now: NOW })).toBe(true);
    expect(canAccess(free, 'multiUser', { status: 'TRIAL', trialEndsAt: new Date(NOW.getTime() + DAY), now: NOW })).toBe(true);
  });

  it('washes out an expired trial', () => {
    expect(canAccess(pro, 'analytics', { status: 'TRIAL', trialEndsAt: NOW, now: NOW })).toBe(false);
  });

  it('gates ACTIVE subscriptions by plan', () => {
    expect(canAccess(free, 'analytics', { status: 'ACTIVE', now: NOW })).toBe(false);
    expect(canAccess(pro, 'analytics', { status: 'ACTIVE', now: NOW })).toBe(true);
    expect(canAccess(business, 'analytics', { status: 'ACTIVE', now: NOW })).toBe(true);
    expect(canAccess(business, 'multiUser', { status: 'ACTIVE', now: NOW })).toBe(true);
  });

  it('blocks every feature for non-active statuses', () => {
    for (const status of ['PAST_DUE', 'SUSPENDED', 'CANCELLED']) {
      expect(canAccess(business, 'multiUser', { status, now: NOW })).toBe(false);
    }
  });
});

describe('isFreePlanCode / planDisplayName', () => {
  it('recognises the free code case-insensitively', () => {
    expect(isFreePlanCode('free')).toBe(true);
    expect(isFreePlanCode('FREE')).toBe(true);
    expect(isFreePlanCode('pro')).toBe(false);
  });
  it('maps codes to display names and falls back gracefully', () => {
    expect(planDisplayName({ code: 'business', name: 'Business' })).toBe('Business');
    expect(planDisplayName({ code: 'pro' })).toBe('Pro');
    expect(planDisplayName(null)).toBe('Free');
  });
});