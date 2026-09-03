'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Store, Copy, Check, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { setOrderPortalEnabled } from '@/lib/actions/portal';

export function PortalCard({ enabled, slug }: { enabled: boolean; slug: string }) {
  const [on, setOn] = useState(enabled);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const path = `/order/${slug}`;

  const toggle = (next: boolean) => {
    setOn(next);
    startTransition(async () => {
      try {
        await setOrderPortalEnabled(next);
      } catch {
        setOn(!next); // revert on failure
      }
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.open(path, '_blank');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Store className="h-5 w-5 text-muted-foreground" />
          Order Portal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Let customers order themselves</p>
            <p className="text-xs text-muted-foreground">
              Share your link — orders arrive as Pending and join your schedule once confirmed.
            </p>
          </div>
          <Switch checked={on} onCheckedChange={toggle} disabled={pending} />
        </div>

        {on && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 p-2.5">
            <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{path}</code>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copy} aria-label="Copy link">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Open portal">
              <a href={path} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        )}
        {on && (
          <p className="text-xs text-muted-foreground">
            New portal orders notify you and appear in{' '}
            <Link href="/orders" className="underline underline-offset-2">
              Orders
            </Link>{' '}
            as Pending.
          </p>
        )}
        {pending && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
          </p>
        )}
      </CardContent>
    </Card>
  );
}