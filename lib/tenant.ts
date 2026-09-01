import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export type TenantContext = {
  userId: string;
  email: string;
  name: string;
  role: string;
  isOwner: boolean;
  tenantId: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    subscriptionTier: string;
    subscriptionStatus: string;
    trialEndsAt: Date | null;
  };
};

async function resolveTenantContext(): Promise<TenantContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user) return null;

  const tenant = user.tenantId
    ? await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          trialEndsAt: true,
        },
      })
    : null;
  if (!tenant || tenant.status === 'SUSPENDED') return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role ?? 'STAFF',
    isOwner: user.isOwner ?? false,
    tenantId: tenant.id,
    tenant: { ...tenant, status: tenant.status, subscriptionTier: tenant.subscriptionTier, subscriptionStatus: tenant.subscriptionStatus },
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

/** Pattern that scopes every human-owned record lookup to the session tenant. */
export function tenantWhere(tenantId: string) {
  return { tenantId };
}