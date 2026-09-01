'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePlatformAdmin } from '@/lib/admin';
import { slugify } from '@/lib/slug';

export async function adminGetDashboard() {
  await requirePlatformAdmin();

  const [totalTenants, activeTenants, trialTenants, expiredTrials, tierCounts, activeSubs] =
    await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.tenant.count({ where: { subscriptionStatus: 'TRIAL' } }),
      prisma.tenant.count({
        where: { subscriptionStatus: 'TRIAL', trialEndsAt: { lt: new Date() } },
      }),
      prisma.tenant.groupBy({ by: ['subscriptionTier'], _count: { _all: true } }),
      prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        include: { tier: true },
      }),
    ]);

  const mrr = activeSubs.reduce((sum, sub) => sum + sub.tier.priceMonthly, 0);
  const tierCount: Record<string, number> = {};
  for (const t of tierCounts) tierCount[t.subscriptionTier] = t._count._all;

  return {
    totalTenants,
    activeTenants,
    trialTenants,
    expiredTrials,
    suspendedTenants: totalTenants - activeTenants,
    tierCount,
    mrr,
  };
}

export async function adminListTenants() {
  await requirePlatformAdmin();

  return prisma.tenant.findMany({
    include: {
      users: { select: { id: true, name: true, email: true, role: true, isOwner: true, createdAt: true } },
      _count: { select: { users: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function adminSetTenantStatus(input: {
  tenantId: string;
  status: 'ACTIVE' | 'SUSPENDED';
}) {
  await requirePlatformAdmin();

  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { id: true },
  });
  if (!tenant) throw new Error('Tenant not found');

  await prisma.tenant.update({
    where: { id: input.tenantId },
    data: { status: input.status },
  });

  revalidatePath('/admin');
  return { id: input.tenantId, status: input.status };
}

export interface AdminCreateTenantInput {
  name: string;
  ownerName?: string;
  ownerEmail?: string;
}

export async function adminCreateTenant(input: AdminCreateTenantInput) {
  await requirePlatformAdmin();

  const name = input.name.trim();
  if (!name) throw new Error('Business name is required');

  const base = slugify(name);
  const slug = base === 'business' ? `tenant-${Date.now()}` : base;

  let slugCandidate = slug;
  let i = 2;
  for (;;) {
    const exists = await prisma.tenant.findUnique({
      where: { slug: slugCandidate },
      select: { id: true },
    });
    if (!exists) break;
    slugCandidate = `${slug}-${i}`;
    i += 1;
  }

  const freeTier = await prisma.subscriptionTier.findUniqueOrThrow({
    where: { key: 'FREE' },
  });

  let ownerEmail: string | null = null;
  if (input.ownerEmail?.trim()) {
    ownerEmail = input.ownerEmail.trim().toLowerCase();
    const existingOwner = await prisma.user.findUnique({
      where: { email: ownerEmail },
      select: { id: true, tenantId: true },
    });
    if (existingOwner?.tenantId) {
      throw new Error(
        `User ${ownerEmail} already belongs to another business and cannot be made owner`
      );
    }
  }

  const tenant = await prisma.$transaction(async (tx) => {
    const t = await tx.tenant.create({
      data: {
        name,
        slug: slugCandidate,
        email: ownerEmail,
        status: 'ACTIVE',
        subscriptionTier: 'FREE',
        subscriptionStatus: 'ACTIVE',
      },
    });

    await tx.subscription.create({
      data: {
        tenantId: t.id,
        tierId: freeTier.id,
        status: 'ACTIVE',
        startsAt: new Date(),
        autoRenew: false,
      },
    });

    if (ownerEmail) {
      const ownerName = input.ownerName?.trim();
      const existingOwner = await tx.user.findUnique({
        where: { email: ownerEmail },
        select: { id: true },
      });
      if (existingOwner) {
        await tx.user.update({
          where: { id: existingOwner.id },
          data: { tenantId: t.id, role: 'OWNER', isOwner: true, name: ownerName || undefined },
        });
      } else {
        await tx.user.create({
          data: {
            name: ownerName || name,
            email: ownerEmail,
            emailVerified: true,
            tenantId: t.id,
            role: 'OWNER',
            isOwner: true,
          },
        });
      }
    }

    return t;
  });

  revalidatePath('/admin');
  return { id: tenant.id, slug: slugCandidate };
}