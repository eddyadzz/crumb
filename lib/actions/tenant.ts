'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { requireTenant, requireTenantWritable } from '@/lib/tenant';
import { slugify } from '@/lib/slug';
import { resolvePlanFeatures, type PlanFeatures } from '@/lib/plans';
import { sendTrialStartedEmail, sendWelcomeEmail } from '@/lib/mail';
import type { StockPolicy } from '@prisma/client';

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

  const existingMembership = await prisma.membership.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existingMembership) return { error: 'You are already part of a business' };

  const name = input.businessName.trim();
  if (!name) return { error: 'Business name is required' };

  const slug = await uniqueSlug(name);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const trialStartedAt = new Date();
  const freePlan = await prisma.plan.findUnique({ where: { code: 'free' } });
  if (!freePlan) return { error: 'Setup incomplete: free plan is missing' };

  const tenant = await prisma.$transaction(async (tx) => {
    const t = await tx.tenant.create({
      data: {
        name,
        slug,
        email: user.email,
        phone: input.phone?.trim() || null,
        country: input.country?.trim() || null,
        status: 'ACTIVE',
      },
    });

    await tx.subscription.create({
      data: {
        tenantId: t.id,
        planId: freePlan.id,
        status: 'TRIAL',
        billingInterval: 'MONTHLY',
        startsAt: new Date(),
        endsAt: trialEndsAt,
        trialEndsAt,
        trialStartedAt,
        autoRenew: true,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { tenantId: t.id },
    });

    await tx.membership.create({
      data: { userId: user.id, tenantId: t.id, role: 'OWNER' },
    });

    return t;
  });

  revalidatePath('/');

  // Lifecycle emails are best-effort — onboarding must not depend on Mailgun.
  await Promise.allSettled([
    sendWelcomeEmail({ to: user.email, name: user.name || name }),
    sendTrialStartedEmail({
      to: user.email,
      tenantName: name,
      planName: freePlan.name,
      trialEndsAt,
    }),
  ]);

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
  planCode: string | null;
  planName: string | null;
  planFeatures: PlanFeatures;
  subscriptionStatus: string | null;
  billingInterval: string | null;
  trialEndsAt: string | null;
  trialExpired: boolean;
}

export async function getAccountInfo(): Promise<AccountInfo> {
  const ctx = await requireTenant();
  const sub = ctx.tenant.subscription;
  return {
    email: ctx.email,
    name: ctx.name,
    role: ctx.role,
    isOwner: ctx.isOwner,
    tenantId: ctx.tenantId,
    tenantName: ctx.tenant.name,
    slug: ctx.tenant.slug,
    planCode: ctx.tenant.plan?.code ?? null,
    planName: ctx.tenant.plan?.name ?? null,
    planFeatures: ctx.tenant.plan?.features ?? {},
    subscriptionStatus: sub?.status ?? null,
    billingInterval: sub?.billingInterval ?? null,
    trialEndsAt: sub?.trialEndsAt?.toISOString() ?? null,
    trialExpired: ctx.trialExpired,
  };
}

export interface PlanInfo {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  sortOrder: number;
  features: PlanFeatures;
}

export async function listPlans(): Promise<PlanInfo[]> {
  await requireTenant();
  const plans = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });
  return plans.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    monthlyPrice: Number(p.monthlyPrice),
    yearlyPrice: Number(p.yearlyPrice),
    sortOrder: p.sortOrder,
    features: resolvePlanFeatures(p),
  }));
}

export async function getStockPolicy(): Promise<StockPolicy> {
  const { tenantId } = await requireTenant();
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stockPolicy: true },
  });
  return t?.stockPolicy ?? 'WARN';
}

export async function setStockPolicy(policy: StockPolicy) {
  const { tenantId } = await requireTenantWritable();
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { stockPolicy: policy },
  });
  revalidatePath('/');
  revalidatePath('/produce');
  revalidatePath('/settings');
  return policy;
}