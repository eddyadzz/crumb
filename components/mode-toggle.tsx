'use client';

import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';

export type UiMode = 'simple' | 'advanced';

const MODE_KEY = 'crumb-ui-mode';
const MODE_EVENT = 'crumb-ui-mode-changed';

let cachedMode: UiMode | null = null;

function readMode(): UiMode {
  if (cachedMode) return cachedMode;
  try {
    const raw = localStorage.getItem(MODE_KEY);
    cachedMode = raw === 'advanced' ? 'advanced' : 'simple';
  } catch {
    cachedMode = 'simple';
  }
  return cachedMode;
}

function subscribe(notify: () => void) {
  window.addEventListener(MODE_EVENT, notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(MODE_EVENT, notify);
    window.removeEventListener('storage', notify);
  };
}

/** The user's interface mode. Simple hides the power-tool surfaces; it is the
 * default until someone explicitly switches to Advanced. */
export function useUiMode(): UiMode {
  return useSyncExternalStore(subscribe, readMode, () => 'simple');
}

export function setUiMode(mode: UiMode) {
  cachedMode = mode;
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(MODE_EVENT));
}

export function ModeToggle({ className }: { className?: string }) {
  const mode = useUiMode();
  return (
    <div
      className={cn('inline-flex rounded-xl border border-border bg-muted p-1', className)}
      role="group"
      aria-label="Interface mode"
    >
      {(['simple', 'advanced'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setUiMode(m)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors',
            mode === m ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
          aria-pressed={mode === m}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
