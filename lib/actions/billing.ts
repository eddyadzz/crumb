'use server';

import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/tenant';
import { resolvePlanFeatures, type PlanFeatures } from '@/lib/plans';
import { sendSubscriptionRequestReceivedEmail } from '@/lib/mail';
import { recordActivity } from '@/lib/activity';

export interface PaymentMethodInfo {
  id: string;
  name: string;
  code: string;
  details: string | null;
  currency: string | null;
}

export interface UpgradePlanInfo {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  features: PlanFeatures;
}

export interface UpgradeRequestInfo {
  id: string;
  planName: string;
  paymentMethodName: string;
  billingInterval: string;
  referenceNumber: string;
  status: string;
  createdAt: string;
  reviewNotes: string | null;
}

export async function listPaymentMethods(): Promise<PaymentMethodInfo[]> {
  await requireTenant();
  const methods = await prisma.paymentMethod.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });
  return methods.map((m) => ({
    id: m.id,
    name: m.name,
    code: m.code,
    details: m.details,
    currency: m.currency,
  }));
}

/** Active, upgradeable plans. Includes free so the UI can render all tiers. */
export async function listUpgradePlans(): Promise<UpgradePlanInfo[]> {
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
    features: resolvePlanFeatures(p),
  }));
}

const MAX_PROOF_CHARS = 8 * 1024 * 1024; // ~6MB binary as base64

export interface SubmitSubscriptionRequestInput {
  planId: string;
  paymentMethodId: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
  referenceNumber: string;
  proofImage?: string | null; // base64 data-URL; optional
  notes?: string | null;
}

export type SubmitResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function submitSubscriptionRequest(
  input: SubmitSubscriptionRequestInput
): Promise<SubmitResult> {
  const ctx = await requireTenant();

  const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
  if (!plan || !plan.active) return { ok: false, error: 'Plan not found' };
  if (plan.code === 'free') return { ok: false, error: 'Cannot request the Free plan' };

  const method = await prisma.paymentMethod.findFirst({
    where: { id: input.paymentMethodId, active: true },
  });
  if (!method) return { ok: false, error: 'Payment method not available' };

  const referenceNumber = input.referenceNumber?.trim() || '';
  if (!referenceNumber) return { ok: false, error: 'Reference number is required' };

  const proofImage = input.proofImage?.trim() || null;
  if (proofImage && proofImage.length > MAX_PROOF_CHARS) {
    return { ok: false, error: 'Proof image is too large (max 6MB)' };
  }

  // A tenant already on the target plan (and active) doesn't need to re-request.
  const currentPlanCode = ctx.tenant.plan?.code;
  if (plan.code === currentPlanCode) {
    return { ok: false, error: `You are already on the ${plan.name} plan` };
  }

  const request = await prisma.subscriptionRequest.create({
    data: {
      tenantId: ctx.tenantId,
      requestedPlanId: plan.id,
      paymentMethodId: method.id,
      billingInterval: input.billingInterval,
      referenceNumber,
      proofImage,
      notes: input.notes?.trim() || null,
      status: 'PENDING',
    },
  });

  await recordActivity({
    tenantId: ctx.tenantId,
    type: 'UPGRADE_REQUESTED',
    title: `Requested ${plan.name} upgrade`,
    description: `${method.name} · ${input.billingInterval.toLowerCase()}`,
    entityType: 'SubscriptionRequest',
    entityId: request.id,
  });

  // Best-effort notification; the request is already saved.
  const owner = await prisma.membership.findFirst({
    where: { tenantId: ctx.tenantId, role: 'OWNER' },
    select: { user: { select: { email: true } } },
  });
  if (owner?.user.email) {
    await sendSubscriptionRequestReceivedEmail({
      to: owner.user.email,
      tenantName: ctx.tenant.name,
      planName: plan.name,
    }).catch(() => {});
  }

  await prisma.notification.create({
    data: {
      tenantId: ctx.tenantId,
      type: 'UPGRADE_REQUEST',
      severity: 'INFO',
      title: `Upgrade request submitted`,
      message: `We received your request to upgrade to ${plan.name}. We'll notify you once it's approved.`,
      link: '/settings',
    },
  });

  return { ok: true, id: request.id };
}

export async function getMyRequests(): Promise<UpgradeRequestInfo[]> {
  const ctx = await requireTenant();
  const requests = await prisma.subscriptionRequest.findMany({
    where: { tenantId: ctx.tenantId },
    include: {
      requestedPlan: { select: { name: true } },
      paymentMethod: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  return requests.map((r) => ({
    id: r.id,
    planName: r.requestedPlan.name,
    paymentMethodName: r.paymentMethod.name,
    billingInterval: r.billingInterval,
    referenceNumber: r.referenceNumber,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    reviewNotes: r.reviewNotes,
  }));
}