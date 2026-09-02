'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireFeature, type TenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/permissions-core';
import {
  generateWebhookSecret,
  isValidWebhookUrl,
  isWebhookEvent,
  WEBHOOK_EVENTS,
  type WebhookEvent,
} from '@/lib/webhooks-core';
import { recordActivity } from '@/lib/activity';
import type { UserRole } from '@prisma/client';

export interface WebhookEndpointRow {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  isEnabled: boolean;
  createdAt: string;
  // Secret is never returned after creation; exposed once on create.
}

export interface WebhookDeliveryRow {
  id: string;
  eventType: string;
  statusCode: number | null;
  success: boolean;
  error: string | null;
  createdAt: string;
}

/** Only owners may manage webhooks (webhooks is a Business feature). */
async function requireWebhookOwner(): Promise<TenantContext> {
  const ctx = await requireFeature('webhooks');
  if (!hasPermission(ctx.role as UserRole, 'settings.manage')) {
    throw new Error('You do not have permission to manage webhooks');
  }
  return ctx;
}

function toRow(e: { id: string; name: string; url: string; events: string[]; isEnabled: boolean; createdAt: Date }): WebhookEndpointRow {
  return {
    id: e.id,
    name: e.name,
    url: e.url,
    events: e.events.filter(isWebhookEvent),
    isEnabled: e.isEnabled,
    createdAt: e.createdAt.toISOString(),
  };
}

export async function listWebhookEndpoints(): Promise<WebhookEndpointRow[]> {
  const ctx = await requireWebhookOwner();
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: 'asc' },
  });
  return endpoints.map(toRow);
}

export async function listWebhookEvents(): Promise<WebhookEvent[]> {
  return [...WEBHOOK_EVENTS];
}

export type CreateWebhookResult =
  | { ok: true; id: string; secret: string }
  | { ok: false; error: string };

export async function createWebhook(input: { name: string; url: string; events: string[] }): Promise<CreateWebhookResult> {
  const ctx = await requireWebhookOwner();

  const name = input.name.trim();
  const url = input.url.trim();
  if (!name) return { ok: false, error: 'Name is required' };
  if (!isValidWebhookUrl(url)) return { ok: false, error: 'Enter a valid HTTPS endpoint' };

  const events = Array.from(new Set(input.events.filter(isWebhookEvent)));
  if (events.length === 0) return { ok: false, error: 'Select at least one event' };

  const secret = generateWebhookSecret();
  const record = await prisma.webhookEndpoint.create({
    data: { tenantId: ctx.tenantId, name, url, secret, events, createdById: ctx.userId },
  });

  await recordActivity({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    actorName: ctx.name,
    type: 'WEBHOOK_CREATED',
    title: `Created webhook "${name}"`,
    description: `${events.join(', ')} → ${url}`,
    entityType: 'WebhookEndpoint',
    entityId: record.id,
  });

  revalidatePath('/settings');
  return { ok: true, id: record.id, secret };
}

export type UpdateWebhookResult = { ok: true } | { ok: false; error: string };

export async function updateWebhook(
  id: string,
  input: { name?: string; url?: string; events?: string[]; isEnabled?: boolean }
): Promise<UpdateWebhookResult> {
  const ctx = await requireWebhookOwner();
  const existing = await prisma.webhookEndpoint.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) return { ok: false, error: 'Webhook not found' };

  const name = input.name?.trim() ?? existing.name;
  const url = input.url?.trim() ?? existing.url;
  if (!name) return { ok: false, error: 'Name is required' };
  if (input.url !== undefined && !isValidWebhookUrl(url)) return { ok: false, error: 'Enter a valid HTTPS endpoint' };
  const events = input.events !== undefined ? Array.from(new Set(input.events.filter(isWebhookEvent))) : existing.events;
  if (events.length === 0) return { ok: false, error: 'Select at least one event' };

  await prisma.webhookEndpoint.update({
    where: { id },
    data: { name, url, events, isEnabled: input.isEnabled ?? existing.isEnabled },
  });

  await recordActivity({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    actorName: ctx.name,
    type: 'WEBHOOK_UPDATED',
    title: `Updated webhook "${name}"`,
    description: `${events.join(', ')} → ${url}`,
    entityType: 'WebhookEndpoint',
    entityId: id,
  });

  revalidatePath('/settings');
  return { ok: true };
}

export async function deleteWebhook(id: string): Promise<UpdateWebhookResult> {
  const ctx = await requireWebhookOwner();
  const existing = await prisma.webhookEndpoint.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) return { ok: false, error: 'Webhook not found' };

  await prisma.webhookEndpoint.delete({ where: { id } });

  await recordActivity({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    actorName: ctx.name,
    type: 'WEBHOOK_DELETED',
    title: `Deleted webhook "${existing.name}"`,
    description: existing.url,
    entityType: 'WebhookEndpoint',
    entityId: id,
  });

  revalidatePath('/settings');
  return { ok: true };
}

export async function listWebhookDeliveries(endpointId: string): Promise<WebhookDeliveryRow[]> {
  const ctx = await requireWebhookOwner();
  const deliveries = await prisma.webhookDelivery.findMany({
    where: { endpointId, endpoint: { tenantId: ctx.tenantId } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return deliveries.map((d) => ({
    id: d.id,
    eventType: d.eventType,
    statusCode: d.statusCode,
    success: d.success,
    error: d.error,
    createdAt: d.createdAt.toISOString(),
  }));
}