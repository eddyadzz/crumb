import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { SellClient } from './sell-client';

export const dynamic = 'force-dynamic';

export default async function SellPage() {
  const { tenantId } = await getTenantContext();
  const products = await prisma.product.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  });

  const vm = products.map((p) => ({
    id: p.id,
    name: p.name,
    sellingPrice: p.sellingPrice,
    availableQuantity: p.availableQuantity,
  }));

  return <SellClient products={vm} />;
}
