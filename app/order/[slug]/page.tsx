import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ChefHat } from 'lucide-react';
import { OrderPortalForm } from './order-form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Order — Crumb',
};

/** Public, session-free order page: /order/{tenant-slug}. */
export default async function OrderPortalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, status: true, orderPortalEnabled: true },
  });
  if (!tenant || tenant.status === 'SUSPENDED' || !tenant.orderPortalEnabled) notFound();

  const products = await prisma.product.findMany({
    where: { tenantId: tenant.id, sellingPrice: { gt: 0 } },
    select: { id: true, name: true, sellingPrice: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-lg items-center gap-2.5 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ChefHat className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-lg font-bold leading-none tracking-tight">{tenant.name}</p>
            <p className="text-[11px] text-muted-foreground">powered by Crumb</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-lg p-4 pb-16">
        <OrderPortalForm
          slug={tenant.slug}
          products={products}
        />
      </main>
    </div>
  );
}