import {
  adminGetDashboard,
  adminListTenants,
  adminGetBilling,
  adminListRequests,
  adminListPaymentMethods,
} from '@/lib/actions/admin';
import { AdminClient } from './admin-client';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [stats, tenants, billing, requests, paymentMethods] = await Promise.all([
    adminGetDashboard(),
    adminListTenants(),
    adminGetBilling(),
    adminListRequests(),
    adminListPaymentMethods(),
  ]);

  return (
    <AdminClient
      stats={stats}
      tenants={tenants}
      billing={billing}
      requests={requests}
      paymentMethods={paymentMethods}
    />
  );
}