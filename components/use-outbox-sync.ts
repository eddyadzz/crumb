'use client';

import { useCallback, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import {
  getOutboxSnapshot,
  markSynced,
  recordSyncEvent,
  subscribeSync,
  writeOutbox,
  EMPTY_OPS,
  type OutboxOp,
} from '@/lib/sync-outbox';
import {
  startProductionOrder,
  completeProductionOrder,
} from '@/lib/actions/production';

/**
 * Shared offline-queue replay used by Floor Mode and the Sync Center:
 * replays queued ops oldest-first through the real server actions, records a
 * device-local history trail, and treats business-rule failures (e.g. "the
 * batch was already completed elsewhere") as conflicts to archive.
 */
export function useOutboxSync(opts?: { onUploaded?: (op: OutboxOp) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const outbox = useSyncExternalStore(subscribeSync, getOutboxSnapshot, () => EMPTY_OPS);
  const flushingRef = useRef(false);
  const onUploadedRef = useRef<((op: OutboxOp) => void) | undefined>(undefined);

  // Latest-callback pattern: keep the ref fresh without re-creating flush.
  useEffect(() => {
    onUploadedRef.current = opts?.onUploaded;
  });

  const flush = useCallback(
    (opts?: { explicit?: boolean }) => {
      if (flushingRef.current) return;
      if (!navigator.onLine) {
        if (opts?.explicit) {
          recordSyncEvent('offline', 'Network unavailable — changes stay queued on this device');
        }
        return;
      }
      const ops = getOutboxSnapshot();
      if (ops.length === 0) {
        if (opts?.explicit) {
          recordSyncEvent('synced', 'Completed sync — no pending changes');
        }
        return;
      }
      flushingRef.current = true;
      startTransition(async () => {
        const remaining = [...ops];
        let uploaded = 0;
        let conflicts = 0;
        while (remaining.length > 0) {
          const op: OutboxOp = remaining[0];
          try {
            if (op.type === 'start') {
              await startProductionOrder(op.orderId);
            } else {
              await completeProductionOrder(op.orderId, op.actuals);
            }
            remaining.shift();
            uploaded += 1;
            onUploadedRef.current?.(op);
          } catch (e) {
            if (e instanceof TypeError) break; // network dropped mid-sync — retry later
            // Business-rule failure: the op is stale (already applied on
            // another device). Archive it with a visible conflict note.
            remaining.shift();
            conflicts += 1;
            recordSyncEvent(
              'conflict',
              `"${op.label}" could not be applied — already updated elsewhere. Archived.`
            );
          }
        }
        writeOutbox(remaining);
        flushingRef.current = false;
        if (uploaded > 0) {
          markSynced();
          recordSyncEvent('uploaded', `Uploaded ${uploaded} action${uploaded === 1 ? '' : 's'}`);
        }
        if (remaining.length === 0 && (uploaded > 0 || conflicts > 0)) {
          recordSyncEvent('synced', 'Completed sync — all changes uploaded');
        }
        if (uploaded > 0 || conflicts > 0) router.refresh();
      });
    },
    [router]
  );

  // Auto-replay on mount and whenever connectivity returns.
  useEffect(() => {
    flush();
    const onOnline = () => flush();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flush]);

  return { outbox, pending, flush };
}