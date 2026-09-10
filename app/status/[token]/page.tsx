import { notFound } from 'next/navigation';
import { CheckCircle2, Circle, XCircle, Phone, MessageCircle } from 'lucide-react';
import { CrumbLogo } from '@/components/crumb-logo';
import { prisma } from '@/lib/prisma';
import { recordUsage } from '@/lib/usage';
import { UsageEventType } from '@/lib/usage-events';
import { orderTimeline } from '@/lib/orders';
import { isValidOrderPublicToken } from '@/lib/public-token';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Order Status — Crumb',
};

/** Public, session-free order status page: /status/{publicToken}. */
export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isValidOrderPublicToken(token)) notFound();

  const order = await prisma.customerOrder.findUnique({
    where: { publicToken: token },
    include: {
      tenant: { select: { name: true, phone: true } },
      customer: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });
  if (!order) notFound();

  await recordUsage({
    tenantId: order.tenantId,
    eventType: UsageEventType.STATUS_PAGE_VIEWED,
    route: `/status/${token}`,
    metadata: { orderId: order.id },
  });

  const cancelled = order.status === 'CANCELLED';
  const steps = cancelled ? null : orderTimeline(order.status);
  const waDigits = order.tenant.phone?.replace(/[^\d]/g, '');

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-lg items-center gap-2.5 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center">
            <CrumbLogo className="h-9 w-9" />
          </div>
          <div>
            <p className="font-display text-lg font-bold leading-none tracking-tight">{order.tenant.name}</p>
            <p className="text-[11px] text-muted-foreground">powered by Crumb</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4 pb-16">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Order status</p>
          <p className="font-display text-2xl font-bold">
            {cancelled ? (
              <span className="text-destructive">Order cancelled</span>
            ) : steps ? (
              steps.filter((s) => s.done).at(-1)?.label ?? 'Order Received'
            ) : null}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Reference <span className="font-mono font-bold">{order.publicToken}</span>
            {' · '}
            placed {order.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </p>
          {cancelled && (
            <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              This order was cancelled. Questions? Contact {order.tenant.name} below.
            </p>
          )}
        </div>

        {steps && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <ol className="relative space-y-5">
              {steps.map((step, i) => (
                <li key={step.key} className="relative flex items-start gap-3">
                  {i < steps.length - 1 && (
                    <span
                      className={`absolute left-[11px] top-6 h-full w-0.5 ${step.done ? 'bg-success/50' : 'bg-border'}`}
                      aria-hidden
                    />
                  )}
                  {step.done ? (
                    <CheckCircle2 className="z-10 h-6 w-6 shrink-0 text-success" />
                  ) : (
                    <Circle className="z-10 h-6 w-6 shrink-0 text-muted-foreground" />
                  )}
                  <div className={step.done ? '' : 'text-muted-foreground'}>
                    <p className={`text-sm font-semibold ${step.done ? '' : 'text-muted-foreground'}`}>
                      {step.label}
                    </p>
                    {i === 0 && (
                      <p className="text-xs text-muted-foreground">
                        {order.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {', '}
                        {order.createdAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
              This page updates automatically as we bake — bookmark it and check any time.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order summary</p>
          <div className="space-y-1.5">
            {order.items.map((i) => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{i.quantity}× {i.product.name}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
            <p className="flex justify-between">
              <span className="text-muted-foreground">Delivery</span>
              <span>
                {order.deliveryDate
                  ? order.deliveryDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                  : 'To be arranged'}
                {order.deliveryTime ? ` · ${order.deliveryTime}` : ''}
              </span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span>{order.customer?.name ?? '—'}</span>
            </p>
            <p className="flex justify-between font-semibold">
              <span>Total</span>
              <span>MVR {order.totalAmount.toFixed(2)}</span>
            </p>
          </div>
        </div>

        {order.tenant.phone && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Questions?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {waDigits && (
                <a
                  href={`https://wa.me/${waDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm font-semibold text-success"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              )}
              <a
                href={`tel:${order.tenant.phone.replace(/\s/g, '')}`}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm font-semibold"
              >
                <Phone className="h-4 w-4" />
                Call
              </a>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          {cancelled ? (
            <span className="inline-flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" />
              Cancelled orders cannot be reopened online
            </span>
          ) : null}
        </p>
      </main>
    </div>
  );
}