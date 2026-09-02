/**
 * Pure authorization matrix — no server/DB/React imports so it is unit-testable.
 * Permissions are defined once here and referenced by both the server-side
 * guards (requirePermission) and the client for UI visibility.
 */
import type { UserRole } from '@prisma/client';

export const PERMISSIONS = [
  'billing.manage',
  'settings.manage',
  'team.manage',
  'orders.manage',
  'production.manage',
  'sales.manage',
  'reports.manage',
  'reports.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Canonical role → permission matrix. Owner is a single account with full
 * control; managers run day-to-day operations (orders, production, sales,
 * reports); staff are doers with read-only reports and no admin surface.
 */
export const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  OWNER: new Set(PERMISSIONS),
  MANAGER: new Set<Permission>([
    'orders.manage',
    'production.manage',
    'sales.manage',
    'reports.manage',
    'reports.view',
  ]),
  STAFF: new Set<Permission>([
    'orders.manage',
    'production.manage',
    'sales.manage',
    'reports.view',
  ]),
};

/** True when `role` may perform `permission`. */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/** List of permissions held by a role (sorted), for UI/summary. */
export function rolePermissionsOf(role: UserRole): Permission[] {
  return Array.from(ROLE_PERMISSIONS[role] ?? []);
}

/** Roles that hold a given permission, for UI checks / messaging. */
export function rolesWithPermission(permission: Permission): UserRole[] {
  return (['OWNER', 'MANAGER', 'STAFF'] as UserRole[]).filter((r) =>
    hasPermission(r, permission)
  );
}

/** Short human copy for a permission (used in tooltips/empty-state). */
export function permissionLabel(permission: Permission): string {
  return {
    'billing.manage': 'Billing & payments',
    'settings.manage': 'Settings',
    'team.manage': 'Team management',
    'orders.manage': 'Orders',
    'production.manage': 'Production',
    'sales.manage': 'Sales',
    'reports.manage': 'Reports',
    'reports.view': 'View reports',
  }[permission];
}

/** Does `role` match the given role exactly or an ancestor gate (>=)? */
export function isRoleLessThan(role: UserRole, required: UserRole): boolean {
  const rank: Record<UserRole, number> = { OWNER: 3, MANAGER: 2, STAFF: 1 };
  return rank[role] < rank[required];
}