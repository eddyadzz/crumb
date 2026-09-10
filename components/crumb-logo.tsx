import { cn } from '@/lib/utils';

/**
 * The Crumb brand mark. Self-hosted in public/ (works offline with the PWA
 * shell) instead of hotlinking the CDN.
 */
export function CrumbLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand asset; images are unoptimized (next.config)
    <img src="/crumb-logo-256.png" alt="Crumb" className={cn('object-contain', className)} />
  );
}
