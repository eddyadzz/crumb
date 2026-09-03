'use client';

/**
 * Shared client-side sync state (Phase J-6): the Floor Mode outbox, last-sync
 * timestamp, and a small device-local history. Backed by localStorage and
 * exposed through useSyncExternalStore so every surface (Floor, Sync Center,
 * shell pill) stays consistent without prop drilling.
 */

import { useSyncExternalStore } from 'react';

/* ================= OUTBOX ================= */

export type OutboxOpType = 'start' | 'complete';

export interface OutboxOp {
  id: string;
  type: OutboxOpType;
  orderId: string;
  label: string;
  /** Only for complete ops. */
  actuals?: { productionItemId: string; ingredientId: string; actualBase: number }[];
  variance?: number;
  createdAt: string;
}

const OUTBOX_KEY = 'crumb-floor-outbox';
const SYNC_EVENT = 'crumb-sync-updated';
export const EMPTY_OPS: OutboxOp[] = [];

let snapshotRaw: string | null = null;
let snapshotOps: OutboxOp[] = EMPTY_OPS;

/** Stable-per-storage snapshot for useSyncExternalStore. */
export function getOutboxSnapshot(): OutboxOp[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY) ?? '';
    if (raw !== snapshotRaw) {
      snapshotRaw = raw;
      const parsed = raw ? (JSON.parse(raw) as OutboxOp[]) : [];
      snapshotOps = Array.isArray(parsed) && parsed.length > 0 ? parsed : EMPTY_OPS;
    }
    return snapshotOps;
  } catch {
    return EMPTY_OPS;
  }
}

export function subscribeSync(notify: () => void) {
  window.addEventListener(SYNC_EVENT, notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(SYNC_EVENT, notify);
    window.removeEventListener('storage', notify);
  };
}

export function writeOutbox(ops: OutboxOp[]) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
  } catch {
    // Private mode / storage full: in-memory copy still drives this visit.
  }
  window.dispatchEvent(new Event(SYNC_EVENT));
}

export function newOpId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ================= LAST SYNC ================= */

const LAST_SYNC_KEY = 'crumb-floor-last-sync';
const HAS_SYNCED_KEY = 'crumb-floor-has-synced';

export function markSynced() {
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    localStorage.setItem(HAS_SYNCED_KEY, '1');
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(SYNC_EVENT));
}

export function lastSyncedAt(): number | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    const t = raw ? Number(raw) : NaN;
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

/** True once this device has completed at least one sync. */
export function hasSynced(): boolean {
  try {
    return localStorage.getItem(HAS_SYNCED_KEY) === '1';
  } catch {
    return false;
  }
}

export function relativeSyncLabel(ms: number): string {
  const mins = Math.floor((Date.now() - ms) / 60_000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return '1 hr ago';
  if (hours < 24) return `${hours} hrs ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ================= HISTORY ================= */

export type SyncHistoryKind = 'synced' | 'uploaded' | 'offline' | 'conflict' | 'error';

export interface SyncHistoryEntry {
  id: string;
  at: string;
  kind: SyncHistoryKind;
  text: string;
}

const HISTORY_KEY = 'crumb-sync-history';
const HISTORY_LIMIT = 20;
export const EMPTY_HISTORY: SyncHistoryEntry[] = [];

let historyRaw: string | null = null;
let historyCache: SyncHistoryEntry[] = EMPTY_HISTORY;

export function getHistorySnapshot(): SyncHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY) ?? '';
    if (raw !== historyRaw) {
      historyRaw = raw;
      const parsed = raw ? (JSON.parse(raw) as SyncHistoryEntry[]) : [];
      historyCache = Array.isArray(parsed) && parsed.length > 0 ? parsed : EMPTY_HISTORY;
    }
    return historyCache;
  } catch {
    return EMPTY_HISTORY;
  }
}

export function recordSyncEvent(kind: SyncHistoryKind, text: string) {
  const entry: SyncHistoryEntry = {
    id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    kind,
    text,
  };
  try {
    const next = [entry, ...getHistorySnapshot()].slice(0, HISTORY_LIMIT);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(SYNC_EVENT));
}

/* ================= ONLINE STATUS ================= */

function subscribeOnline(notify: () => void) {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}