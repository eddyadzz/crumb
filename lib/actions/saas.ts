'use server';

import { prisma } from '@/lib/prisma';
import { requirePlatformAdmin } from '@/lib/admin';

export type TenantOverview = {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  expiredTrials: number;
  suspendedTenants: number;
  payingTenants: number;
  planCount: Record<string, number>;
  mrr: number;
};

export async function saasGetOverview(): Promise<TenantOverview> {
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

export type SubscriptionQueueRow = {
  id: string;
  tenantName: string;
  planName: string;
  planCode: string;
  paymentMethodName: string;
  billingInterval: string;
  referenceNumber: string;
  hasProof: boolean;
  status: string;
  createdAt: string;
};

export async function saasGetSubscriptionQueue(): Promise<{
  pending: SubscriptionQueueRow[];
  approvedToday: number;
  rejectedToday: number;
}> {
  await requirePlatformAdmin();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const [requests, approvedToday, rejectedToday] = await Promise.all([
    prisma.subscriptionRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        tenant: { select: { name: true } },
        requestedPlan: { select: { name: true, code: true } },
        paymentMethod: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    }),
    prisma.subscriptionRequest.count({
      where: { status: 'APPROVED', reviewedAt: { gte: startOfDay, lt: endOfDay } },
    }),
    prisma.subscriptionRequest.count({
      where: { status: 'REJECTED', reviewedAt: { gte: startOfDay, lt: endOfDay } },
    }),
  ]);

  return {
    pending: requests.map((r) => ({
      id: r.id,
      tenantName: r.tenant.name,
      planName: r.requestedPlan.name,
      planCode: r.requestedPlan.code,
      paymentMethodName: r.paymentMethod.name,
      billingInterval: r.billingInterval,
      referenceNumber: r.referenceNumber,
      hasProof: Boolean(r.proofImage),
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    approvedToday,
    rejectedToday,
  };
}

export type EmailHealthRow = {
  id: string;
  job: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  message: string | null;
};

export async function saasGetEmailHealth(): Promise<{
  notificationsGenerated24h: number;
  digestEmailsSent24h: number;
  lastRuns: EmailHealthRow[];
}> {
  await requirePlatformAdmin();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [notifCount, emailedCount, lastRuns] = await Promise.all([
    prisma.notification.count({ where: { createdAt: { gte: since } } }),
    prisma.notification.count({ where: { createdAt: { gte: since }, emailed: true } }),
    prisma.systemJobRun.findMany({
      where: { job: { in: ['notifications', 'trial-emails'] } },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
  ]);

  return {
    notificationsGenerated24h: notifCount,
    digestEmailsSent24h: emailedCount,
    lastRuns: lastRuns.map((r) => ({
      id: r.id,
      job: r.job,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      message: r.message,
    })),
  };
}

export type RecentActivityRow = {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  at: string;
};

export async function saasGetRecentActivity(take = 15): Promise<RecentActivityRow[]> {
  await requirePlatformAdmin();

  const [tenants, requests, trials] = await Promise.all([
    prisma.tenant.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.subscriptionRequest.findMany({
      where: { status: { in: ['APPROVED', 'REJECTED'] } },
      include: { tenant: { select: { name: true } }, requestedPlan: { select: { name: true } } },
      orderBy: { reviewedAt: 'desc' },
      take: 10,
    }),
    prisma.subscription.findMany({
      where: { status: 'TRIAL' },
      include: { tenant: { select: { name: true } } },
      orderBy: { trialEndsAt: 'asc' },
      take: 10,
    }),
  ]);

  const now = Date.now();

  const rows: RecentActivityRow[] = [];

  for (const t of tenants) {
    rows.push({
      id: `t-${t.id}`,
      kind: 'tenant',
      title: 'New tenant created',
      detail: t.name,
      at: t.createdAt.toISOString(),
    });
  }

  for (const r of requests) {
    rows.push({
      id: `r-${r.id}`,
      kind: 'upgrade',
      title: `Upgrade ${r.status.toLowerCase()}`,
      detail: `${r.tenant.name} → ${r.requestedPlan.name}`,
      at: r.reviewedAt?.toISOString() ?? r.createdAt.toISOString(),
    });
  }

  for (const s of trials) {
    if (!s.trialEndsAt) continue;
    const diff = s.trialEndsAt.getTime() - now;
    const expired = diff <= 0;
    rows.push({
      id: `trial-${s.id}`,
      kind: 'trial',
      title: expired ? 'Trial expired' : 'Trial ending',
      detail: `${s.tenant.name} · ${s.trialEndsAt.toLocaleDateString()}`,
      at: s.trialEndsAt.toISOString(),
    });
  }

  return rows
    .sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : 0))
    .slice(0, take);
}