/**
 * Pure team / role logic — no server/DB/React imports so it is unit-testable.
 * Role hierarchy and invite-token handling live here.
 */
import type { UserRole } from '@prisma/client';

export const ROLES: readonly UserRole[] = ['OWNER', 'MANAGER', 'STAFF'];

/** Rank where higher number = more privilege. */
export const ROLE_RANK: Record<UserRole, number> = {
  OWNER: 3,
  MANAGER: 2,
  STAFF: 1,
};

/** Roles any user may hold besides the single tenant OWNER. */
export const MANAGER_ROLE = 'MANAGER' as const;
export const STAFF_ROLE = 'STAFF' as const;
export const INVITABLE_ROLES = [MANAGER_ROLE, STAFF_ROLE] as const;

export function isRoleAtLeast(role: UserRole, min: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/**
 * Can `actor` (an OWNER/MANAGER) grant, revoke or change `target`'s role?
 * Owners manage everyone; managers manage staff only.
 */
export function canManageRole(actor: UserRole, target: UserRole): boolean {
  if (actor === 'OWNER') return true;
  if (actor === 'MANAGER') return ROLE_RANK[target] < ROLE_RANK[MANAGER_ROLE];
  return false;
}

export const INVITE_VALID_DAYS = 7;

export function invokeExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_VALID_DAYS * 24 * 60 * 60 * 1000);
}

export function isInviteValid(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() > now.getTime();
}

export function isValidTeamEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** A short, URL-safe invite token. Readable, unambiguous IDs (no 0/O/1/I/l). */
export function generateInviteToken(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}