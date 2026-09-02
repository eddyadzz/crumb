import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { NotificationsClient } from './notifications-client';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const { tenantId } = await getTenantContext();
  const rows = await prisma.notification.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <NotificationsClient
      initial={rows.map((n) => ({
        id: n.id,
        type: n.type,
        severity: n.severity,
        title: n.title,
        message: n.message,
        link: n.link,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      }))}
    />
  );
}