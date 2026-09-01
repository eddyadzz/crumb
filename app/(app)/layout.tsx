import { AppShell } from '@/components/app-shell';
import { getTenantContext } from '@/lib/tenant';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getTenantContext();

  return (
    <AppShell
      account={{
        tenantName: ctx.tenant.name,
        plan: ctx.tenant.subscriptionTier,
        subscriptionStatus: ctx.tenant.subscriptionStatus,
        trialEndsAt: ctx.tenant.trialEndsAt?.toISOString() ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}