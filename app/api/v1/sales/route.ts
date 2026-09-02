import { NextResponse } from 'next/server';
import { withApiAuth, ApiAuthError, scopeGate } from '@/lib/api-key-auth';
import { prisma } from '@/lib/prisma';
import { recordActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** POST /api/v1/sales — record a sale and decrement product stock. */
export async function POST(request: Request) {
  try {
    const { tenantId } = await withApiAuth(bearer(request), scopeGate.sales.write);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return error(400, 'Invalid JSON body');

    type SaleItemInput = { productId?: string; quantity?: number; unitPrice?: number };
    const rawItems: SaleItemInput[] = Array.isArray(body.items) ? body.items : [];
    const items: Array<{ productId: string; quantity: number; unitPrice: number }> = rawItems.filter(
      (i): i is { productId: string; quantity: number; unitPrice: number } =>
        !!i && !!i.productId && typeof i.quantity === 'number' && i.quantity > 0
    );
    if (items.length === 0) return error(400, 'Add at least one sale item');

    const productIds = [...new Set(items.map((i) => i.productId))];
    const owned = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: { id: true },
    });
    if (owned.length !== productIds.length) return error(400, 'One or more products not found');

    const sale = await prisma.sale.create({
      data: {
        tenantId,
        totalAmount: items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
        items: { create: items },
      },
    });

    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId, tenantId } });
      if (!product) continue;
      await prisma.product.update({
        where: { id: item.productId },
        data: { availableQuantity: Math.max(0, product.availableQuantity - item.quantity) },
      });
      await prisma.productMovement.create({
        data: { productId: item.productId, type: 'SOLD', quantity: item.quantity },
      });
    }

    await recordActivity({
      tenantId,
      type: 'SALE_COMPLETED',
      title: 'Sale recorded via API',
      description: `MVR ${sale.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      entityType: 'Sale',
      entityId: sale.id,
    });

    return NextResponse.json({ data: { id: sale.id, totalAmount: sale.totalAmount } }, { status: 201 });
  } catch (e) {
    if (e instanceof ApiAuthError) return error(e.status, e.message);
    console.error('[api/v1/sales]', e);
    return error(500, 'Internal error');
  }
}

function bearer(request: Request): string | null {
  const h = request.headers.get('authorization');
  if (!h) return null;
  const [scheme, token] = h.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}