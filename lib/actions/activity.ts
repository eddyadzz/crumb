'use server';

import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/tenant';

export interface ActivityRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
  actorName: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

export async function listActivity(take = 100): Promise<ActivityRow[]> {
  const { tenantId } = await requireTenant();
  const rows = await prisma.activityEvent.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take,
  });
  return rows.map((e) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    description: e.description,
    actorName: e.actorName,
    entityType: e.entityType,
    entityId: e.entityId,
    createdAt: e.createdAt.toISOString(),
  }));
}

/** Latest few events for the dashboard widget. */
export async function listRecentActivity(take = 5): Promise<ActivityRow[]> {
  return listActivity(take);
}