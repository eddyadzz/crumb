'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { CheckCircle2, CloudUpload, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getOutboxSnapshot,
  hasSynced,
  subscribeSync,
  EMPTY_OPS,
  useOnlineStatus,
} from '@/lib/sync-outbox';

/**
 * Compact sync-trust indicator for the shell. Renders nothing until this
 * device actually uses Floor Mode sync (pending changes or a completed
 * sync), so desktop-only users never see sync noise.
 */
export function SyncStatusPill() {
  const outbox = useSyncExternalStore(subscribeSync, getOutboxSnapshot, () => EMPTY_OPS);
  const online = useOnlineStatus();
  const synced = useSyncExternalStore(subscribeSync, hasSynced, () => false);

  const pendingCount = outbox.length;
  if (pendingCount === 0 && !synced) return null;

  const state = !online
    ? { icon: <WifiOff className="h-3.5 w-3.5" />, cls: 'bg-warning/15 text-warning', label: `${pendingCount} waiting` }
    : pendingCount > 0
      ? { icon: <CloudUpload className="h-3.5 w-3.5" />, cls: 'bg-primary/15 text-primary', label: `${pendingCount} waiting` }
      : { icon: <CheckCircle2 className="h-3.5 w-3.5" />, cls: 'bg-success/15 text-success', label: 'Synced' };

  return (
    <Link
      href="/sync"
      title="Open Sync Center"
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold',
        state.cls
      )}
    >
      {state.icon}
      {state.label}
    </Link>
  );
}