'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Carrot, Loader2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Mode = 'sign-in' | 'sign-up';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_OTP: "That code isn't correct. Check it and try again.",
  OTP_EXPIRED: 'That code has expired. Request a new one.',
  TOO_MANY_ATTEMPTS: 'Too many attempts. Request a new code.',
};

function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

export function OtpForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const isSignUp = mode === 'sign-up';

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resentAt, setResentAt] = useState<number | null>(null);

  const sendCode = async () => {
    setLoading(true);
    setError(null);
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: 'sign-in',
    });
    setLoading(false);
    if (sendError) {
      setError(sendError.message ?? 'Unable to send your sign-in code');
      return false;
    }
    return true;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await sendCode()) setStep('otp');
  };

  const handleResend = async () => {
    setLoading(true);
    setError(null);
    await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
    setLoading(false);
    setResentAt(Date.now());
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error: signInError } = await authClient.signIn.emailOtp({
      email,
      otp,
      ...(isSignUp ? { name } : {}),
    });
    setLoading(false);
    if (signInError) {
      setError(
        (signInError.code && ERROR_MESSAGES[signInError.code]) ??
          signInError.message ??
          'Unable to verify your code'
      );
      setOtp('');
      return;
    }
    if (data?.user?.tenantId) {
      router.push(next ?? '/');
    } else {
      router.push('/onboarding');
    }
    router.refresh();
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Carrot className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {step === 'otp' ? 'Check your email' : isSignUp ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {step === 'otp'
                ? 'Enter the 6-digit code sent to your email'
                : isSignUp
                  ? 'No passwords — we send you a code'
                  : 'Sign in to Crumb with a one-time code'}
            </p>
          </div>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button className="w-full" size="lg" type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Verification code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                maxLength={6}
                pattern="[0-9]{6}"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Sent to <span className="font-medium text-foreground">{email}</span>. The code expires in 10 minutes.
            </p>

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button className="w-full" size="lg" type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => setStep('email')}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Change email
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="font-medium text-primary hover:underline disabled:opacity-50"
              >
                {resentAt ? 'New code sent' : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? (
            <>
              Already have an account?{' '}
              <Link
                href="/sign-in"
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{' '}
              <Link
                href="/sign-up"
                className="font-medium text-primary hover:underline"
              >
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}