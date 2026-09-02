'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { teamAcceptInvitation } from '@/lib/actions/team';
import { Button } from '@/components/ui/button';

export function AcceptInviteForm({ token, tenantName }: { token: string; tenantName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const accept = async () => {
    setLoading(true);
    setError(null);
    const res = await teamAcceptInvitation(token);
    setLoading(false);
    if (res.error) {
      if (res.error === 'AUTH_REQUIRED') {
        router.push('/sign-in');
        return;
      }
      setError(res.error);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="space-y-3 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <p className="text-sm">
          You&apos;re now a member of <span className="font-semibold">{tenantName}</span>.
        </p>
        <Button className="w-full" onClick={() => router.push('/')}>
          Go to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Accept and join <span className="font-medium text-foreground">{tenantName}</span> as a team member.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" onClick={accept} disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Accept invitation
      </Button>
    </div>
  );
}