'use server';

import { prisma } from '@/lib/prisma';
import { recordActivity } from '@/lib/activity';
import { fireWebhook } from '@/lib/webhooks';
import { validatePortalOrder, type PortalOrderInput } from '@/lib/portal';
import { newOrderPublicToken } from '@/lib/public-token';

/**
 * Public order submission from the customer portal (/order/{slug}). No session
 * by design — the slug, portal-enabled flag, and per-field validation are the
 * gates. Creates or reuses the customer (matched by phone) and a PENDING
 * customer order that flows into Schedule → Forecast → Production once the
 * owner confirms it.
 */
export async function submitPortalOrder(
  slug: string,
  input: PortalOrderInput
): Promise<{ ok: true; reference: string; token: string } | { ok: false; error: string }> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true, orderPortalEnabled: true },
  });
  if (!tenant || tenant.status === 'SUSPENDED' || !tenant.orderPortalEnabled) {
    return { ok: false, error: 'This order page is not available' };
  }

  const result = validatePortalOrder(input, { minDate: new Date() });
  if (!result.ok) return result;
  const value = result.value;

  const product = await prisma.product.findFirst({
    where: { id: value.productId, tenantId: tenant.id, sellingPrice: { gt: 0 } },
    select: { id: true, sellingPrice: true, name: true },
  });
  if (!product) return { ok: false, error: 'That item is no longer available' };

  // Reuse an existing customer with the same phone; create one otherwise.
  let customer = await prisma.customer.findFirst({
    where: { tenantId: tenant.id, phone: value.phone },
    select: { id: true },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: value.name,
        phone: value.phone,
        notes: 'Created via order portal',
      },
      select: { id: true },
    });
  }

  const token = newOrderPublicToken();
  const totalAmount = value.quantity * product.sellingPrice;
  const order = await prisma.customerOrder.create({
    data: {
      tenantId: tenant.id,
      customerId: customer.id,
      status: 'PENDING',
      publicToken: token,
      totalAmount,
      deliveryDate: value.deliveryDate,
      deliveryTime: value.deliveryTime,
      notes: value.message ? `${value.message} (via order portal)` : 'Via order portal',
      items: {
        create: [{ productId: product.id, quantity: value.quantity, unitPrice: product.sellingPrice }],
      },
    },
    select: { id: true },
  });

  await prisma.notification.create({
    data: {
      tenantId: tenant.id,
      type: 'CUSTOMER_ORDER',
      severity: 'INFO',
      title: 'New order from your portal',
      message: `${value.name} — ${value.quantity}× ${product.name} for ${value.deliveryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      link: '/orders',
    },
  });

  await recordActivity({
    tenantId: tenant.id,
    type: 'ORDER_CREATED',
    title: `Portal order: ${value.quantity}× ${product.name}`,
    description: `For ${value.name} (${value.phone})`,
    entityType: 'CustomerOrder',
    entityId: order.id,
  });

  await fireWebhook(tenant.id, 'order.created', {
    id: order.id,
    source: 'portal',
    customerName: value.name,
    totalAmount,
    items: [{ productName: product.name, quantity: value.quantity, unitPrice: product.sellingPrice }],
  });

  return { ok: true, reference: order.id.slice(-6).toUpperCase(), token };
}