'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { FlaskConical, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resetSampleData } from '@/lib/actions/setup';

/**
 * Shown across the app while a business is running the sample bakery. Tells
 * testers exactly what they are looking at and gives one-tap reset.
 */
export function SampleBanner() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [closed, setClosed] = useState(false);

  if (closed) return null;

  const reset = () => {
    startTransition(async () => {
      await resetSampleData();
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-primary/20 bg-primary/10 px-4 py-2 text-xs">
      <FlaskConical className="h-4 w-4 shrink-0 text-primary" />
      <span className="font-medium text-primary">
        You are viewing sample bakery data — nothing here affects your real business.
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        disabled={pending}
        onClick={reset}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {pending ? 'Reloading…' : 'Reload Sample Bakery'}
      </Button>
      <button
        type="button"
        onClick={() => setClosed(true)}
        className="ml-auto rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted"
        aria-label="Dismiss sample banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
