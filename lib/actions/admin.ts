'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePlatformAdmin } from '@/lib/admin';
import { slugify } from '@/lib/slug';
import {
  sendSubscriptionActivatedEmail,
  sendSubscriptionApprovedEmail,
  sendSubscriptionRejectedEmail,
  sendWelcomeEmail,
} from '@/lib/mail';
import { recordActivity } from '@/lib/activity';
import { getTenantUsageRows } from '@/lib/usage';
import { fireWebhook } from '@/lib/webhooks';

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
      memberships: {
        include: {
          user: { select: { id: true, name: true, email: true, createdAt: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { memberships: true, users: true } },
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
    const existingMembership = await prisma.membership.findFirst({
      where: { user: { email: ownerEmail } },
      select: { id: true },
    });
    if (existingMembership) {
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
          data: { tenantId: t.id, name: candidateName || undefined },
        });
        await tx.membership.create({
          data: { userId: existingOwner.id, tenantId: t.id, role: 'OWNER' },
        });
      } else {
        const created = await tx.user.create({
          data: {
            name: candidateName || name,
            email: ownerEmail,
            emailVerified: true,
            tenantId: t.id,
          },
        });
        await tx.membership.create({
          data: { userId: created.id, tenantId: t.id, role: 'OWNER' },
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
  let trialStartedAt = existing.trialStartedAt;
  let trialEmailSentFor: string | null = existing.trialEmailSentFor;
  if (status === 'TRIAL') {
    const isFreshTrial = existing.status !== 'TRIAL' || !existing.trialStartedAt;
    const base =
      existing.status === 'TRIAL' && existing.trialEndsAt && existing.trialEndsAt > now
        ? existing.trialEndsAt
        : now;
    trialEndsAt =
      typeof input.trialDays === 'number'
        ? new Date(base.getTime() + input.trialDays * 24 * 60 * 60 * 1000)
        : base;
    if (isFreshTrial) {
      trialStartedAt = now;
      trialEmailSentFor = null;
    }
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
    data: { planId: plan.id, status, trialEndsAt, trialStartedAt, trialEmailSentFor, endsAt, startsAt },
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
  const trialStartedAt = existing.trialStartedAt ?? now;
  // A manual extension restarts the reminder sequence so the tenant is nudged
  // again toward the new (later) expiry.
  const trialEmailSentFor: string | null = null;

  await prisma.subscription.update({
    where: { tenantId: input.tenantId },
    data: { status: 'TRIAL', trialEndsAt, trialStartedAt, trialEmailSentFor, endsAt: trialEndsAt, autoRenew: true },
  });

  revalidatePath('/admin');
  return { tenantId: input.tenantId, trialEndsAt };
}

export interface AdminSubscriptionRequestRow {
  id: string;
  tenantName: string;
  tenantId: string;
  planName: string;
  planCode: string;
  paymentMethodName: string;
  billingInterval: string;
  referenceNumber: string;
  hasProof: boolean;
  notes: string | null;
  status: string;
  createdAt: string;
  reviewNotes: string | null;
}

export async function adminListRequests(): Promise<AdminSubscriptionRequestRow[]> {
  await requirePlatformAdmin();
  const requests = await prisma.subscriptionRequest.findMany({
    include: {
      tenant: { select: { name: true, id: true } },
      requestedPlan: { select: { name: true, code: true } },
      paymentMethod: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return requests.map((r) => ({
    id: r.id,
    tenantName: r.tenant.name,
    tenantId: r.tenant.id,
    planName: r.requestedPlan.name,
    planCode: r.requestedPlan.code,
    paymentMethodName: r.paymentMethod.name,
    billingInterval: r.billingInterval,
    referenceNumber: r.referenceNumber,
    hasProof: Boolean(r.proofImage),
    notes: r.notes,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    reviewNotes: r.reviewNotes,
  }));
}

/** Detail (including the base64 proof) for a single request, for viewing in the modal. */
export async function adminGetRequest(requestId: string) {
  await requirePlatformAdmin();
  const req = await prisma.subscriptionRequest.findUnique({
    where: { id: requestId },
    include: {
      tenant: { select: { name: true, email: true } },
      requestedPlan: { select: { name: true, code: true } },
      paymentMethod: { select: { name: true, code: true, details: true } },
    },
  });
  return req;
}

export type AdminReviewAction = {
  requestId: string;
  status: 'APPROVED' | 'REJECTED';
  reviewNotes?: string;
};

export async function adminReviewRequest(input: AdminReviewAction) {
  const admin = await requirePlatformAdmin();

  const request = await prisma.subscriptionRequest.findUnique({
    where: { id: input.requestId },
    include: {
      tenant: { select: { name: true, email: true } },
      requestedPlan: { select: { id: true, name: true, code: true } },
    },
  });
  if (!request) throw new Error('Request not found');
  if (request.status !== 'PENDING') return { id: request.id, already: request.status };

  const now = new Date();
  const periodMs = request.billingInterval === 'YEARLY' ? 365 : 30;
  const endsAt = new Date(now.getTime() + periodMs * 24 * 60 * 60 * 1000);
  const reviewNotes = input.reviewNotes?.trim() || null;
  const reviewerId = admin.id;

  await prisma.$transaction(async (tx) => {
    if (input.status === 'APPROVED') {
      // Activate the subscription on the requested plan.
      await tx.subscription.update({
        where: { tenantId: request.tenantId },
        data: {
          planId: request.requestedPlan.id,
          status: 'ACTIVE',
          billingInterval: request.billingInterval,
          startsAt: now,
          endsAt,
          trialEndsAt: null,
          trialStartedAt: null,
          trialEmailSentFor: null,
          autoRenew: true,
        },
      });
      await tx.subscriptionRequest.update({
        where: { id: request.id },
        data: { status: 'APPROVED', reviewedAt: now, reviewedBy: reviewerId, reviewNotes },
      });
    } else {
      await tx.subscriptionRequest.update({
        where: { id: request.id },
        data: { status: 'REJECTED', reviewedAt: now, reviewedBy: reviewerId, reviewNotes },
      });
    }
  });

  // In-app notification for the tenant (inline billing event).
  await prisma.notification.create({
    data: {
      tenantId: request.tenantId,
      type: 'UPGRADE_REQUEST',
      severity: input.status === 'APPROVED' ? 'SUCCESS' : 'ERROR',
      title: input.status === 'APPROVED' ? `${request.requestedPlan.name} is now active` : `Upgrade to ${request.requestedPlan.name} declined`,
      message:
        input.status === 'APPROVED'
          ? `Your subscription is active. All ${request.requestedPlan.name} features are unlocked.`
          : reviewNotes
            ? `Reason: ${reviewNotes}`
            : 'Please check your payment and submit a new request.',
      link: '/settings',
    },
  });

  await recordActivity({
    tenantId: request.tenantId,
    type: input.status === 'APPROVED' ? 'UPGRADE_APPROVED' : 'UPGRADE_REJECTED',
    title: input.status === 'APPROVED' ? `${request.requestedPlan.name} upgrade approved` : `${request.requestedPlan.name} upgrade rejected`,
    description: reviewNotes ?? null,
    entityType: 'SubscriptionRequest',
    entityId: request.id,
  });

  await fireWebhook(request.tenantId, input.status === 'APPROVED' ? 'subscription.approved' : 'subscription.rejected', {
    id: request.id,
    planCode: request.requestedPlan.code,
    planName: request.requestedPlan.name,
    reviewNotes: reviewNotes ?? undefined,
  });

  // Notify the tenant owner (best-effort).
  const ownerEmail = request.tenant.email;
  if (ownerEmail) {
    if (input.status === 'APPROVED') {
      await sendSubscriptionApprovedEmail({
        to: ownerEmail,
        tenantName: request.tenant.name,
        planName: request.requestedPlan.name,
      }).catch(() => {});
    } else {
      await sendSubscriptionRejectedEmail({
        to: ownerEmail,
        tenantName: request.tenant.name,
        planName: request.requestedPlan.name,
        reason: reviewNotes,
      }).catch(() => {});
    }
  }

  revalidatePath('/admin');
  return { id: request.id, status: input.status };
}

export interface AdminPaymentMethodRow {
  id: string;
  name: string;
  code: string;
  details: string | null;
  currency: string | null;
  active: boolean;
  sortOrder: number;
}

export async function adminListPaymentMethods(): Promise<AdminPaymentMethodRow[]> {
  await requirePlatformAdmin();
  const methods = await prisma.paymentMethod.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  return methods.map((m) => ({
    id: m.id,
    name: m.name,
    code: m.code,
    details: m.details,
    currency: m.currency,
    active: m.active,
    sortOrder: m.sortOrder,
  }));
}

export async function adminSavePaymentMethod(input: {
  id?: string;
  name: string;
  code: string;
  details?: string | null;
  currency?: string | null;
  active?: boolean;
}) {
  await requirePlatformAdmin();
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase().replace(/\s+/g, '_');
  if (!name || !code) throw new Error('Name and code are required');

  if (input.id) {
    return prisma.paymentMethod.update({
      where: { id: input.id },
      data: { name, code, details: input.details || null, currency: input.currency || null, active: input.active ?? true },
    });
  }
  return prisma.paymentMethod.create({
    data: { name, code, details: input.details || null, currency: input.currency || null, active: input.active ?? true },
  });
}

export async function adminTogglePaymentMethod(id: string) {
  await requirePlatformAdmin();
  const m = await prisma.paymentMethod.findUnique({ where: { id } });
  if (!m) throw new Error('Payment method not found');
  return prisma.paymentMethod.update({
    where: { id },
    data: { active: !m.active },
  });
}
// --- Beta usage overview (Phase K-0) ---

export interface BetaUsageEventRow {
  eventType: string;
  last7: number;
  last30: number;
  allTime: number;
}

export interface BetaUsageTenantRow {
  tenantId: string;
  tenantName: string;
  status: string;
  events30: number;
  activeDays30: number;
  lastActivityAt: string | null;
}

export interface BetaUsageOverview {
  activeTenants7: number;
  activeTenants30: number;
  totalTenants: number;
  eventRows: BetaUsageEventRow[];
  tenantRows: BetaUsageTenantRow[];
}

/** Headline event types shown on the beta-usage page. */
const BETA_EVENT_TYPES = [
  'order_created',
  'recipe_created',
  'floor_session_started',
  'shopping_list_generated',
  'portal_order_received',
  'status_page_viewed',
  'production_started',
  'production_completed',
  'offline_sync_completed',
] as const;

export async function adminGetUsageOverview(): Promise<BetaUsageOverview> {
  await requirePlatformAdmin();

  const now = Date.now();
  const since7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [byType7, byType30, byTypeAll, tenantGroups7, tenants] = await Promise.all([
    prisma.usageEvent.groupBy({
      by: ['eventType'],
      where: { createdAt: { gte: since7 } },
      _count: { _all: true },
    }),
    prisma.usageEvent.groupBy({
      by: ['eventType'],
      where: { createdAt: { gte: since30 } },
      _count: { _all: true },
    }),
    prisma.usageEvent.groupBy({
      by: ['eventType'],
      _count: { _all: true },
    }),
    prisma.usageEvent.groupBy({
      by: ['tenantId'],
      where: { createdAt: { gte: since7 } },
      _count: { _all: true },
    }),
    prisma.tenant.findMany({
      select: { id: true, name: true, status: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const count7 = new Map(byType7.map((r) => [r.eventType, r._count._all]));
  const count30 = new Map(byType30.map((r) => [r.eventType, r._count._all]));
  const countAll = new Map(byTypeAll.map((r) => [r.eventType, r._count._all]));

  const eventRows: BetaUsageEventRow[] = BETA_EVENT_TYPES.map((eventType) => ({
    eventType,
    last7: count7.get(eventType) ?? 0,
    last30: count30.get(eventType) ?? 0,
    allTime: countAll.get(eventType) ?? 0,
  }));

  const usage30 = await getTenantUsageRows({ since: since30 });
  const eventsByTenant = new Map(usage30.map((r) => [r.tenantId, r.events]));
  const activeDaysByTenant = new Map(usage30.map((r) => [r.tenantId, r.activeDays]));
  const lastActivityByTenant = new Map(
    usage30.filter((r) => r.lastEventAt).map((r) => [r.tenantId, r.lastEventAt as Date]),
  );

  const tenantRows: BetaUsageTenantRow[] = tenants
    .map((t) => ({
      tenantId: t.id,
      tenantName: t.name,
      status: t.status,
      events30: eventsByTenant.get(t.id) ?? 0,
      activeDays30: activeDaysByTenant.get(t.id) ?? 0,
      lastActivityAt: lastActivityByTenant.get(t.id)?.toISOString() ?? null,
    }))
    .sort((a, b) => b.events30 - a.events30 || a.tenantName.localeCompare(b.tenantName));

  return {
    activeTenants7: tenantGroups7.length,
    activeTenants30: usage30.length,
    totalTenants: tenants.length,
    eventRows,
    tenantRows,
  };
}
