import { AppShell } from '@/components/app-shell';
import { SampleBanner } from '@/components/sample-banner';
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
        planName: ctx.tenant.plan?.name ?? 'Custom',
        subscriptionStatus: ctx.tenant.subscription?.status ?? 'ACTIVE',
        trialEndsAt: ctx.tenant.subscription?.trialEndsAt?.toISOString() ?? null,
      }}
    >
      {ctx.tenant.isSample && <SampleBanner />}
      {children}
    </AppShell>
  );
}