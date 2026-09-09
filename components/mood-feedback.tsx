'use client';

import { useState, useSyncExternalStore, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { submitFeedback } from '@/lib/actions/feedback';

const ASKED_KEY = 'crumb-mood-asked-until';
const ASKED_EVENT = 'crumb-mood-asked';
/** Re-ask roughly once a day. */
const ASKED_MS = 20 * 60 * 60 * 1000;

let askedRaw: string | null = null;
let askedCache = 0;

function getAskedSnapshot(): number {
  try {
    const raw = localStorage.getItem(ASKED_KEY);
    if (raw !== askedRaw) {
      askedRaw = raw;
      const until = raw ? Number(raw) : NaN;
      askedCache = Number.isFinite(until) && until > Date.now() ? until : 0;
    }
    return askedCache;
  } catch {
    return 0;
  }
}

function markAsked() {
  const until = Date.now() + ASKED_MS;
  try {
    localStorage.setItem(ASKED_KEY, String(until));
  } catch {
    // private mode — suppression is best-effort
  }
  askedRaw = null; // invalidate the cache so the next read re-fetches
  window.dispatchEvent(new Event(ASKED_EVENT));
}

function subscribeAsked(notify: () => void) {
  window.addEventListener(ASKED_EVENT, notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(ASKED_EVENT, notify);
    window.removeEventListener('storage', notify);
  };
}

const MOODS = [
  { emoji: '🙂', label: 'Easy' },
  { emoji: '😐', label: 'Confusing' },
  { emoji: '☹', label: 'Frustrating' },
] as const;

/**
 * One-tap mood capture: a mood, an optional comment, straight into the
 * Feedback table. Re-asks about once a day per device. Renders content only —
 * the parent decides the wrapper.
 */
export function MoodFeedbackCard({
  context,
  question = 'How was your baking day?',
  className,
}: {
  context: string;
  question?: string;
  className?: string;
}) {
  const askedUntil = useSyncExternalStore(subscribeAsked, getAskedSnapshot, () => 0);
  const [mood, setMood] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  if (askedUntil > 0) return null;

  const selected = MOODS.find((m) => m.label === mood);

  const send = () => {
    if (!selected) return;
    startTransition(async () => {
      const parts = [`${selected.emoji} ${selected.label}`, context, comment.trim()].filter(Boolean);
      const res = await submitFeedback(parts.join(' — '));
      if (res.ok) {
        setSent(true);
        // let the thanks be seen, then stop asking for ~a day
        setTimeout(markAsked, 2500);
      }
    });
  };

  if (sent) {
    return (
      <div className={cn('py-2 text-center text-sm text-success', className)}>
        Thanks — noted. This is how Crumb gets better.
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-sm font-medium">{question}</p>
      <div className="flex flex-wrap gap-2">
        {MOODS.map((m) => (
          <button
            key={m.label}
            type="button"
            onClick={() => setMood(m.label)}
            className={cn(
              'rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
              mood === m.label
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:bg-muted/50',
            )}
          >
            <span className="mr-1.5">{m.emoji}</span>
            {m.label}
          </button>
        ))}
      </div>
      {selected && (
        <>
          <Textarea
            rows={2}
            maxLength={1000}
            placeholder={selected.label === 'Easy' ? 'What made it easy? (optional)' : 'What was confusing or frustrating? (optional)'}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={send} disabled={pending}>
              {pending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
