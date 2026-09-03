'use server';

import { prisma } from '@/lib/prisma';
import { aggregateBatches, forecastRequirements } from '@/lib/forecast';
import { buildBriefing, briefingNotificationCopy } from '@/lib/briefing';
import { sendOrderReminderEmail } from '@/lib/mail';

export interface ReminderSummary {
  scanned: number;
  notified: number;
  emailed: number;
  skipped: number;
  errors: string[];
}

/**
 * The daily morning briefing: for every active tenant, summarise the orders
 * due tomorrow (confirmed ones), the batches to plan, ingredient shortages,
 * and expected revenue — then drop an in-app notification and (opted-in
 * tenants) send the email. Tenants with nothing due tomorrow are skipped so
 * the habit only forms around real work.
 */
export async function sendOrderReminders(): Promise<ReminderSummary> {
  const summary: ReminderSummary = { scanned: 0, notified: 0, emailed: 0, skipped: 0, errors: [] };

  const tomorrowStart = new Date();
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, email: true, notifOrdersEmail: true },
  });

  for (const tenant of tenants) {
    summary.scanned += 1;
    try {
      const orders = await prisma.customerOrder.findMany({
        where: {
          tenantId: tenant.id,
          status: { in: ['CONFIRMED', 'IN_PRODUCTION'] },
          deliveryDate: { gte: tomorrowStart, lt: tomorrowEnd },
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, type: true, recipe: { select: { id: true, name: true, servingsProduced: true } } },
              },
            },
          },
        },
      });
      if (orders.length === 0) {
        summary.skipped += 1;
        continue;
      }

      const batches = aggregateBatches(
        orders.flatMap((o) =>
          o.items.map((i) => ({
            quantity: i.quantity,
            productType: i.product.type,
            servingsProduced: i.product.recipe.servingsProduced,
            recipeId: i.product.recipe.id,
            recipeName: i.product.recipe.name,
          }))
        )
      );

      const recipes = await prisma.recipe.findMany({
        where: { tenantId: tenant.id },
        include: { recipeIngredients: { include: { ingredient: true } } },
      });
      const shortageRows = forecastRequirements(
        recipes.map((r) => ({
          id: r.id,
          ingredients: r.recipeIngredients.map((ri) => ({
            quantity: ri.quantity,
            unit: ri.unit,
            ingredient: {
              id: ri.ingredient.id,
              name: ri.ingredient.name,
              availableQuantity: ri.ingredient.availableQuantity,
              baseUnit: ri.ingredient.baseUnit,
              purchaseQuantity: ri.ingredient.purchaseQuantity,
              purchaseUnit: ri.ingredient.purchaseUnit,
              purchaseCost: ri.ingredient.purchaseCost,
            },
          })),
        })),
        batches
      );

      const briefing = buildBriefing({
        forDate: tomorrowStart,
        orders: orders.map((o) => ({
          totalAmount: o.totalAmount,
          items: o.items.map((i) => ({
            productId: i.product.id,
            productName: i.product.name,
            quantity: i.quantity,
          })),
        })),
        batches,
        shortageRows,
      });
      if (!briefing.hasContent) {
        summary.skipped += 1;
        continue;
      }

      const { title, message } = briefingNotificationCopy(briefing);
      await prisma.notification.create({
        data: {
          tenantId: tenant.id,
          type: 'CUSTOMER_ORDER',
          severity: 'INFO',
          title,
          message,
          link: '/schedule',
        },
      });
      summary.notified += 1;

      if (tenant.notifOrdersEmail) {
        const to =
          tenant.email ??
          (
            await prisma.membership.findFirst({
              where: { tenantId: tenant.id, role: 'OWNER' },
              select: { user: { select: { email: true } } },
            })
          )?.user.email;
        if (to) {
          await sendOrderReminderEmail({ to, tenantName: tenant.name, briefing });
          summary.emailed += 1;
        }
      }
    } catch (e) {
      summary.errors.push(
        `${tenant.name}: ${e instanceof Error ? e.message : 'reminder failed'}`
      );
    }
  }

  return summary;
}

/** True when a successful reminder run already happened today (cron retries
 * and double-fires must not duplicate the briefing). */
export async function remindersAlreadySentToday(): Promise<boolean> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const run = await prisma.systemJobRun.findFirst({
    where: { job: 'order-reminders', status: 'SUCCESS', startedAt: { gte: startOfToday } },
    select: { id: true },
  });
  return run !== null;
}