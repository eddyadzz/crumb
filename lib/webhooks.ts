/**
 * Webhook delivery engine. Best-effort and intentionally non-blocking: dispatch
 * is scheduled without awaiting so order creation / sales / production are
 * never slowed by an unreachable endpoint. Each delivery is recorded as a
 * WebhookDelivery; failures also emit a WEBHOOK_DELIVERY_FAILED activity and a
 * SystemJobRun so they surface in the SaaS dashboard. No retry engine in v1.
 */
import 'server-only';

import { prisma } from '@/lib/prisma';
import { signatureHeader, hmacSignature, type WebhookEvent } from '@/lib/webhooks-core';
import { recordActivity } from '@/lib/activity';
import { startJob, finishJob } from '@/lib/jobs';

async function deliverToEndpoint(endpoint: {
  id: string;
  url: string;
  secret: string;
  name: string;
  tenantId: string;
}, event: WebhookEvent, payload: Record<string, unknown>): Promise<void> {
  const jobId = await startJob('webhook.deliver').catch(() => null);
  const body = JSON.stringify({
    event,
    data: payload,
    sentAt: new Date().toISOString(),
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const digest = hmacSignature(endpoint.secret, timestamp, body);
  const headers = {
    'Content-Type': 'application/json',
    'X-BoliFlow-Event': event,
    'X-BoliFlow-Timestamp': timestamp,
    'X-BoliFlow-Signature': signatureHeader(timestamp, digest),
  };

  try {
    const res = await fetch(endpoint.url, { method: 'POST', headers, body });
    const ok = res.ok;
    await prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        eventType: event,
        statusCode: res.status,
        success: ok,
        deliveredAt: new Date(),
        error: ok ? null : `HTTP ${res.status}`,
      },
    });
    if (ok) {
      if (jobId) await finishJob(jobId, 'SUCCESS').catch(() => {});
    } else {
      if (jobId) await finishJob(jobId, 'FAILED', `Webhook ${endpoint.name} → ${res.status}`).catch(() => {});
    }
    return;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    await prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        eventType: event,
        success: false,
        error: message,
        attempts: 1,
      },
    });
    if (jobId) await finishJob(jobId, 'FAILED', message).catch(() => {});
    await recordActivity({
      tenantId: endpoint.tenantId,
      type: 'WEBHOOK_DELIVERY_FAILED',
      title: `Webhook delivery failed for "${endpoint.name}"`,
      description: `${event} · ${endpoint.url} · ${message}`,
      entityType: 'WebhookEndpoint',
      entityId: endpoint.id,
    });
  }
}

/**
 * Fire `event` with `payload` to every enabled endpoint subscribed to it.
 * Non-blocking — dispatches each delivery without awaiting completion.
 */
export async function fireWebhook(
  tenantId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { tenantId, isEnabled: true, events: { has: event } },
      select: { id: true, url: true, secret: true, name: true, tenantId: true },
    });
    if (endpoints.length === 0) return;
    // Dispatch without blocking the caller.
    for (const ep of endpoints) {
      void deliverToEndpoint(ep, event, payload);
    }
  } catch (err) {
    console.error('[webhooks] fire failed', err);
  }
}