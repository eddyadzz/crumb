'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Bell, Moon, Info, LogOut, Loader2, CreditCard, Check } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { getAccountInfo, listPlans } from '@/lib/actions/tenant';
import type { AccountInfo, PlanInfo } from '@/lib/actions/tenant';
import { FEATURE_KEYS } from '@/lib/plans';

export default function SettingsPage() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAccountInfo(), listPlans()])
      .then(([info, planList]) => {
        if (cancelled) return;
        setAccount(info);
        setPlans(planList);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const includedFeatures = account
    ? FEATURE_KEYS.filter((f) => account.planFeatures[f] === true)
    : [];

  const handleSignOut = async () => {
    setSigningOut(true);
    await authClient.signOut();
    router.push('/sign-in');
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title="Settings" description="Manage your preferences" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5 text-muted-foreground" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Business</p>
              <p className="text-xs text-muted-foreground">
                {account?.tenantName ?? 'Loading...'}
              </p>
            </div>
            {account && (
              <Badge variant="secondary">
                {account.planName ?? 'Loading...'}
                {account.subscriptionStatus === 'TRIAL' ? ' · Trial' : ''}
              </Badge>
            )}
          </div>
          {account?.subscriptionStatus === 'TRIAL' && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Trial</p>
                  <p className="text-xs text-muted-foreground">
                    {account.trialEndsAt
                      ? `Ends ${new Date(account.trialEndsAt).toLocaleDateString()}`
                      : 'No end date set'}
                  </p>
                </div>
              </div>
              <Separator />
            </>
          )}
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Signed in as</p>
              <p className="text-xs text-muted-foreground">{account?.email ?? '...'}</p>
            </div>
            {account && <Badge variant="outline">{account.role}</Badge>}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Workspace URL</p>
              <p className="text-xs text-muted-foreground">
                {account ? `/ ${account.slug}` : '...'}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Currency</p>
              <p className="text-xs text-muted-foreground">MVR (Maldivian Rufiyaa)</p>
            </div>
          </div>
          <Separator />
          <Button
            variant="outline"
            className="w-full gap-2 text-destructive hover:text-destructive"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Sign Out
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            Billing &amp; Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-3">
            {plans.length === 0 && (
              <p className="text-sm text-muted-foreground">Loading plans...</p>
            )}
            {plans.map((p) => {
              const current = p.code === account?.planCode;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border p-4"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {p.name}
                      {current && (
                        <Badge variant="secondary" className="ml-2">
                          Current
                        </Badge>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      MVR {p.monthlyPrice}/mo or MVR {p.yearlyPrice}/yr
                    </p>
                    {current && includedFeatures.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {includedFeatures.map((f) => (
                          <span
                            key={f}
                            className="inline-flex items-center gap-1 rounded-full bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary"
                          >
                            <Check className="h-3 w-3" />
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {current ? (
                    <Badge variant="outline">Active</Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      title="Online payments are coming soon"
                    >
                      Switch plan
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="pt-1 text-xs text-muted-foreground">
            Upgrades and downgrades at checkout are coming soon. Contact BoliFlow to
            change plans today.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5 text-muted-foreground" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Low Stock Alerts</p>
              <p className="text-xs text-muted-foreground">
                Get notified when ingredients run low
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Production Reminders</p>
              <p className="text-xs text-muted-foreground">
                Daily production plan reminders
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Daily Sales Summary</p>
              <p className="text-xs text-muted-foreground">
                End of day revenue report
              </p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Moon className="h-5 w-5 text-muted-foreground" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">
                Toggle dark theme
              </p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-5 w-5 text-muted-foreground" />
            About
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Version</span>
            <span className="font-medium">1.0.0 (MVP)</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Platform</span>
            <span className="font-medium">Crumb by BoliFlow</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
