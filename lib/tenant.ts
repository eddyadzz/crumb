import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isTrialExpired } from '@/lib/trial';
import {
  canAccess,
  resolvePlanFeatures,
  type FeatureKey,
  type PlanFeatures,
} from '@/lib/plans';
import {
  hasPermission,
  permissionLabel,
  type Permission,
} from '@/lib/permissions-core';
import type { UserRole } from '@prisma/client';

export type TenantContext = {
  userId: string;
  email: string;
  name: string;
  role: string;
  isOwner: boolean;
  tenantId: string;
  trialExpired: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    orderPortalEnabled: boolean;
    isSample: boolean;
    plan: {
      code: string;
      name: string;
      features: PlanFeatures;
    } | null;
    subscription: {
      status: string;
      billingInterval: string;
      trialEndsAt: Date | null;
    } | null;
  };
};

async function resolveTenantContext(): Promise<TenantContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user) return null;

  // Role + tenant ownership come from the Membership join table. The
  // user.tenantId column is kept as a lightweight "active tenant" pointer.
  const membership = user.tenantId
    ? await prisma.membership.findUnique({
        where: { userId_tenantId: { userId: user.id, tenantId: user.tenantId } },
        select: { role: true },
      })
    : null;

  const tenant = user.tenantId
    ? await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          orderPortalEnabled: true,
          isSample: true,
          subscription: {
            select: {
              status: true,
              billingInterval: true,
              trialEndsAt: true,
              plan: { select: { code: true, name: true, features: true } },
            },
          },
        },
      })
    : null;
  if (!tenant || tenant.status === 'SUSPENDED') return null;

  const role = membership?.role ?? 'STAFF';
  const isOwner = membership?.role === 'OWNER';

  const subscription = tenant.subscription;
  const plan = subscription?.plan ?? null;
  const trialExpired = isTrialExpired(
    subscription?.status ?? 'CANCELLED',
    subscription?.trialEndsAt ?? null
  );

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role,
    isOwner,
    tenantId: tenant.id,
    trialExpired,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      orderPortalEnabled: tenant.orderPortalEnabled,
      isSample: tenant.isSample,
      plan: plan
        ? { code: plan.code, name: plan.name, features: resolvePlanFeatures(plan) }
        : null,
      subscription,
    },
  };
}

/**
 * Resolve the current session + tenant for server components.
 * Redirects to /sign-in when unauthenticated and /onboarding when the user
 * hasn't onboarded a business yet.
 */
export const getTenantContext = cache(async (): Promise<TenantContext> => {
  const ctx = await resolveTenantContext();
  if (!ctx) redirect('/sign-in');
  return ctx;
});

/** Same as getTenantContext, but returns null instead of redirecting. */
export const getTenantContextOrNull = cache(async (): Promise<TenantContext | null> => {
  return resolveTenantContext();
});

/**
 * Resolve the current session + tenant for Server Actions.
 * Throws instead of redirecting (redirects don't work in Actions).
 */
export async function requireTenant(): Promise<TenantContext> {
  const ctx = await resolveTenantContext();
  if (!ctx) throw new Error('Unauthorized');
  return ctx;
}

/**
 * Like requireTenant, but also rejects mutations once the tenant's trial has
 * expired — reads stay available, writes are blocked until the subscription
 * is reactivated.
 */
export async function requireTenantWritable(): Promise<TenantContext> {
  const ctx = await requireTenant();
  if (ctx.trialExpired) throw new Error('Trial expired');
  return ctx;
}

/**
 * Gate a feature on the tenant's current plan + subscription state.
 * Throws when the feature is not available (trial-expired and non-active
 * subscriptions are treated as locked). Use with requireTenantWritable for
 * mutation actions so trials also stay blocked once expired.
 */
export async function requireFeature(feature: FeatureKey): Promise<TenantContext> {
  const ctx = await requireTenant();
  const sub = ctx.tenant.subscription;
  if (
    !canAccess(ctx.tenant.plan, feature, {
      status: sub?.status ?? null,
      trialEndsAt: sub?.trialEndsAt ?? null,
    })
  ) {
    throw new Error(`Feature "${feature}" is not included in your plan`);
  }
  return ctx;
}

/** Pattern that scopes every human-owned record lookup to the session tenant. */
export function tenantWhere(tenantId: string) {
  return { tenantId };
}

/**
 * Gate a mutation on an exact role (or higher). Throws when the member's role
 * is below `required`. Use for coarse gates; prefer requirePermission for the
 * finer-grained capabilities.
 */
export async function requireRole(required: UserRole): Promise<TenantContext> {
  const ctx = await requireTenant();
  const rank: Record<UserRole, number> = { OWNER: 3, MANAGER: 2, STAFF: 1 };
  if (rank[ctx.role as UserRole] < rank[required]) {
    throw new Error(`Requires at least the ${required} role`);
  }
  return ctx;
}

/**
 * The single authorization gate for tenant member actions. Resolves the
 * session's active membership and checks it against the central permission
 * matrix. Throws when the member lacks `permission`.
 */
export async function requirePermission(permission: Permission): Promise<TenantContext> {
  const ctx = await requireTenant();
  if (!hasPermission(ctx.role as UserRole, permission)) {
    throw new Error(`This action requires the ${permissionLabel(permission)} permission, which your role does not have`);
  }
  return ctx;
}