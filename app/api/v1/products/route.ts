import { NextResponse } from 'next/server';
import { withApiAuth, ApiAuthError, scopeGate } from '@/lib/api-key-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** GET /api/v1/products — list the tenant's finished-goods catalog. */
export async function GET(request: Request) {
  try {
    const { tenantId } = await withApiAuth(bearer(request), scopeGate.orders.read);
    const products = await prisma.product.findMany({
      where: { tenantId },
      include: { recipe: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({
      data: products.map((p) => ({
        id: p.id,
        name: p.name,
        sellingPrice: p.sellingPrice,
        availableQuantity: p.availableQuantity,
        type: p.type,
        recipe: p.recipe,
      })),
    });
  } catch (e) {
    if (e instanceof ApiAuthError) return error(e.status, e.message);
    console.error('[api/v1/products]', e);
    return error(500, 'Internal error');
  }
}

function bearer(request: Request): string | null {
  const h = request.headers.get('authorization');
  if (!h) return null;
  const [scheme, token] = h.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}