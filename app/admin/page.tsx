import { adminGetDashboard, adminListTenants } from '@/lib/actions/admin';
import { AdminClient } from './admin-client';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [stats, tenants] = await Promise.all([
    adminGetDashboard(),
    adminListTenants(),
  ]);

  return <AdminClient stats={stats} tenants={tenants} />;
}