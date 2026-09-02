'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Bell,
  Moon,
  Info,
  LogOut,
  Loader2,
  CreditCard,
  Check,
  UploadCloud,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { authClient } from '@/lib/auth-client';
import { getAccountInfo, listPlans, getStockPolicy, setStockPolicy } from '@/lib/actions/tenant';
import type { AccountInfo, PlanInfo } from '@/lib/actions/tenant';
import {
  listPaymentMethods,
  submitSubscriptionRequest,
  getMyRequests,
  type PaymentMethodInfo,
  type UpgradeRequestInfo,
} from '@/lib/actions/billing';
import { FEATURE_KEYS, FEATURE_LABELS } from '@/lib/plans';
import { hasPermission } from '@/lib/permissions-core';
import type { UserRole } from '@prisma/client';
import {
  getNotificationPrefs,
  updateNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/actions/notifications';
import { cn } from '@/lib/utils';
import { TeamCard } from './team-card';
import { ApiKeysCard } from './api-keys-card';
import { WebhooksCard } from './webhooks-card';

export default function SettingsPage() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodInfo[]>([]);
  const [requests, setRequests] = useState<UpgradeRequestInfo[]>([]);
  const [upgradingPlan, setUpgradingPlan] = useState<PlanInfo | null>(null);
  const [upgradeForm, setUpgradeForm] = useState({
    paymentMethodId: '',
    billingInterval: 'MONTHLY' as 'MONTHLY' | 'YEARLY',
    referenceNumber: '',
    notes: '',
    proofImage: null as string | null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradeSuccess, setUpgradeSuccess] = useState<string | null>(null);
  const [stockPolicy, setStockPolicyState] = useState<'WARN' | 'BLOCK' | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null);

  const refreshRequests = () =>
    getMyRequests().then(setRequests).catch(() => {});

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAccountInfo(), listPlans(), listPaymentMethods(), getStockPolicy(), getNotificationPrefs()])
      .then(([info, planList, methods, policy, prefs]) => {
        if (cancelled) return;
        setAccount(info);
        setPlans(planList);
        setPaymentMethods(methods);
        setStockPolicyState(policy);
        setNotifPrefs(prefs);
      })
      .catch(() => {});
    refreshRequests();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const includedFeatures = account
    ? FEATURE_KEYS.filter((f) => account.planFeatures[f] === true)
    : [];

  const role = (account?.role ?? 'STAFF') as UserRole;
  const canManageBilling = hasPermission(role, 'billing.manage');
  const canManageSettings = hasPermission(role, 'settings.manage');
  const canManageApiKeys = hasPermission(role, 'billing.manage') || hasPermission(role, 'team.manage');

  const handleSignOut = async () => {
    setSigningOut(true);
    await authClient.signOut();
    router.push('/sign-in');
    router.refresh();
  };

  const toggleNotifPref = (key: keyof NotificationPrefs, value: boolean) => {
    setNotifPrefs((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      updateNotificationPrefs(next).catch(() => {});
      return next;
    });
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

      {account && <TeamCard role={account.role} />}

      {account && canManageApiKeys && <ApiKeysCard canManage />}

      {canManageSettings && <WebhooksCard />}

      {canManageBilling && (
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
                            {FEATURE_LABELS[f]}
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
                      onClick={() => {
                        setUpgradingPlan(p);
                        setPaymentMethods((m) => m);
                        setUpgradeForm((f) => ({
                          ...f,
                          paymentMethodId: paymentMethods[0]?.id ?? '',
                        }));
                      }}
                    >
                      Upgrade
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="pt-1 text-xs text-muted-foreground">
            Pay manually via bank transfer or crypto. Our team reviews your payment
            and activates your plan — usually within a few hours.
          </p>

          {/* Upgrade request form */}
          {upgradingPlan && (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">
                  Upgrade to {upgradingPlan.name}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setUpgradingPlan(null);
                    setUpgradeError(null);
                    setUpgradeSuccess(null);
                  }}
                >
                  Cancel
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="billing-interval">Billing interval</Label>
                  <select
                    id="billing-interval"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    value={upgradeForm.billingInterval}
                    onChange={(e) =>
                      setUpgradeForm((f) => ({
                        ...f,
                        billingInterval: e.target.value as 'MONTHLY' | 'YEARLY',
                      }))
                    }
                  >
                    <option value="MONTHLY">
                      Monthly — MVR {upgradingPlan.monthlyPrice}/mo
                    </option>
                    <option value="YEARLY">
                      Yearly — MVR {upgradingPlan.yearlyPrice}/yr
                    </option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="payment-method">Payment method</Label>
                  <select
                    id="payment-method"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    value={upgradeForm.paymentMethodId}
                    onChange={(e) =>
                      setUpgradeForm((f) => ({
                        ...f,
                        paymentMethodId: e.target.value,
                      }))
                    }
                  >
                    {paymentMethods.length === 0 && (
                      <option value="">No payment methods available</option>
                    )}
                    {paymentMethods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.details ? ` — ${m.details}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="reference-number">
                    Reference number / transaction ID
                  </Label>
                  <Input
                    id="reference-number"
                    className="mt-1"
                    placeholder="e.g. transfer reference or TXID"
                    value={upgradeForm.referenceNumber}
                    onChange={(e) =>
                      setUpgradeForm((f) => ({
                        ...f,
                        referenceNumber: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label>Payment proof (screenshot)</Label>
                  {upgradeForm.proofImage ? (
                    <div className="mt-1 overflow-hidden rounded-lg border border-border">
                      <img
                        src={upgradeForm.proofImage}
                        alt="Proof of payment"
                        className="max-h-40 w-full object-cover"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          setUpgradeForm((f) => ({ ...f, proofImage: null }))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Label
                      htmlFor="proof-upload"
                      className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground hover:bg-muted/50"
                    >
                      <UploadCloud className="h-5 w-5" />
                      <span>Click to upload a screenshot (max 6MB)</span>
                      <input
                        id="proof-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            setUpgradeForm((f) => ({
                              ...f,
                              proofImage: reader.result as string,
                            }));
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </Label>
                  )}
                </div>

                <div>
                  <Label htmlFor="request-notes">Notes (optional)</Label>
                  <Textarea
                    id="request-notes"
                    className="mt-1"
                    placeholder="Anything our team should know"
                    value={upgradeForm.notes}
                    onChange={(e) =>
                      setUpgradeForm((f) => ({
                        ...f,
                        notes: e.target.value,
                      }))
                    }
                  />
                </div>

                {upgradeError && (
                  <p className="text-sm text-destructive">{upgradeError}</p>
                )}
                {upgradeSuccess && (
                  <p className="text-sm text-emerald-600">{upgradeSuccess}</p>
                )}

                <Button
                  className="w-full gap-2"
                  disabled={submitting}
                  onClick={async () => {
                    setSubmitting(true);
                    setUpgradeError(null);
                    setUpgradeSuccess(null);
                    try {
                      const res = await submitSubscriptionRequest({
                        planId: upgradingPlan.id,
                        paymentMethodId: upgradeForm.paymentMethodId,
                        billingInterval: upgradeForm.billingInterval,
                        referenceNumber: upgradeForm.referenceNumber,
                        proofImage: upgradeForm.proofImage,
                        notes: upgradeForm.notes,
                      });
                      if (res.ok) {
                        setUpgradeSuccess(
                          'Upgrade request submitted! We’ll review it and activate your plan shortly.'
                        );
                        setUpgradingPlan(null);
                        setUpgradeForm({
                          paymentMethodId: '',
                          billingInterval: 'MONTHLY',
                          referenceNumber: '',
                          notes: '',
                          proofImage: null,
                        });
                        refreshRequests();
                      } else {
                        setUpgradeError(res.error);
                      }
                    } catch {
                      setUpgradeError(
                        'Something went wrong. Please try again or contact BoliFlow.'
                      );
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                  Submit upgrade request
                </Button>
              </div>
            </div>
          )}

          {/* My upgrade requests */}
          {requests.length > 0 && (
            <div className="rounded-xl border border-border p-4">
              <p className="mb-2 text-sm font-semibold">Your upgrade requests</p>
              <div className="divide-y divide-border">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {r.planName} · {r.billingInterval === 'YEARLY' ? 'Yearly' : 'Monthly'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ref: {r.referenceNumber} ·{' '}
                        {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                      {r.reviewNotes && (
                        <p className="text-xs text-muted-foreground">
                          Note: {r.reviewNotes}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={
                        r.status === 'APPROVED'
                          ? 'default'
                          : r.status === 'REJECTED'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {canManageSettings && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            Stock Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            What happens when a production run needs more ingredients than are
            on hand.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setStockPolicyState('WARN');
                setStockPolicy('WARN');
              }}
              className={cn(
                'rounded-xl border p-3 text-left transition-colors',
                stockPolicy === 'WARN'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              )}
            >
              <p className="text-sm font-medium">Warn Only</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Show a warning and let production continue anyway. Good for home
                businesses.
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setStockPolicyState('BLOCK');
                setStockPolicy('BLOCK');
              }}
              className={cn(
                'rounded-xl border p-3 text-left transition-colors',
                stockPolicy === 'BLOCK'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              )}
            >
              <p className="text-sm font-medium">Block Production</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Refuse to complete a production run that is short on any
                ingredient. Stricter, for serious operators.
              </p>
            </button>
          </div>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5 text-muted-foreground" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Choose which daily updates you receive as email. In-app
            notifications in the bell always show regardless of these settings.
          </p>
          {!canManageSettings && (
            <p className="text-xs text-muted-foreground">
              Only the owner can change notification preferences.
            </p>
          )}
          <NotifToggle
            label="Low Stock Alerts"
            description="Ingredients running below their reorder level"
            checked={notifPrefs?.notifLowStockEmail ?? true}
            onChange={(v) => toggleNotifPref('notifLowStockEmail', v)}
            disabled={!canManageSettings}
          />
          <Separator />
          <NotifToggle
            label="Order Reminders"
            description="Customer orders due today and tomorrow"
            checked={notifPrefs?.notifOrdersEmail ?? true}
            onChange={(v) => toggleNotifPref('notifOrdersEmail', v)}
            disabled={!canManageSettings}
          />
          <Separator />
          <NotifToggle
            label="Production Reminders"
            description="Production batches scheduled for today"
            checked={notifPrefs?.notifProductionEmail ?? true}
            onChange={(v) => toggleNotifPref('notifProductionEmail', v)}
            disabled={!canManageSettings}
          />
          <Separator />
          <NotifToggle
            label="Billing &amp; Plan Updates"
            description="Upgrade approvals, rejections and subscription notices"
            checked={notifPrefs?.notifBillingEmail ?? true}
            onChange={(v) => toggleNotifPref('notifBillingEmail', v)}
            disabled={!canManageSettings}
          />
          <Separator />
          <NotifToggle
            label="Trial Notices"
            description="Trial reminders and when your trial ends"
            checked={notifPrefs?.notifTrialEmail ?? true}
            onChange={(v) => toggleNotifPref('notifTrialEmail', v)}
            disabled={!canManageSettings}
          />
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

function NotifToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
