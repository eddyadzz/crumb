'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Shows an "Install app" button while the browser offers PWA installation
 * (beforeinstallprompt). Renders nothing otherwise. */
export function InstallButton({ variant = 'ghost' }: { variant?: 'ghost' | 'outline' | 'secondary' }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!installEvent) return null;

  return (
    <Button
      variant={variant}
      size="sm"
      className="gap-1.5"
      onClick={async () => {
        await installEvent.prompt();
        setInstallEvent(null);
      }}
    >
      <Download className="h-4 w-4" />
      Install
    </Button>
  );
}