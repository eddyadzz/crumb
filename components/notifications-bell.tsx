'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
  type NotificationRow,
} from '@/lib/actions/notifications';

const severityDot: Record<string, string> = {
  INFO: 'bg-sky-500',
  SUCCESS: 'bg-emerald-500',
  WARNING: 'bg-amber-500',
  ERROR: 'bg-rose-500',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        listNotifications(),
        unreadNotificationCount(),
      ]);
      setItems(list);
      setUnread(count);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markRead = async (id: string) => {
    await markNotificationRead(id);
    await refresh();
  };

  const markAll = async () => {
    await markAllNotificationsRead();
    await refresh();
  };

  return (
    <DropdownMenu open={open} onOpenChange={(v) => { setOpen(v); if (v) refresh(); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {!loading && unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(21rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={markAll} className="h-7 px-2 text-xs">
              <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all
            </Button>
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            items.slice(0, 5).map((n) => {
              const body = (
                <div className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left">
                  <span className={cnDot(n.severity)} />
                  <div className="min-w-0 flex-1">
                    <p className={n.read ? 'text-sm text-muted-foreground' : 'text-sm font-medium'}>
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {n.message}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      {relativeTime(n.createdAt)}
                    </p>
                  </div>
                </div>
              );
              return (
                <div
                  key={n.id}
                  className={cnRow(n.read)}
                  onClick={() => { if (!n.read) markRead(n.id); }}
                >
                  {n.link ? (
                    <Link href={n.link} className="flex w-full items-start gap-2.5 px-3 py-2.5">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </div>
              );
            })
          )}
        </div>
        <Link
          href="/notifications"
          className="block border-t border-border px-3 py-2.5 text-center text-xs font-medium text-primary hover:bg-muted"
          onClick={() => setOpen(false)}
        >
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function cnDot(severity: string) {
  return `mt-1 h-2 w-2 shrink-0 rounded-full ${severityDot[severity] ?? 'bg-sky-500'}`;
}

function cnRow(read: boolean) {
  return read ? '' : 'bg-primary/[0.03]';
}