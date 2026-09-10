import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getOrderProfitPreviews } from '@/lib/queries';
import { OrdersClient } from './orders-client';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const { tenantId } = await getTenantContext();
  const [orders, customers, products] = await Promise.all([
    prisma.customerOrder.findMany({
      where: { tenantId },
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.customer.findMany({
      where: { tenantId },
      include: { _count: { select: { orders: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    }),
  ]);

  const previews = await getOrderProfitPreviews(tenantId);

  return (
    <OrdersClient
      profitPreviews={previews}
      orders={orders.map((o) => ({
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
      }))}
      customers={customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        notes: c.notes,
        orderCount: c._count.orders,
      }))}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        sellingPrice: p.sellingPrice,
        availableQuantity: p.availableQuantity,
      }))}
    />
  );
}