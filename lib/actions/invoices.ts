'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission, requireTenantWritable } from '@/lib/tenant';
import { sendOrderInvoiceEmail } from '@/lib/mail';
import { recordActivity } from '@/lib/activity';

/** Read the tenant's pay-to block for display before saving. */
export async function getInvoiceDetails(): Promise<string | null> {
  const { tenantId } = await requireTenantWritable();
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { invoiceDetails: true },
  });
  return t?.invoiceDetails ?? null;
}

export async function setInvoiceDetails(text: string): Promise<string> {
  const { tenantId } = await requirePermission('settings.manage');
  const trimmed = text.trim().slice(0, 2000) || null;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { invoiceDetails: trimmed },
  });
  revalidatePath('/settings');
  revalidatePath('/orders');
  revalidatePath('/');
  return trimmed ?? '';
}

export interface SendInvoiceResult {
  ok: boolean;
  error?: string;
  sentAt?: string;
}

/**
 * Email the invoice for an order — usable from CONFIRMED onward (re-sendable
 * after DELIVERED). Idempotent via invoiceSentAt: a second send does not reset
 * that stamp. Requires the baker's pay-to block and the customer's email.
 */
export async function sendOrderInvoice(
  orderId: string,
): Promise<SendInvoiceResult> {
  const { tenantId, userId } = await requirePermission('billing.manage');
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, invoiceDetails: true },
  });
  if (!t) return { ok: false, error: 'Business not found' };

  const order = await prisma.customerOrder.findFirst({
    where: { id: orderId, tenantId },
    include: {
      items: { include: { product: { select: { name: true } } } },
      customer: { select: { name: true, email: true } },
    },
  });
  if (!order) return { ok: false, error: 'Order not found' };
  if (order.status === 'PENDING')
    return { ok: false, error: 'Confirm the order before invoicing' };

  const to = order.customer?.email ?? null;
  if (!to) return { ok: false, error: 'This customer has no email saved' };

  if (!t.invoiceDetails?.trim())
    return {
      ok: false,
      error: 'Add your payment details in Settings before sending invoices',
    };

  const emailItem = () =>
    sendOrderInvoiceEmail({
      to,
      tenantName: t.name,
      orderReference: order.publicToken ?? order.id.slice(-6).toUpperCase(),
      items: order.items.map((i) => ({
        quantity: i.quantity,
        name: i.product.name,
        amount: i.quantity * i.unitPrice,
      })),
      totalAmount: order.totalAmount,
      paymentDetails: t.invoiceDetails,
    });

  // Re-send path: email again without touching the invoiceSentAt stamp.
  if (order.invoiceSentAt) {
    await emailItem();
    return { ok: true, sentAt: order.invoiceSentAt.toISOString() };
  }

  const sentAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.customerOrder.update({
      where: { id: order.id },
      data: { invoiceSentAt: sentAt },
    });
    await emailItem();
  });

  await recordActivity({
    tenantId,
    actorUserId: userId,
    type: 'ORDER_CONFIRMED',
    title: `Invoice sent for order ${orderId.slice(-4).toUpperCase()}`,
    description: `Emailed to ${to}`,
    entityType: 'CustomerOrder',
    entityId: order.id,
  });

  await prisma.notification.create({
    data: {
      tenantId,
      type: 'CUSTOMER_ORDER',
      severity: 'SUCCESS',
      title: 'Invoice sent',
      message: `Your invoice to ${to} is on its way.`,
      link: '/orders',
    },
  });

  revalidatePath('/orders');
  revalidatePath('/');
  return { ok: true, sentAt: sentAt.toISOString() };
}
