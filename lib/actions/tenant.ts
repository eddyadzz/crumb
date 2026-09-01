'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { requireTenant } from '@/lib/tenant';
import { slugify } from '@/lib/slug';

const TRIAL_DAYS = 14;

async function uniqueSlug(businessName: string): Promise<string> {
  const base = slugify(businessName);
  const existing = await prisma.tenant.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(existing.map((t) => t.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export interface CreateTenantInput {
  businessName: string;
  phone?: string;
  country?: string;
}

export async function createTenant(input: CreateTenantInput) {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user) return { error: 'Unauthorized' };
  if (user.tenantId) return { error: 'You are already part of a business' };

  const name = input.businessName.trim();
  if (!name) return { error: 'Business name is required' };

  const slug = await uniqueSlug(name);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const freeTier = await prisma.subscriptionTier.findUniqueOrThrow({
    where: { key: 'FREE' },
  });

  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug,
      email: user.email,
      phone: input.phone?.trim() || null,
      country: input.country?.trim() || null,
      status: 'ACTIVE',
      subscriptionTier: 'FREE',
      subscriptionStatus: 'TRIAL',
      trialEndsAt,
    },
  });

  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      tierId: freeTier.id,
      status: 'TRIAL',
      startsAt: new Date(),
      endsAt: trialEndsAt,
      autoRenew: true,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { tenantId: tenant.id, role: 'OWNER', isOwner: true },
  });

  revalidatePath('/');
  return { tenant };
}

export interface AccountInfo {
  email: string;
  name: string;
  role: string;
  isOwner: boolean;
  tenantId: string;
  tenantName: string;
  slug: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
}

export async function getAccountInfo(): Promise<AccountInfo> {
  const ctx = await requireTenant();
  return {
    email: ctx.email,
    name: ctx.name,
    role: ctx.role,
    isOwner: ctx.isOwner,
    tenantId: ctx.tenantId,
    tenantName: ctx.tenant.name,
    slug: ctx.tenant.slug,
    subscriptionTier: ctx.tenant.subscriptionTier,
    subscriptionStatus: ctx.tenant.subscriptionStatus,
    trialEndsAt: ctx.tenant.trialEndsAt?.toISOString() ?? null,
  };
}