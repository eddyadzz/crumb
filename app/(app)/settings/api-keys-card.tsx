'use client';

import { useEffect, useMemo, useState } from 'react';
import { Key, Loader2, Plus, Copy, Trash2, Check } from 'lucide-react';
import { createApiKey, revokeApiKey, listApiKeys, type ApiKeyRow } from '@/lib/actions/api-keys';
import { API_SCOPES, type ApiScope } from '@/lib/api-keys-core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export function ApiKeysCard({ canManage }: { canManage: boolean }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<Set<ApiScope>>(new Set());
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const refresh = () =>
    listApiKeys()
      .then(setKeys)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    refresh();
  }, []);

  const scopesLabel = useMemo(() => {
    const enabled = [...selectedScopes].sort();
    return enabled.length === 0 ? 'None selected' : enabled.join(', ');
  }, [selectedScopes]);

  const toggleScope = (s: ApiScope) => {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const submit = async () => {
    setCreating(true);
    setError(null);
    setCreatedToken(null);
    const res = await createApiKey({ name, scopes: [...selectedScopes] });
    setCreating(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCreatedToken(res.token);
    setName('');
    setSelectedScopes(new Set());
    setFormOpen(false);
    await refresh();
  };

  const revoke = async (id: string) => {
    if (!window.confirm('Revoke this API key? It will stop working immediately.')) return;
    await revokeApiKey(id);
    await refresh();
  };

  const copyToken = async () => {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Key className="h-5 w-5 text-muted-foreground" />
          API Keys
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Programmatic access to your data via the <code>/api/v1</code> endpoints.
          Keys are shown once at creation, so copy them somewhere safe.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No API keys yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{k.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {k.prefix} · {k.scopes.join(', ')}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {k.lastUsedAt
                      ? `Last used ${new Date(k.lastUsedAt).toLocaleString()}`
                      : 'Never used'}
                    {k.expiresAt ? ` · Expires ${new Date(k.expiresAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => revoke(k.id)}
                    aria-label={`Revoke ${k.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <Badge variant="outline">Active</Badge>
                )}
              </div>
            ))}
          </div>
        )}

        {canManage && !formOpen && !createdToken && (
          <Button className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Create API key
          </Button>
        )}

        {canManage && formOpen && (
          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <div>
              <Label htmlFor="apikey-name">Name</Label>
              <Input
                id="apikey-name"
                className="mt-1"
                placeholder="e.g. POS integration"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label>Scopes</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {API_SCOPES.map((s) => {
                  const on = selectedScopes.has(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleScope(s)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        on ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      {on && <Check className="mr-1 inline h-3 w-3" />}
                      {s}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{scopesLabel}</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex items-center gap-2">
              <Button className="gap-2" disabled={creating || !name.trim() || selectedScopes.size === 0} onClick={submit}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create key
              </Button>
              <Button variant="ghost" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {createdToken && (
          <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-semibold text-primary">Copy your API key now</p>
            <p className="text-xs text-muted-foreground">
              This is the only time it&apos;s shown. Treat it like a password.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-background px-3 py-2 text-xs">
                {createdToken}
              </code>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={copyToken}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setCreatedToken(null)}>
              Done
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}