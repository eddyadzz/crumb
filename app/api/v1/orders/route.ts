import { NextResponse } from 'next/server';
import { withApiAuth, ApiAuthError, scopeGate } from '@/lib/api-key-auth';
import { prisma } from '@/lib/prisma';
import { recordActivity } from '@/lib/activity';
import { newOrderPublicToken } from '@/lib/public-token';

export const dynamic = 'force-dynamic';

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** GET /api/v1/orders — list the tenant's recent customer orders. */
export async function GET(request: Request) {
  try {
    const { tenantId } = await withApiAuth(bearer(request), scopeGate.orders.read);
    const orders = await prisma.customerOrder.findMany({
      where: { tenantId },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        items: { include: { product: { select: { id: true, name: true, sellingPrice: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({
      data: orders.map((o) => ({
        id: o.id,
        status: o.status,
        customer: o.customer,
        totalAmount: o.totalAmount,
        deliveryDate: o.deliveryDate?.toISOString() ?? null,
        deliveryTime: o.deliveryTime,
        notes: o.notes,
        createdAt: o.createdAt.toISOString(),
        items: o.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.product.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      })),
    });
  } catch (e) {
    if (e instanceof ApiAuthError) return error(e.status, e.message);
    console.error('[api/v1/orders]', e);
    return error(500, 'Internal error');
  }
}

/** POST /api/v1/orders — create a customer order. */
export async function POST(request: Request) {
  try {
    const { tenantId } = await withApiAuth(bearer(request), scopeGate.orders.write);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return error(400, 'Invalid JSON body');

    type LineInput = { productId?: string; quantity?: number; unitPrice?: number };
    const rawLines: LineInput[] = Array.isArray(body.lines) ? body.lines : [];
    const lines: Array<{ productId: string; quantity: number; unitPrice?: number }> = rawLines.filter(
      (l): l is { productId: string; quantity: number; unitPrice?: number } =>
        !!l && !!l.productId && typeof l.quantity === 'number' && l.quantity > 0
    );
    if (lines.length === 0) return error(400, 'Add at least one product line');

    const productIds = [...new Set(lines.map((l) => l.productId))];
    const owned = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: { id: true, sellingPrice: true },
    });
    if (owned.length !== productIds.length) return error(400, 'One or more products not found');

    const priceById = new Map(owned.map((p) => [p.id, p.sellingPrice]));
    const totalAmount = lines.reduce((s, l) => s + l.quantity * (priceById.get(l.productId) ?? l.unitPrice ?? 0), 0);

    const order = await prisma.customerOrder.create({
      data: {
        tenantId,
        customerId: body.customerId || null,
        publicToken: newOrderPublicToken(),
        totalAmount,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
        deliveryTime: body.deliveryTime?.trim() || null,
        notes: body.notes?.trim() || null,
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: priceById.get(l.productId) ?? l.unitPrice ?? 0,
          })),
        },
      },
      include: {
        items: { include: { product: { select: { id: true, name: true } } } },
      },
    });

    await recordActivity({
      tenantId,
      type: 'ORDER_CREATED',
      title: 'Created order via API',
      description: order.items.map((i) => `${i.quantity}× ${i.product.name}`).join(', '),
      entityType: 'CustomerOrder',
      entityId: order.id,
    });

    return NextResponse.json({ data: { id: order.id, status: order.status, totalAmount: order.totalAmount } }, { status: 201 });
  } catch (e) {
    if (e instanceof ApiAuthError) return error(e.status, e.message);
    console.error('[api/v1/orders]', e);
    return error(500, 'Internal error');
  }
}

function bearer(request: Request): string | null {
  const h = request.headers.get('authorization');
  if (!h) return null;
  const [scheme, token] = h.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}