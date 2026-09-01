import { adminGetDashboard, adminListTenants, adminGetBilling } from '@/lib/actions/admin';
import { AdminClient } from './admin-client';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [stats, tenants, billing] = await Promise.all([
    adminGetDashboard(),
    adminListTenants(),
    adminGetBilling(),
  ]);

  return <AdminClient stats={stats} tenants={tenants} billing={billing} />;
}