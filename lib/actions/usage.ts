'use server';

import { requireTenant } from '@/lib/tenant';
import { recordUsage } from '@/lib/usage';
import { UsageEventType } from '@/lib/usage-events';

/** Record that an offline sync finished uploading queued Floor Mode actions. */
export async function recordOfflineSyncCompleted(uploaded: number): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  await recordUsage({
    tenantId,
    userId,
    eventType: UsageEventType.OFFLINE_SYNC_COMPLETED,
    route: '/floor',
    metadata: { uploaded },
  });
}
