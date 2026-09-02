'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, BellRing, CheckCheck, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from '@/lib/actions/notifications';

const severityBadge: Record<string, { text: string; cls: string }> = {
  INFO: { text: 'Info', cls: 'bg-sky-100 text-sky-700' },
  SUCCESS: { text: 'Success', cls: 'bg-emerald-100 text-emerald-700' },
  WARNING: { text: 'Warning', cls: 'bg-amber-100 text-amber-700' },
  ERROR: { text: 'Error', cls: 'bg-rose-100 text-rose-700' },
};

const typeLabel: Record<string, string> = {
  LOW_STOCK: 'Low stock',
  TRIAL: 'Trial',
  BILLING: 'Billing',
  UPGRADE_REQUEST: 'Upgrade',
  CUSTOMER_ORDER: 'Orders',
  PRODUCTION: 'Production',
  SYSTEM: 'System',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function NotificationsClient({ initial }: { initial: NotificationRow[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<'all' | 'unread' | 'alerts'>('all');

  const unreadCount = items.filter((n) => !n.read).length;

  const visible = items.filter((n) => {
    if (filter === 'unread' && n.read) return false;
    if (filter === 'alerts' && n.severity !== 'WARNING' && n.severity !== 'ERROR') return false;
    return true;
  });

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleDelete = async (id: string) => {
    await deleteNotification(id);
    setItems((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread`
              : 'You&apos;re all caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAll}>
            <CheckCheck className="mr-1.5 h-4 w-4" /> Mark all as read
          </Button>
        )}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/40" />
            {filter === 'all' ? (
              <p className="text-sm text-muted-foreground">
                No notifications here yet.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing in this view.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {visible.map((n) => {
                const badge = severityBadge[n.severity] ?? severityBadge.INFO;
                return (
                  <li
                    key={n.id}
                    className={n.read ? 'bg-card' : 'bg-primary/[0.03]'}
                  >
                    <div className="flex items-start gap-3 px-4 py-3.5">
                      {n.link ? (
                        <Link
                          href={n.link}
                          className="min-w-0 flex-1"
                          onClick={() => {
                            if (!n.read) handleMarkRead(n.id);
                          }}
                        >
                          <NotificationBody n={n} badge={badge} />
                        </Link>
                      ) : (
                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => {
                            if (!n.read) handleMarkRead(n.id);
                          }}
                        >
                          <NotificationBody n={n} badge={badge} />
                        </div>
                      )}
                      <div className="flex shrink-0 items-center gap-1">
                        {!n.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() => handleMarkRead(n.id)}
                            aria-label="Mark as read"
                          >
                            <BellRing className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(n.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NotificationBody({
  n,
  badge,
}: {
  n: NotificationRow;
  badge: { text: string; cls: string };
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}
      >
        {badge.text}
      </span>
      <div className="min-w-0">
        <p
          className={
            n.read
              ? 'text-sm text-muted-foreground'
              : 'text-sm font-semibold text-foreground'
          }
        >
          {n.title}
        </p>
        {n.message && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {n.message}
          </p>
        )}
        <p className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground/70">
          <span>{typeLabel[n.type] ?? n.type}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(n.createdAt)}</span>
        </p>
      </div>
    </div>
  );
}