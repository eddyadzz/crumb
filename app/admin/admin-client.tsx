'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  CreditCard,
  Activity,
  Clock,
  Loader2,
  Shield,
  ArrowLeftRight,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMVR } from '@/lib/costing';
import { FEATURE_KEYS, FEATURE_LABELS, resolvePlanFeatures } from '@/lib/plans';
import {
  adminSetTenantStatus,
  adminCreateTenant,
  adminSetPlan,
  adminExtendTrial,
  adminGetRequest,
  adminReviewRequest,
  adminSavePaymentMethod,
  adminTogglePaymentMethod,
} from '@/lib/actions/admin';
import type {
  adminGetDashboard,
  adminListTenants,
  adminGetBilling,
  adminListRequests,
  adminListPaymentMethods,
  AdminSubscriptionStatus,
} from '@/lib/actions/admin';

type BillingData = Awaited<ReturnType<typeof adminGetBilling>>;
type SubscriptionRow = BillingData['subscriptions'][number];

const SUB_STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'] as const;

function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function AdminClient({
  stats,
  tenants,
  billing,
  requests,
  paymentMethods,
}: {
  stats: Awaited<ReturnType<typeof adminGetDashboard>>;
  tenants: Awaited<ReturnType<typeof adminListTenants>>;
  billing: BillingData;
  requests: Awaited<ReturnType<typeof adminListRequests>>;
  paymentMethods: Awaited<ReturnType<typeof adminListPaymentMethods>>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'overview' | 'billing'>('overview');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createName, setCreateName] = useState('');
  const [createOwnerEmail, setCreateOwnerEmail] = useState('');
  const [createOwnerName, setCreateOwnerName] = useState('');
  const [creating, setCreating] = useState(false);

  const [rowSel, setRowSel] = useState<
    Record<string, { planId: string; status: string }>
  >({});
  const [rowBusy, setRowBusy] = useState<Record<string, string | null>>({});

  // Upgrade requests review
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewReqId, setReviewReqId] = useState<string | null>(null);
  const [reviewDetail, setReviewDetail] = useState<Awaited<
    ReturnType<typeof adminGetRequest>
  > | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const openReview = (id: string) => {
    setReviewReqId(id);
    setReviewNotes('');
    adminGetRequest(id).then(setReviewDetail).catch(() => setReviewDetail(null));
    setReviewOpen(true);
  };

  const submitReview = async (status: 'APPROVED' | 'REJECTED') => {
    if (!reviewReqId) return;
    setReviewing(true);
    setError(null);
    try {
      await adminReviewRequest({
        requestId: reviewReqId,
        status,
        reviewNotes: reviewNotes || undefined,
      });
      setReviewOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to review request');
    } finally {
      setReviewing(false);
    }
  };

  // Payment methods management
  const [pmName, setPmName] = useState('');
  const [pmCode, setPmCode] = useState('');
  const [pmDetails, setPmDetails] = useState('');
  const [pmCurrency, setPmCurrency] = useState('');
  const [savingPm, setSavingPm] = useState(false);

  const savePaymentMethod = async () => {
    setSavingPm(true);
    setError(null);
    try {
      await adminSavePaymentMethod({
        name: pmName,
        code: pmCode,
        details: pmDetails,
        currency: pmCurrency,
      });
      setPmName('');
      setPmCode('');
      setPmDetails('');
      setPmCurrency('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save payment method');
    } finally {
      setSavingPm(false);
    }
  };

  const toggleStatus = async (id: string, current: string) => {
    setBusyId(id);
    setError(null);
    const next = current === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await adminSetTenantStatus({ tenantId: id, status: next });
    setBusyId(null);
    router.refresh();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await adminCreateTenant({
        name: createName,
        ownerEmail: createOwnerEmail,
        ownerName: createOwnerName,
      });
      setCreateName('');
      setCreateOwnerEmail('');
      setCreateOwnerName('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create tenant');
    } finally {
      setCreating(false);
    }
  };

  const selection = (sub: SubscriptionRow) =>
    rowSel[sub.tenantId] ?? { planId: sub.plan.id, status: sub.status };

  const applyPlan = async (sub: SubscriptionRow) => {
    setRowBusy((m) => ({ ...m, [sub.tenantId]: 'plan' }));
    setError(null);
    try {
      const s = selection(sub);
      await adminSetPlan({
        tenantId: sub.tenantId,
        planId: s.planId,
        status: s.status as AdminSubscriptionStatus,
      });
      setRowSel((m) => ({ ...m, [sub.tenantId]: s }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update subscription');
    } finally {
      setRowBusy((m) => ({ ...m, [sub.tenantId]: null }));
    }
  };

  const extendTrial = async (sub: SubscriptionRow) => {
    setRowBusy((m) => ({ ...m, [sub.tenantId]: 'trial' }));
    setError(null);
    try {
      await adminExtendTrial({ tenantId: sub.tenantId, days: 14 });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to extend trial');
    } finally {
      setRowBusy((m) => ({ ...m, [sub.tenantId]: null }));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Super Admin"
        description="Platform-wide tenant and billing management"
        action={
          <span className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary">
            <Shield className="h-4 w-4" />
            Admin Portal
          </span>
        }
      />

      <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {(['overview', 'billing'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              tab === t
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {t === 'overview' ? 'Overview' : 'Billing'}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <StatCard label="Total Tenants" value={String(stats.totalTenants)} icon={<Building2 className="h-5 w-5" />} variant="primary" />
            <StatCard label="Active" value={String(stats.activeTenants)} icon={<Activity className="h-5 w-5" />} variant="success" />
            <StatCard label="Trials" value={String(stats.trialTenants)} icon={<CreditCard className="h-5 w-5" />} />
            <StatCard label="Expired Trials" value={String(stats.expiredTrials)} icon={<Clock className="h-5 w-5" />} variant="warning" />
            <StatCard label="MRR" value={formatMVR(stats.mrr)} icon={<Users className="h-5 w-5" />} />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Plan Mix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {['free', 'pro', 'business'].map((code) => (
                  <div
                    key={code}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <Badge variant={code === 'free' ? 'secondary' : 'default'}>
                      {code}
                    </Badge>
                    <span className="text-sm font-medium">
                      {stats.planCount[code] ?? 0}
                    </span>
                  </div>
                ))}
                <p className="ml-auto text-xs text-muted-foreground">
                  {stats.suspendedTenants} suspended · {stats.payingTenants} paying
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Create Tenant</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="create-name">Business name</Label>
                  <Input
                    id="create-name"
                    placeholder="Sweet Crumbs Bakery"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-email">Owner email (optional)</Label>
                  <Input
                    id="create-email"
                    type="email"
                    placeholder="owner@business.mv"
                    value={createOwnerEmail}
                    onChange={(e) => setCreateOwnerEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-owner">Owner name (optional)</Label>
                  <Input
                    id="create-owner"
                    placeholder="Jane Doe"
                    value={createOwnerName}
                    onChange={(e) => setCreateOwnerName(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-3">
                  <Button type="submit" disabled={creating}>
                    {creating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Create Tenant
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Tenants</CardTitle>
              <Badge variant="secondary">{tenants.length}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No tenants yet
                      </TableCell>
                    </TableRow>
                  )}
                  {tenants.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.slug}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={(t.subscription?.plan.code ?? 'free') === 'free' ? 'secondary' : 'default'}>
                          {t.subscription?.plan.name ?? 'Free'}
                        </Badge>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t.subscription?.status === 'TRIAL'
                            ? 'trial'
                            : (t.subscription?.status ?? '').toLowerCase()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.status === 'ACTIVE' ? 'default' : 'destructive'}>
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {t._count.users}
                        {t.users[0] && (
                          <span className="block text-xs text-muted-foreground">
                            {t.users[0].email}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatDateTime(t.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={t.status === 'ACTIVE' ? 'outline' : 'default'}
                          disabled={busyId === t.id}
                          onClick={() => toggleStatus(t.id, t.status)}
                        >
                          {busyId === t.id ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : null}
                          {t.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'billing' && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="MRR" value={formatMVR(stats.mrr)} icon={<CreditCard className="h-5 w-5" />} variant="primary" />
            <StatCard label="Paying Tenants" value={String(stats.payingTenants)} icon={<Users className="h-5 w-5" />} variant="success" />
            <StatCard label="Trials" value={String(stats.trialTenants)} icon={<Activity className="h-5 w-5" />} />
            <StatCard label="Expired Trials" value={String(stats.expiredTrials)} icon={<Clock className="h-5 w-5" />} variant="warning" />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Plans</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Monthly</TableHead>
                    <TableHead className="text-right">Yearly</TableHead>
                    <TableHead>Features</TableHead>
                    <TableHead className="text-right">Subscriptions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billing.plans.map((p) => {
                    const features = resolvePlanFeatures(p);
                    const featureNames = FEATURE_KEYS.filter((f) => features[f] === true);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.code}</p>
                        </TableCell>
                        <TableCell className="text-right">{formatMVR(Number(p.monthlyPrice))}</TableCell>
                        <TableCell className="text-right">{formatMVR(Number(p.yearlyPrice))}</TableCell>
                        <TableCell>
                          {featureNames.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex max-w-md flex-wrap gap-1">
                              {featureNames.map((f) => (
                                <Badge key={f} variant="outline" className="text-[11px]">
                                  {FEATURE_LABELS[f]}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{p._count.subscriptions}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Subscriptions</CardTitle>
              <Badge variant="secondary">{billing.subscriptions.length}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trial ends</TableHead>
                    <TableHead className="text-right">Manage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billing.subscriptions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No subscriptions yet
                      </TableCell>
                    </TableRow>
                  )}
                  {billing.subscriptions.map((sub) => {
                    const sel = selection(sub);
                    return (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <p className="font-medium">{sub.tenant.name}</p>
                          <p className="text-xs text-muted-foreground">{sub.tenant.slug}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sub.plan.code === 'free' ? 'secondary' : 'default'}>
                            {sub.plan.name}
                          </Badge>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {sub.billingInterval.toLowerCase()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              sub.status === 'ACTIVE' || sub.status === 'TRIAL'
                                ? 'default'
                                : 'destructive'
                            }
                          >
                            {sub.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs">{formatDateTime(sub.trialEndsAt)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Select
                              value={sel.planId}
                              onValueChange={(planId) =>
                                setRowSel((m) => ({
                                  ...m,
                                  [sub.tenantId]: { ...sel, planId },
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {billing.plans.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={sel.status}
                              onValueChange={(status) =>
                                setRowSel((m) => ({
                                  ...m,
                                  [sub.tenantId]: { ...sel, status },
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SUB_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="default"
                              disabled={rowBusy[sub.tenantId] === 'plan' || sel.planId === sub.plan.id && sel.status === sub.status}
                              onClick={() => applyPlan(sub)}
                            >
                              {rowBusy[sub.tenantId] === 'plan' ? (
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              ) : (
                                <ArrowLeftRight className="mr-2 h-3 w-3" />
                              )}
                              Apply
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={rowBusy[sub.tenantId] === 'trial'}
                              onClick={() => extendTrial(sub)}
                              title="Add 14 days to the trial"
                            >
                              {rowBusy[sub.tenantId] === 'trial' ? (
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              ) : null}
                              +14d trial
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Upgrade requests */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Upgrade Requests</CardTitle>
              <Badge variant="secondary">{requests.length}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Requested plan</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No upgrade requests yet
                      </TableCell>
                    </TableRow>
                  )}
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <p className="font-medium">{r.tenantName}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.planCode === 'free' ? 'secondary' : 'default'}>
                          {r.planName}
                        </Badge>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {r.billingInterval.toLowerCase()}
                        </span>
                      </TableCell>
                      <TableCell>{r.paymentMethodName}</TableCell>
                      <TableCell className="text-xs">
                        {r.referenceNumber}
                        {r.hasProof && <span className="ml-1 text-emerald-600">· proof</span>}
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDateTime(r.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === 'PENDING' ? (
                          <Button size="sm" onClick={() => openReview(r.id)}>
                            Review
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => openReview(r.id)}>
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment methods */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label htmlFor="pm-name">Name</Label>
                  <Input
                    id="pm-name"
                    className="mt-1"
                    placeholder="USDT (TRC20)"
                    value={pmName}
                    onChange={(e) => setPmName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="pm-code">Code</Label>
                  <Input
                    id="pm-code"
                    className="mt-1"
                    placeholder="USDT_TRC20"
                    value={pmCode}
                    onChange={(e) => setPmCode(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="pm-details">Details</Label>
                  <Input
                    id="pm-details"
                    className="mt-1"
                    placeholder="Wallet / account info"
                    value={pmDetails}
                    onChange={(e) => setPmDetails(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="pm-currency">Currency</Label>
                  <Input
                    id="pm-currency"
                    className="mt-1"
                    placeholder="USDT"
                    value={pmCurrency}
                    onChange={(e) => setPmCurrency(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={savingPm || !pmName.trim() || !pmCode.trim()}
                  onClick={savePaymentMethod}
                >
                  {savingPm ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : null}
                  Add payment method
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {paymentMethods.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.code}
                        {m.currency ? ` · ${m.currency}` : ''}
                      </p>
                      {m.details && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {m.details}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={m.active ? 'default' : 'secondary'}>
                        {m.active ? 'Active' : 'Off'}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await adminTogglePaymentMethod(m.id);
                          router.refresh();
                        }}
                      >
                        Toggle
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Review upgrade request modal */}
      {reviewOpen && reviewDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setReviewOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">
                Review upgrade request
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReviewOpen(false)}
              >
                Close
              </Button>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Tenant</dt>
                <dd className="text-right font-medium">
                  {reviewDetail.tenant.name}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Requested plan</dt>
                <dd className="text-right font-medium">
                  {reviewDetail.requestedPlan.name}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Interval</dt>
                <dd className="text-right">
                  {reviewDetail.billingInterval === 'YEARLY' ? 'Yearly' : 'Monthly'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Payment method</dt>
                <dd className="text-right">
                  {reviewDetail.paymentMethod.name}
                  {reviewDetail.paymentMethod.details
                    ? ` — ${reviewDetail.paymentMethod.details}`
                    : ''}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="text-right font-medium">
                  {reviewDetail.referenceNumber}
                </dd>
              </div>
              {reviewDetail.notes && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd className="text-right">{reviewDetail.notes}</dd>
                </div>
              )}
            </dl>

            {reviewDetail.proofImage && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Payment proof
                </p>
                <img
                  src={reviewDetail.proofImage}
                  alt="Payment proof"
                  className="max-h-56 w-full rounded-xl border border-border object-contain"
                />
              </div>
            )}

            <div className="mt-4">
              <Label htmlFor="review-notes">Review notes</Label>
              <Textarea
                id="review-notes"
                className="mt-1"
                placeholder={
                  reviewDetail.status === 'REJECTED'
                    ? 'Reason for rejection (sent to tenant)'
                    : 'Optional note'
                }
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>

            {reviewDetail.status !== 'PENDING' && (
              <p className="mt-3 text-xs text-muted-foreground">
                This request was already {reviewDetail.status.toLowerCase()} on{' '}
                {reviewDetail.reviewedAt
                  ? formatDateTime(reviewDetail.reviewedAt)
                  : '—'}
                .
              </p>
            )}

            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              {reviewDetail.status === 'PENDING' ? (
                <>
                  <Button
                    variant="outline"
                    disabled={reviewing}
                    onClick={() => submitReview('REJECTED')}
                  >
                    Reject
                  </Button>
                  <Button disabled={reviewing} onClick={() => submitReview('APPROVED')}>
                    {reviewing ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : null}
                    Approve &amp; activate
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setReviewOpen(false)}>
                  Done
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}