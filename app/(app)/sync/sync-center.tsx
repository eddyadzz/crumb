'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  CloudUpload,
  CheckCircle2,
  Wifi,
  WifiOff,
  Play,
  CheckCircle2 as Complete,
  RefreshCcw,
  AlertTriangle,
  History,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useOutboxSync } from '@/components/use-outbox-sync';
import {
  getHistorySnapshot,
  subscribeSync,
  lastSyncedAt,
  relativeSyncLabel,
  EMPTY_HISTORY,
  useOnlineStatus,
  type SyncHistoryEntry,
} from '@/lib/sync-outbox';

/** Re-render every 30s so "synced Xm ago" labels stay fresh. */
function useTick(intervalMs = 30_000): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
}

export function SyncCenter() {
  const { outbox, pending, flush } = useOutboxSync();
  const online = useOnlineStatus();
  const history = useSyncExternalStore(subscribeSync, getHistorySnapshot, () => EMPTY_HISTORY);
  useTick();

  const lastSync = lastSyncedAt();
  const lastSyncLabel = lastSync === null ? null : relativeSyncLabel(lastSync);
  const pendingCount = outbox.length;
  const healthy = online && pendingCount === 0;

  const statusTone = !online
    ? { badge: 'bg-warning/15 text-warning', label: 'Offline' }
    : healthy
      ? { badge: 'bg-success/15 text-success', label: 'Online' }
      : { badge: 'bg-primary/15 text-primary', label: 'Online' };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Sync Center"
        description="What happens between this device and your bakery's cloud"
      />

      {/* Current status */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {online ? <Wifi className="h-5 w-5 text-success" /> : <WifiOff className="h-5 w-5 text-warning" />}
              <p className="font-display text-lg font-bold">{statusTone.label}</p>
              <Badge variant="secondary" className={statusTone.badge}>
                {online ? 'Online' : 'Offline'}
              </Badge>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={pending || !online}
              onClick={() => flush({ explicit: true })}
            >
              <RefreshCcw className={cn('h-4 w-4', pending && 'animate-spin')} />
              Sync now
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Last sync</p>
              <p className="font-display text-base font-bold">
                {lastSyncLabel ?? 'Never'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {lastSyncLabel
                  ? `at ${new Date(lastSync!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                  : '\u00a0'}
              </p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Pending changes</p>
              <p className={cn('font-display text-base font-bold', pendingCount > 0 && 'text-warning')}>
                {pendingCount}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {pendingCount === 0 ? 'all changes uploaded' : 'waiting to upload'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Outbox */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudUpload className="h-5 w-5 text-muted-foreground" />
            Outbox
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendingCount === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-success">
              <CheckCircle2 className="h-5 w-5" />
              All changes synced — nothing waiting
            </div>
          ) : (
            <>
              {outbox.map((op) => (
                <div key={op.id} className="flex items-center justify-between rounded-xl border border-warning/30 bg-warning/5 p-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {op.type === 'start' ? (
                      <Play className="h-4 w-4 shrink-0 text-warning" />
                    ) : (
                      <Complete className="h-4 w-4 shrink-0 text-warning" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {op.type === 'start' ? 'Started' : 'Completed'} {op.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        queued {new Date(op.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <RefreshCcw className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" style={{ opacity: pending ? 1 : 0.4 }} />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                {online
                  ? 'These will upload automatically — or tap Sync now.'
                  : 'You are offline. Changes stay safe on this device and upload when you reconnect.'}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5 text-muted-foreground" />
            History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No sync activity yet on this device.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {history.map((h) => (
                <HistoryRow key={h.id} entry={h} />
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            Batches you start or complete offline are stored on this device and
            uploaded automatically when you&apos;re back online. See{' '}
            <Link href="/floor" className="underline underline-offset-2">
              Floor Mode
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryRow({ entry }: { entry: SyncHistoryEntry }) {
  const meta = {
    synced: { icon: <CheckCircle2 className="h-4 w-4 text-success" /> },
    uploaded: { icon: <CloudUpload className="h-4 w-4 text-success" /> },
    offline: { icon: <WifiOff className="h-4 w-4 text-warning" /> },
    conflict: { icon: <AlertTriangle className="h-4 w-4 text-warning" /> },
    error: { icon: <AlertTriangle className="h-4 w-4 text-destructive" /> },
  }[entry.kind];

  return (
    <li className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-sm">
      {meta.icon}
      <span className={cn('min-w-0 flex-1', entry.kind === 'conflict' && 'text-warning')}>{entry.text}</span>
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {new Date(entry.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
      </span>
    </li>
  );
}