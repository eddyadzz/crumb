'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireTenant, requireTenantWritable } from '@/lib/tenant';
import { orderTotal, canTransition, planFromOrderLines } from '@/lib/orders';
import { newOrderPublicToken } from '@/lib/public-token';
import { recordActivity } from '@/lib/activity';
import { recordUsage } from '@/lib/usage';
import { UsageEventType } from '@/lib/usage-events';
import { fireWebhook } from '@/lib/webhooks';
import type { OrderStatus } from '@prisma/client';

export interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  orderCount: number;
}

export async function listCustomers(): Promise<CustomerRow[]> {
  await requireTenant();
  const customers = await prisma.customer.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { orders: true } } },
  });
  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    orderCount: c._count.orders,
  }));
}

export async function createCustomer(input: {
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
}) {
  const { tenantId } = await requireTenantWritable();
  const name = input.name?.trim();
  if (!name) throw new Error('Customer name is required');
  const customer = await prisma.customer.create({
    data: {
      tenantId,
      name,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
  revalidatePath('/orders');
  return customer;
}

export interface OrderLineInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateOrderInput {
  customerId?: string | null;
  lines: OrderLineInput[];
  deliveryDate?: string | null; // ISO date (date only) or null
  deliveryTime?: string | null;
  notes?: string | null;
}

export async function createOrder(input: CreateOrderInput) {
  const { tenantId } = await requireTenantWritable();
  const valid = input.lines.filter((l) => l.quantity > 0 && l.productId);
  if (valid.length === 0) throw new Error('Add at least one product');

  const productIds = [...new Set(valid.map((l) => l.productId))];
  const owned = await prisma.product.findMany({
    where: { id: { in: productIds }, tenantId },
    select: { id: true, sellingPrice: true },
  });
  if (owned.length !== productIds.length) throw new Error('One or more products not found');

  const priceById = new Map(owned.map((p) => [p.id, p.sellingPrice]));
  const totalAmount = orderTotal(valid.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice })));

  const order = await prisma.customerOrder.create({
    data: {
      tenantId,
      customerId: input.customerId || null,
      status: 'PENDING',
      publicToken: newOrderPublicToken(),
      totalAmount,
      deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : null,
      deliveryTime: input.deliveryTime?.trim() || null,
      notes: input.notes?.trim() || null,
      items: {
        create: valid.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: priceById.get(l.productId) ?? l.unitPrice,
        })),
      },
    },
    include: {
      items: { include: { product: { select: { name: true } } } },
    },
  });

  const vm: OrderRow = {
    id: order.id,
    status: order.status,
    customerName: (input.customerId
      ? await prisma.customer.findUnique({ where: { id: input.customerId }, select: { name: true } })
      : null)?.name ?? null,
    totalAmount: order.totalAmount,
    publicToken: order.publicToken,
    deliveryDate: order.deliveryDate?.toISOString() ?? null,
    deliveryTime: order.deliveryTime,
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((i) => ({
      id: i.id,
      productName: i.product.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  };

  const itemsLabel = vm.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ');
  await recordActivity({
    tenantId,
    type: 'ORDER_CREATED',
    title: `Created order for ${itemsLabel}`,
    description: vm.customerName ? `For ${vm.customerName}` : null,
    entityType: 'CustomerOrder',
    entityId: vm.id,
  });

  await fireWebhook(tenantId, 'order.created', {
    id: vm.id,
    totalAmount: vm.totalAmount,
    customerName: vm.customerName,
    items: vm.items.map((i) => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice })),
  });

  await recordUsage({
    tenantId,
    eventType: UsageEventType.ORDER_CREATED,
    route: '/orders',
    metadata: { itemCount: vm.items.length },
  });

  revalidatePath('/orders');
  revalidatePath('/');
  return vm;
}

/** Set an order status, enforcing the legal forward transitions. */
export async function setOrderStatus(orderId: string, to: OrderStatus) {
  const { tenantId } = await requireTenantWritable();
  const order = await prisma.customerOrder.findUnique({
    where: { id: orderId, tenantId },
  });
  if (!order) throw new Error('Order not found');
  if (order.status === to) return order;
  if (!canTransition(order.status, to)) {
    throw new Error(`Cannot move an order from ${order.status} to ${to}`);
  }
  const updated = await prisma.customerOrder.update({
    where: { id: orderId },
    data: { status: to },
  });

  if (to === 'CONFIRMED') {
    await recordActivity({
      tenantId,
      type: 'ORDER_CONFIRMED',
      title: 'Order confirmed',
      entityType: 'CustomerOrder',
      entityId: orderId,
    });
    await fireWebhook(tenantId, 'order.confirmed', { id: orderId });
  } else if (to === 'CANCELLED') {
    await recordActivity({
      tenantId,
      type: 'ORDER_CANCELLED',
      title: 'Order cancelled',
      entityType: 'CustomerOrder',
      entityId: orderId,
    });
    await fireWebhook(tenantId, 'order.cancelled', { id: orderId });
  }

  revalidatePath('/orders');
  revalidatePath('/');
  return updated;
}

export interface OrderRow {
  id: string;
  status: OrderStatus;
  customerName: string | null;
  totalAmount: number;
  publicToken: string | null;
  deliveryDate: string | null;
  deliveryTime: string | null;
  notes: string | null;
  createdAt: string;
  items: { id: string; productName: string; quantity: number; unitPrice: number }[];
}

export async function listOrders(): Promise<OrderRow[]> {
  await requireTenant();
  const orders = await prisma.customerOrder.findMany({
    include: {
      customer: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return orders.map((o) => ({
    id: o.id,
    status: o.status,
    customerName: o.customer?.name ?? null,
    totalAmount: o.totalAmount,
    publicToken: o.publicToken,
    deliveryDate: o.deliveryDate?.toISOString() ?? null,
    deliveryTime: o.deliveryTime,
    notes: o.notes,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      productName: i.product.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  }));
}

/** Build a production plan from selected orders; returns recipe-batch items the Produce screen can consume. */
export async function buildPlanFromOrders(orderIds: string[]): Promise<{
  recipeItems: Array<{ recipeId: string; recipeName: string; batchCount: number }>;
}> {
  const { tenantId } = await requireTenant();
  const orders = await prisma.customerOrder.findMany({
    where: { id: { in: orderIds }, tenantId, status: { in: ['CONFIRMED', 'IN_PRODUCTION', 'READY'] } },
    include: {
      items: {
        include: {
          product: {
            include: { recipe: { select: { id: true, name: true, servingsProduced: true } } },
          },
        },
      },
    },
  });

  const lines = orders.flatMap((o) =>
    o.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      recipeId: i.product.recipe.id,
      recipeName: i.product.recipe.name,
      servingsProduced: i.product.recipe.servingsProduced,
      productType: i.product.type,
    }))
  );
  return planFromOrderLines(lines);
}