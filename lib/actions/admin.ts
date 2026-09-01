'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePlatformAdmin } from '@/lib/admin';
import { slugify } from '@/lib/slug';
import { sendSubscriptionActivatedEmail, sendWelcomeEmail } from '@/lib/mail';

export async function adminGetDashboard() {
  await requirePlatformAdmin();

  const [totalTenants, activeTenants, subscriptions] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.findMany({
      select: {
        status: true,
        trialEndsAt: true,
        billingInterval: true,
        plan: { select: { code: true, monthlyPrice: true, yearlyPrice: true } },
      },
    }),
  ]);

  const now = new Date();
  const planCount: Record<string, number> = {};
  let mrr = 0;
  let payingTenants = 0;
  let trialTenants = 0;
  let expiredTrials = 0;

  for (const sub of subscriptions) {
    planCount[sub.plan.code] = (planCount[sub.plan.code] ?? 0) + 1;
    if (sub.status === 'TRIAL') {
      trialTenants += 1;
      if (sub.trialEndsAt && sub.trialEndsAt < now) expiredTrials += 1;
    } else if (sub.status === 'ACTIVE' && sub.plan.code !== 'free') {
      const monthly =
        sub.billingInterval === 'YEARLY'
          ? Number(sub.plan.yearlyPrice) / 12
          : Number(sub.plan.monthlyPrice);
      mrr += monthly;
      payingTenants += 1;
    }
  }

  return {
    totalTenants,
    activeTenants,
    trialTenants,
    expiredTrials,
    suspendedTenants: totalTenants - activeTenants,
    payingTenants,
    planCount,
    mrr,
  };
}

export async function adminListTenants() {
  await requirePlatformAdmin();

  return prisma.tenant.findMany({
    include: {
      users: { select: { id: true, name: true, email: true, role: true, isOwner: true, createdAt: true } },
      _count: { select: { users: true } },
      subscription: {
        select: {
          status: true,
          billingInterval: true,
          trialEndsAt: true,
          plan: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function adminGetBilling() {
  await requirePlatformAdmin();

  const [plans, subscriptions] = await Promise.all([
    prisma.plan.findMany({
      include: { _count: { select: { subscriptions: true } } },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.subscription.findMany({
      include: {
        tenant: { select: { id: true, name: true, slug: true, email: true } },
        plan: {
          select: {
            id: true,
            code: true,
            name: true,
            monthlyPrice: true,
            yearlyPrice: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    plans: plans.map((p) => ({
      ...p,
      monthlyPrice: Number(p.monthlyPrice),
      yearlyPrice: Number(p.yearlyPrice),
    })),
    subscriptions,
  };
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

  const freePlan = await prisma.plan.findUniqueOrThrow({ where: { code: 'free' } });

  let ownerEmail: string | null = null;
  let ownerName: string | null = null;
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
      },
    });

    await tx.subscription.create({
      data: {
        tenantId: t.id,
        planId: freePlan.id,
        status: 'ACTIVE',
        billingInterval: 'MONTHLY',
        startsAt: new Date(),
        autoRenew: false,
      },
    });

    if (ownerEmail) {
      const candidateName = input.ownerName?.trim();
      const existingOwner = await tx.user.findUnique({
        where: { email: ownerEmail },
        select: { id: true },
      });
      if (existingOwner) {
        await tx.user.update({
          where: { id: existingOwner.id },
          data: { tenantId: t.id, role: 'OWNER', isOwner: true, name: candidateName || undefined },
        });
      } else {
        await tx.user.create({
          data: {
            name: candidateName || name,
            email: ownerEmail,
            emailVerified: true,
            tenantId: t.id,
            role: 'OWNER',
            isOwner: true,
          },
        });
      }
      ownerName = candidateName || name;
    }

    return t;
  });

  if (ownerEmail) {
    await Promise.allSettled([
      sendWelcomeEmail({ to: ownerEmail, name: ownerName ?? name }),
      sendSubscriptionActivatedEmail({
        to: ownerEmail,
        tenantName: name,
        planName: freePlan.name,
        amount: 0,
        interval: 'monthly',
      }),
    ]);
  }

  revalidatePath('/admin');
  return { id: tenant.id, slug: slugCandidate };
}

export type AdminSubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'SUSPENDED'
  | 'CANCELLED';

/**
 * Manual subscription administration (no payment provider yet). Swaps a
 * tenant's plan and/or status, and optionally restarts a trial. Stripe will
 * later drive the same transitions from webhook events.
 */
export async function adminSetPlan(input: {
  tenantId: string;
  planId: string;
  status?: AdminSubscriptionStatus;
  trialDays?: number;
}) {
  await requirePlatformAdmin();

  const existing = await prisma.subscription.findUnique({
    where: { tenantId: input.tenantId },
    include: { plan: true, tenant: { select: { name: true, email: true } } },
  });
  if (!existing) throw new Error('No subscription found for this tenant');

  const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
  if (!plan) throw new Error('Plan not found');

  const status = input.status ?? (existing.status === 'TRIAL' ? 'TRIAL' : 'ACTIVE');
  const now = new Date();

  let trialEndsAt = existing.trialEndsAt;
  if (status === 'TRIAL') {
    const base =
      existing.status === 'TRIAL' && existing.trialEndsAt && existing.trialEndsAt > now
        ? existing.trialEndsAt
        : now;
    trialEndsAt =
      typeof input.trialDays === 'number'
        ? new Date(base.getTime() + input.trialDays * 24 * 60 * 60 * 1000)
        : base;
  } else {
    trialEndsAt = null;
  }

  const startsAt = status === 'ACTIVE' && existing.status !== 'ACTIVE' ? now : existing.startsAt;
  const periodMs =
    existing.billingInterval === 'YEARLY'
      ? 365 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;
  const endsAt =
    status === 'ACTIVE' && plan.code !== 'free'
      ? new Date(now.getTime() + periodMs)
      : status === 'TRIAL'
        ? trialEndsAt
        : existing.endsAt;

  const updated = await prisma.subscription.update({
    where: { tenantId: input.tenantId },
    data: { planId: plan.id, status, trialEndsAt, endsAt, startsAt },
    include: {
      plan: { select: { code: true, name: true, monthlyPrice: true, yearlyPrice: true } },
    },
  });

  if (plan.code !== 'free' && status === 'ACTIVE' && existing.tenant.email) {
    const amount =
      existing.billingInterval === 'YEARLY'
        ? Number(plan.yearlyPrice)
        : Number(plan.monthlyPrice);
    await sendSubscriptionActivatedEmail({
      to: existing.tenant.email,
      tenantName: existing.tenant.name,
      planName: plan.name,
      amount,
      interval: existing.billingInterval.toLowerCase(),
    }).catch(() => {});
  }

  revalidatePath('/admin');
  return updated;
}

export async function adminExtendTrial(input: { tenantId: string; days: number }) {
  await requirePlatformAdmin();

  const existing = await prisma.subscription.findUnique({
    where: { tenantId: input.tenantId },
  });
  if (!existing) throw new Error('No subscription found for this tenant');

  const now = new Date();
  const base =
    existing.status === 'TRIAL' && existing.trialEndsAt && existing.trialEndsAt > now
      ? existing.trialEndsAt
      : now;
  const trialEndsAt = new Date(base.getTime() + input.days * 24 * 60 * 60 * 1000);

  await prisma.subscription.update({
    where: { tenantId: input.tenantId },
    data: { status: 'TRIAL', trialEndsAt, endsAt: trialEndsAt, autoRenew: true },
  });

  revalidatePath('/admin');
  return { tenantId: input.tenantId, trialEndsAt };
}