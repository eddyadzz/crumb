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
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMVR } from '@/lib/costing';
import {
  adminSetTenantStatus,
  adminCreateTenant,
} from '@/lib/actions/admin';
import type { adminGetDashboard, adminListTenants } from '@/lib/actions/admin';

export function AdminClient({
  stats,
  tenants,
}: {
  stats: Awaited<ReturnType<typeof adminGetDashboard>>;
  tenants: Awaited<ReturnType<typeof adminListTenants>>;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createName, setCreateName] = useState('');
  const [createOwnerEmail, setCreateOwnerEmail] = useState('');
  const [createOwnerName, setCreateOwnerName] = useState('');
  const [creating, setCreating] = useState(false);

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

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Super Admin"
        description="Platform-wide tenant management"
        action={
          <span className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary">
            <Shield className="h-4 w-4" />
            Admin Portal
          </span>
        }
      />

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
            {['FREE', 'PRO', 'BUSINESS'].map((tier) => (
              <div
                key={tier}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
              >
                <Badge variant={tier === 'FREE' ? 'secondary' : 'default'}>
                  {tier}
                </Badge>
                <span className="text-sm font-medium">
                  {stats.tierCount[tier] ?? 0}
                </span>
              </div>
            ))}
            <p className="ml-auto text-xs text-muted-foreground">
              {stats.suspendedTenants} suspended
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
            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive sm:col-span-3">
                {error}
              </p>
            )}
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
                    <Badge variant={t.subscriptionTier === 'FREE' ? 'secondary' : 'default'}>
                      {t.subscriptionTier}
                    </Badge>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t.subscriptionStatus === 'TRIAL' ? 'trial' : t.subscriptionStatus.toLowerCase()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={t.status === 'ACTIVE' ? 'default' : 'destructive'}
                    >
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
                    {new Date(t.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
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
    </div>
  );
}