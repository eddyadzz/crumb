import { NextResponse } from 'next/server';
import { withApiAuth, ApiAuthError, scopeGate } from '@/lib/api-key-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** GET /api/v1/inventory — list the tenant's raw ingredient stock levels. */
export async function GET(request: Request) {
  try {
    const { tenantId } = await withApiAuth(bearer(request), scopeGate.inventory.read);
    const ingredients = await prisma.ingredient.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({
      data: ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        baseUnit: i.baseUnit,
        availableQuantity: i.availableQuantity,
        purchaseQuantity: i.purchaseQuantity,
        purchaseUnit: i.purchaseUnit,
        purchaseCost: i.purchaseCost,
        reorderLevel: i.reorderLevel,
        lowStock: i.availableQuantity <= i.reorderLevel,
      })),
    });
  } catch (e) {
    if (e instanceof ApiAuthError) return error(e.status, e.message);
    console.error('[api/v1/inventory]', e);
    return error(500, 'Internal error');
  }
}

function bearer(request: Request): string | null {
  const h = request.headers.get('authorization');
  if (!h) return null;
  const [scheme, token] = h.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}