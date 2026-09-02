import 'server-only';
import { prisma } from '@/lib/prisma';
import { sendNotificationDigestEmail } from '@/lib/mail';
import { nonDuplicateDrafts } from '@/lib/notifications-core';

/**
 * Daily notifications pass. Idempotent per calendar day: creates the low-stock,
 * production-due-today and orders-due notices once per day per tenant, and sends
 * a single digest email (respecting per-tenant e-mail prefs). Returns a summary.
 */
export async function runNotificationsCron(): Promise<{
  tenants: number;
  created: number;
  emailSent: number;
  errors: Array<{ tenantId: string; message: string }>;
}> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const endOfTomorrow = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000);
  const todayKey = startOfToday.toISOString().slice(0, 10);

  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      email: true,
      notifLowStockEmail: true,
      notifOrdersEmail: true,
      notifProductionEmail: true,
      notifBillingEmail: true,
      notifTrialEmail: true,
    },
  });

  const summary = { tenants: 0, created: 0, emailSent: 0, errors: [] as Array<{ tenantId: string; message: string }> };

  for (const tenant of tenants) {
    try {
      summary.tenants += 1;

      const [lowStock, production, ordersToday, ordersTomorrow, existing] = await Promise.all([
        prisma.ingredient.count({
          where: { tenantId: tenant.id, availableQuantity: { lte: prisma.ingredient.fields.reorderLevel } },
        }),
        // Production counts: open (planned/in-progress) production orders.
        prisma.productionItem.count({
          where: { productionOrder: { tenantId: tenant.id, status: { in: ['PLANNED', 'IN_PROGRESS'] } } },
        }),
        prisma.customerOrder.count({
          where: {
            tenantId: tenant.id,
            status: { in: ['CONFIRMED', 'IN_PRODUCTION', 'READY'] },
            deliveryDate: { gte: startOfToday, lt: startOfTomorrow },
          },
        }),
        prisma.customerOrder.count({
          where: {
            tenantId: tenant.id,
            status: { in: ['CONFIRMED', 'IN_PRODUCTION', 'READY'] },
            deliveryDate: { gte: startOfTomorrow, lt: endOfTomorrow },
          },
        }),
        prisma.notification.findMany({
          where: { tenantId: tenant.id },
          select: { type: true, createdAt: true },
        }),
      ]);

      const { drafts, emailLines } = nonDuplicateDrafts(
        existing,
        todayKey,
        { lowStock, production, ordersToday, ordersTomorrow, dayKey: todayKey },
        tenant
      );

      if (drafts.length > 0) {
        await prisma.notification.createMany({
          data: drafts.map((d) => ({
            tenantId: tenant.id,
            type: d.type,
            severity: d.severity,
            title: d.title,
            message: d.message,
            link: d.link,
          })),
        });
        summary.created += drafts.length;
      }

      // One digest email when there's anything new and email is enabled for it.
      if (emailLines.length > 0) {
        const to = tenant.email;
        if (to) {
          await sendNotificationDigestEmail({ to, tenantName: tenant.name, lines: emailLines }).catch(() => {});
          summary.emailSent += 1;
        }
      }
    } catch (err) {
      summary.errors.push({
        tenantId: tenant.id,
        message: err instanceof Error ? err.message : 'Notification cron failed for tenant',
      });
    }
  }

  return summary;
}