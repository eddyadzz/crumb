'use client';

import { useEffect, useState } from 'react';
import {
  Webhook,
  WebhookOff,
  Loader2,
  Plus,
  Copy,
  Trash2,
  Check,
  ChevronDown,
  ChevronRight,
  History,
} from 'lucide-react';
import {
  createWebhook,
  updateWebhook,
  deleteWebhook,
  listWebhookEndpoints,
  listWebhookDeliveries,
  type WebhookEndpointRow,
  type WebhookDeliveryRow,
} from '@/lib/actions/webhooks';
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_LABELS, type WebhookEvent } from '@/lib/webhooks-core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export function WebhooksCard() {
  const [endpoints, setEndpoints] = useState<WebhookEndpointRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<WebhookEvent>>(new Set());
  const [createdSecret, setCreatedSecret] = useState<{ id: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDeliveryRow[]>>({});

  const refresh = () =>
    listWebhookEndpoints()
      .then(setEndpoints)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    refresh();
  }, []);

  const toggleEvent = (e: WebhookEvent) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
  };

  const submit = async () => {
    setCreating(true);
    setError(null);
    setCreatedSecret(null);
    const res = await createWebhook({ name, url, events: [...selectedEvents] });
    setCreating(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCreatedSecret({ id: res.id, secret: res.secret });
    setName('');
    setUrl('');
    setSelectedEvents(new Set());
    setFormOpen(false);
    await refresh();
  };

  const toggleEnable = async (ep: WebhookEndpointRow) => {
    await updateWebhook(ep.id, { isEnabled: !ep.isEnabled });
    await refresh();
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this webhook endpoint? Deliveries will be removed.')) return;
    await deleteWebhook(id);
    if (openHistory === id) setOpenHistory(null);
    await refresh();
  };

  const toggleHistory = async (id: string) => {
    if (openHistory === id) {
      setOpenHistory(null);
      return;
    }
    setOpenHistory(id);
    const rows = await listWebhookDeliveries(id).catch(() => []);
    setDeliveries((prev) => ({ ...prev, [id]: rows }));
  };

  const copySecret = async () => {
    if (!createdSecret) return;
    await navigator.clipboard.writeText(createdSecret.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Webhook className="h-5 w-5 text-muted-foreground" />
          Webhook Endpoints
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Receive real-time events (orders, sales, production, low stock) at your
          own URL. Each request is signed with an HMAC-SHA256 secret so you can
          verify it came from Crumb.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : endpoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">No webhook endpoints yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border">
            {endpoints.map((ep) => (
              <div key={ep.id} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{ep.name}</span>
                      {!ep.isEnabled && (
                        <Badge variant="outline" className="gap-0.5">
                          <WebhookOff className="h-3 w-3" /> Disabled
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{ep.url}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {ep.events.join(', ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-muted-foreground"
                      onClick={() => toggleHistory(ep.id)}
                      aria-label="Delivery history"
                    >
                      {openHistory === ep.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <History className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => toggleEnable(ep)}
                    >
                      {ep.isEnabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(ep.id)}
                      aria-label={`Delete ${ep.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {openHistory === ep.id && (
                  <div className="mt-2 rounded-lg border border-border bg-muted/20 p-2">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Recent deliveries
                    </p>
                    {!deliveries[ep.id] ? (
                      <p className="text-xs text-muted-foreground">Loading...</p>
                    ) : deliveries[ep.id].length === 0 ? (
                      <p className="text-xs text-muted-foreground">No deliveries yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {deliveries[ep.id].map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="truncate">
                              <span className={d.success ? 'text-emerald-600' : 'text-destructive'}>
                                {d.success ? (
                                  <Check className="mr-1 inline h-3 w-3" />
                                ) : (
                                  <WebhookOff className="mr-1 inline h-3 w-3" />
                                )}
                              </span>
                              {d.eventType}
                            </span>
                            <span className="text-muted-foreground">
                              {d.statusCode != null ? `HTTP ${d.statusCode} · ` : ''}
                              {new Date(d.createdAt).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!formOpen && !createdSecret && (
          <Button className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Add webhook endpoint
          </Button>
        )}

        {formOpen && (
          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <div>
              <Label htmlFor="wh-name">Name</Label>
              <Input
                id="wh-name"
                className="mt-1"
                placeholder="e.g. Shopify sync"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="wh-url">Endpoint URL</Label>
              <Input
                id="wh-url"
                className="mt-1"
                placeholder="https://example.com/hooks/crumb"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div>
              <Label>Events</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {WEBHOOK_EVENTS.map((e) => {
                  const on = selectedEvents.has(e);
                  return (
                    <button
                      key={e}
                      type="button"
                      onClick={() => toggleEvent(e)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        on ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      {on && <Check className="mr-1 inline h-3 w-3" />}
                      {WEBHOOK_EVENT_LABELS[e]}
                    </button>
                  );
                })}
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex items-center gap-2">
              <Button
                className="gap-2"
                disabled={creating || !name.trim() || !url.trim() || selectedEvents.size === 0}
                onClick={submit}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create webhook
              </Button>
              <Button variant="ghost" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {createdSecret && (
          <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-semibold text-primary">Endpoint created — save your signing secret</p>
            <p className="text-xs text-muted-foreground">
              This secret is shown only once. Use it to verify the{' '}
              <code>X-BoliFlow-Signature</code> on every request.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-background px-3 py-2 text-xs">
                {createdSecret.secret}
              </code>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={copySecret}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setCreatedSecret(null)}>
              Done
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}