import 'server-only';
import { prisma } from '@/lib/prisma';
import { defaultTitle } from '@/lib/activity-core';
import type { ActivityType } from '@prisma/client';

export interface RecordActivityInput {
  tenantId: string;
  actorUserId?: string | null;
  actorName?: string | null;
  type: ActivityType;
  title?: string;
  description?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

/**
 * Centralized, best-effort insertion into the tenant activity timeline.
 * Call this everywhere an auditable action happens instead of writing to
 * ActivityEvent directly — keeps the stream consistent and gives a single
 * choke point for future webhooks / audit exports.
 */
export async function recordActivity(input: RecordActivityInput): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId ?? null,
        actorName: input.actorName ?? null,
        type: input.type,
        title: input.title ?? defaultTitle(input.type),
        description: input.description ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
    });
  } catch (err) {
    // Activity is observability, not the primary path — never fail the action.
    console.error('[crumb:activity] record failed', err);
  }
}