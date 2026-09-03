import { WifiOff } from 'lucide-react';

export const metadata = {
  title: 'Offline — Crumb',
};

/** Static offline fallback, precached by the service worker. Must not depend
 * on the session or tenant context so it always renders. */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/15">
        <WifiOff className="h-8 w-8 text-warning" />
      </div>
      <h1 className="font-display text-2xl font-bold">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Crumb can&apos;t reach the kitchen right now. Pages you visited recently
        still open, and batches you queue on the Floor sync automatically once
        you&apos;re back online.
      </p>
      <a
        href="/floor"
        className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
      >
        Try again
      </a>
    </div>
  );
}