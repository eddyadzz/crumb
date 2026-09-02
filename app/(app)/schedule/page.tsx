import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { ScheduleClient } from './schedule-client';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const { tenantId } = await getTenantContext();

  const [orders, productionOrders] = await Promise.all([
    prisma.customerOrder.findMany({
      where: { tenantId },
      include: {
        customer: { select: { name: true, phone: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: [{ deliveryDate: 'asc' }, { deliveryTime: 'asc' }, { createdAt: 'asc' }],
      take: 500,
    }),
    prisma.productionOrder.findMany({
      where: { tenantId, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
      select: { id: true },
    }),
  ]);

  return (
    <ScheduleClient
      hasActiveProduction={productionOrders.length > 0}
      orders={orders.map((o) => ({
        id: o.id,
        status: o.status,
        customerName: o.customer?.name ?? null,
        customerPhone: o.customer?.phone ?? null,
        totalAmount: o.totalAmount,
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
      }))}
    />
  );
}