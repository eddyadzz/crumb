'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/tenant';

export interface SaleLineItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export async function processSale(input: { items: SaleLineItem[] }) {
  const { tenantId } = await requireTenant();
  const valid = input.items.filter((i) => i.quantity > 0);
  if (valid.length === 0) return null;

  const productIds = [...new Set(valid.map((i) => i.productId))];
  const owned = await prisma.product.findMany({
    where: { id: { in: productIds }, tenantId },
    select: { id: true },
  });
  if (owned.length !== productIds.length) {
    throw new Error('One or more products not found');
  }

  const sale = await prisma.sale.create({
    data: {
      tenantId,
      totalAmount: valid.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
      items: {
        create: valid.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      },
    },
  });

  for (const item of valid) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId, tenantId },
    });
    if (!product) continue;
    await prisma.product.update({
      where: { id: item.productId },
      data: { availableQuantity: Math.max(0, product.availableQuantity - item.quantity) },
    });
    await prisma.productMovement.create({
      data: { productId: item.productId, type: 'SOLD', quantity: item.quantity },
    });
  }

  revalidatePath('/sell');
  revalidatePath('/products');
  revalidatePath('/reports');
  revalidatePath('/');
  return sale;
}