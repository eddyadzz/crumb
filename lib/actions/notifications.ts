'use server';

import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';

export interface NotificationRow {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export async function listNotifications(take = 200): Promise<NotificationRow[]> {
  const { tenantId } = await requireTenant();
  const rows = await prisma.notification.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take,
  });
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    severity: n.severity,
    title: n.title,
    message: n.message,
    link: n.link,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function unreadNotificationCount(): Promise<number> {
  const { tenantId } = await requireTenant();
  return prisma.notification.count({ where: { tenantId, read: false } });
}

export async function markNotificationRead(id: string) {
  const { tenantId } = await requireTenant();
  const notification = await prisma.notification.findUnique({
    where: { id },
    select: { tenantId: true, read: true },
  });
  if (!notification || notification.tenantId !== tenantId) throw new Error('Notification not found');
  if (notification.read) return;
  await prisma.notification.update({
    where: { id },
    data: { read: true, readAt: new Date() },
  });
  revalidatePath('/notifications');
}

export async function markAllNotificationsRead() {
  const { tenantId } = await requireTenant();
  await prisma.notification.updateMany({
    where: { tenantId, read: false },
    data: { read: true, readAt: new Date() },
  });
  revalidatePath('/notifications');
}

export async function deleteNotification(id: string) {
  const { tenantId } = await requireTenant();
  const notification = await prisma.notification.findUnique({
    where: { id },
    select: { tenantId: true },
  });
  if (!notification || notification.tenantId !== tenantId) throw new Error('Notification not found');
  await prisma.notification.delete({ where: { id } });
  revalidatePath('/notifications');
}

export interface NotificationPrefs {
  notifLowStockEmail: boolean;
  notifOrdersEmail: boolean;
  notifProductionEmail: boolean;
  notifBillingEmail: boolean;
  notifTrialEmail: boolean;
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const { tenantId } = await requireTenant();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      notifLowStockEmail: true,
      notifOrdersEmail: true,
      notifProductionEmail: true,
      notifBillingEmail: true,
      notifTrialEmail: true,
    },
  });
  if (!tenant) throw new Error('Tenant not found');
  return tenant;
}

export async function updateNotificationPrefs(input: NotificationPrefs) {
  const { tenantId } = await requireTenant();
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      notifLowStockEmail: Boolean(input.notifLowStockEmail),
      notifOrdersEmail: Boolean(input.notifOrdersEmail),
      notifProductionEmail: Boolean(input.notifProductionEmail),
      notifBillingEmail: Boolean(input.notifBillingEmail),
      notifTrialEmail: Boolean(input.notifTrialEmail),
    },
  });
  revalidatePath('/settings');
}