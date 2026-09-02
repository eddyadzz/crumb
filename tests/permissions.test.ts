import { describe, expect, it } from 'vitest';
import {
  hasPermission,
  isRoleLessThan,
  permissionLabel,
  rolePermissionsOf,
  ROLE_PERMISSIONS,
  rolesWithPermission,
} from '@/lib/permissions-core';

describe('permissions-core', () => {
  it('owner holds every permission', () => {
    for (const p of ROLE_PERMISSIONS.OWNER) {
      expect(hasPermission('OWNER', p)).toBe(true);
    }
  });

  it('manager holds operations + report management but no admin surface', () => {
    expect(hasPermission('MANAGER', 'orders.manage')).toBe(true);
    expect(hasPermission('MANAGER', 'production.manage')).toBe(true);
    expect(hasPermission('MANAGER', 'sales.manage')).toBe(true);
    expect(hasPermission('MANAGER', 'reports.view')).toBe(true);
    expect(hasPermission('MANAGER', 'reports.manage')).toBe(true);
    expect(hasPermission('MANAGER', 'billing.manage')).toBe(false);
    expect(hasPermission('MANAGER', 'team.manage')).toBe(false);
    expect(hasPermission('MANAGER', 'settings.manage')).toBe(false);
  });

  it('staff can operate and view reports but not manage them or admin surfaces', () => {
    expect(hasPermission('STAFF', 'orders.manage')).toBe(true);
    expect(hasPermission('STAFF', 'production.manage')).toBe(true);
    expect(hasPermission('STAFF', 'sales.manage')).toBe(true);
    expect(hasPermission('STAFF', 'reports.view')).toBe(true);
    expect(hasPermission('STAFF', 'reports.manage')).toBe(false);
    expect(hasPermission('STAFF', 'billing.manage')).toBe(false);
    expect(hasPermission('STAFF', 'team.manage')).toBe(false);
    expect(hasPermission('STAFF', 'settings.manage')).toBe(false);
  });

  it('billing, team and settings are owner-only', () => {
    for (const p of ['billing.manage', 'team.manage', 'settings.manage'] as const) {
      expect(rolesWithPermission(p)).toEqual(['OWNER']);
    }
  });

  it('reports.manage is owner + manager; reports.view is everyone', () => {
    expect(rolesWithPermission('reports.manage')).toEqual(['OWNER', 'MANAGER']);
    expect(rolesWithPermission('reports.view')).toEqual(['OWNER', 'MANAGER', 'STAFF']);
  });

  it('every permission maps to a label', () => {
    for (const p of ROLE_PERMISSIONS.OWNER) {
      expect(permissionLabel(p).length).toBeGreaterThan(0);
    }
  });

  it('role rank comparison works', () => {
    expect(isRoleLessThan('STAFF', 'MANAGER')).toBe(true);
    expect(isRoleLessThan('MANAGER', 'OWNER')).toBe(true);
    expect(isRoleLessThan('OWNER', 'OWNER')).toBe(false);
    expect(isRoleLessThan('MANAGER', 'STAFF')).toBe(false);
  });

  it('rolePermissionsOf returns the matrix entry for a role', () => {
    expect(rolePermissionsOf('OWNER')).toEqual(Array.from(ROLE_PERMISSIONS.OWNER));
  });
});