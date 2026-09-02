import { describe, expect, it } from 'vitest';
import {
  canManageRole,
  generateInviteToken,
  invokeExpiresAt,
  isInviteValid,
  isRoleAtLeast,
  isValidTeamEmail,
} from '@/lib/team-core';

describe('team-core', () => {
  it('maps role ranking correctly', () => {
    expect(isRoleAtLeast('OWNER', 'MANAGER')).toBe(true);
    expect(isRoleAtLeast('MANAGER', 'MANAGER')).toBe(true);
    expect(isRoleAtLeast('STAFF', 'MANAGER')).toBe(false);
    expect(isRoleAtLeast('MANAGER', 'OWNER')).toBe(false);
  });

  it('owners can manage everyone; managers only staff', () => {
    expect(canManageRole('OWNER', 'MANAGER')).toBe(true);
    expect(canManageRole('OWNER', 'STAFF')).toBe(true);
    expect(canManageRole('MANAGER', 'STAFF')).toBe(true);
    expect(canManageRole('MANAGER', 'MANAGER')).toBe(false);
    expect(canManageRole('MANAGER', 'OWNER')).toBe(false);
    expect(canManageRole('STAFF', 'STAFF')).toBe(false);
  });

  it('validates invite emails', () => {
    expect(isValidTeamEmail('a@b.com')).toBe(true);
    expect(isValidTeamEmail('a@b.co')).toBe(true);
    expect(isValidTeamEmail('not-an-email')).toBe(false);
    expect(isValidTeamEmail('a@b')).toBe(false);
    expect(isValidTeamEmail('')).toBe(false);
  });

  it('computes expiry windows from now', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const expiry = invokeExpiresAt(now);
    expect(expiry.getTime() - now.getTime()).toBe(7 * 86400000);
    expect(isInviteValid(expiry, now)).toBe(true);
    expect(isInviteValid(expiry, new Date(expiry.getTime() + 1))).toBe(false);
  });

  it('generates unique, URL-safe tokens of a stable length', () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a.length).toBe(24);
    expect(a).not.toBe(b);
    expect(/^[A-Z2-9]+$/.test(a)).toBe(true);
    expect(a).not.toMatch(/[0O1Il]/);
  });
});