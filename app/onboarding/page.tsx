'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, LogOut } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { CrumbLogo } from '@/components/crumb-logo';
import { createTenant } from '@/lib/actions/tenant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function OnboardingPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await createTenant({ businessName, phone, country });
    setLoading(false);
    if (result.error || !result.tenant) {
      setError(result.error ?? 'Unable to create your business');
      return;
    }
    router.push('/');
    router.refresh();
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/sign-in');
    router.refresh();
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <CrumbLogo className="h-12 w-12" />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Set up your business
            </h1>
            <p className="text-sm text-muted-foreground">
              One more step to open your Crumb workspace
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              placeholder="Sweet Crumbs Bakery"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+960 700 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country (optional)</Label>
            <Input
              id="country"
              autoComplete="country-name"
              placeholder="Maldives"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button className="w-full" size="lg" type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Start with a 14-day trial
          </Button>
        </form>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Free plan · 14 days trial</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to Crumb&apos;s terms.
          <Link href="/sign-in" className="ml-1 text-foreground underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}