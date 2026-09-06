'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/tenant';

export async function submitFeedback(
  message: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { tenantId, userId, name, email } = await requireTenant();
  const trimmed = message.trim();
  if (trimmed.length < 3) return { ok: false, error: 'Please write a bit more' };
  if (trimmed.length > 4000) return { ok: false, error: 'Message too long (max 4000 characters)' };

  await prisma.feedback.create({
    data: {
      tenantId,
      userId: userId,
      contactName: name,
      contactEmail: email,
      message: trimmed,
    },
  });

  revalidatePath('/admin/beta-usage');
  return { ok: true };
}
