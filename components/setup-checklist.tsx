'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSyncExternalStore, useState, useTransition } from 'react';
import {
  Circle,
  CheckCircle2,
  Sparkles,
  Loader2,
  ChevronRight,
  Wand2,
  CircleAlert,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { seedSampleBakery } from '@/lib/actions/setup';
import type { SetupProgressVM } from '@/lib/queries';

const DISMISS_KEY = 'crumb-setup-dismissed-until';
const DISMISS_EVENT = 'crumb-setup-dismissed';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

let dismissRaw: string | null = null;
let dismissCache = 0;

/** Returns the stored expiry, or 0 once it has passed — so the component
 * reads a plain number and never touches the clock during render. */
function getDismissedSnapshot(): number {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw !== dismissRaw) {
      dismissRaw = raw;
      const until = raw ? Number(raw) : NaN;
      dismissCache = Number.isFinite(until) && until > Date.now() ? until : 0;
    }
    return dismissCache;
  } catch {
    return 0;
  }
}

function dismissSetup() {
  const until = Date.now() + DISMISS_MS;
  try {
    localStorage.setItem(DISMISS_KEY, String(until));
  } catch {
    // ignore
  }
  dismissRaw = null; // force snapshot refresh
  window.dispatchEvent(new Event(DISMISS_EVENT));
}

function subscribeDismiss(notify: () => void) {
  window.addEventListener(DISMISS_EVENT, notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(DISMISS_EVENT, notify);
    window.removeEventListener('storage', notify);
  };
}

export function SetupChecklist({ progress }: { progress: SetupProgressVM }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dismissedUntil = useSyncExternalStore(subscribeDismiss, getDismissedSnapshot, () => 0);

  const steps = [
    {
      label: 'Add your first ingredient',
      hint: 'Flour, sugar, eggs — this unlocks costing',
      done: progress.ingredients > 0,
      href: '/ingredients',
    },
    {
      label: 'Create your first recipe',
      hint: 'Or paste one you already have — unlocks pricing',
      done: progress.recipes > 0,
      href: '/recipes',
    },
    {
      label: 'Add a customer order',
      hint: 'Yours, or one from your portal — unlocks the schedule',
      done: progress.customerOrders > 0,
      href: '/orders?new=1',
    },
    {
      label: 'Run your first production batch',
      hint: 'Plan it from the order — Floor Mode is made for baking day',
      done: progress.completedBatches > 0,
      href: '/produce',
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const complete = doneCount === steps.length;

  const seed = () => {
    setError(null);
    startTransition(async () => {
      const result = await seedSampleBakery();
      if ('error' in result) setError(result.error);
      else router.refresh();
    });
  };

  if (complete || dismissedUntil > 0) return null;

  return (
    <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 to-transparent p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-2 font-display text-lg font-bold">
              <Sparkles className="h-5 w-5 text-primary" />
              Let&apos;s get you baking
            </p>
            <p className="text-sm text-muted-foreground">
              {doneCount === 0
                ? 'Four quick steps — most bakers finish in about 10 minutes.'
                : `${doneCount} of ${steps.length} done — almost there.`}
            </p>
          </div>
          <button
            type="button"
            onClick={dismissSetup}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Hide setup checklist for a week"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold text-primary">
            {Math.round((doneCount / steps.length) * 100)}%
          </p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <ul className="mt-4 space-y-1.5">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                step.done ? 'text-muted-foreground' : 'hover:bg-primary/10'
              )}
            >
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-primary" />
              )}
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm font-medium', step.done && 'line-through')}>
                  {step.label}
                </span>
                {!step.done && step.hint && (
                  <span className="block text-xs text-muted-foreground">{step.hint}</span>
                )}
              </span>
              {!step.done && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </Link>
          </li>
        ))}
      </ul>

      {progress.fresh && (
        <div className="mt-4 border-t border-primary/15 pt-4">
          <Button
            variant="secondary"
            className="w-full gap-2"
            onClick={seed}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {pending ? 'Loading sample bakery…' : 'Rather look around first? Load a sample bakery'}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Ingredients, a recipe, orders, a completed batch, and sales — real numbers everywhere.
          </p>
          {error && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-destructive">
              <CircleAlert className="h-3.5 w-3.5" />
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}