'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/tenant';

/** Turn the public order portal (/order/{slug}) on or off. */
export async function setOrderPortalEnabled(enabled: boolean): Promise<boolean> {
  const { tenantId } = await requirePermission('settings.manage');
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { orderPortalEnabled: enabled },
  });
  revalidatePath('/settings');
  return enabled;
}