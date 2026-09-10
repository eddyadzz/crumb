'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Carrot, Loader2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { lookupSignInMethod } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Mode = 'sign-in' | 'sign-up';
type Step = 'email' | 'otp' | 'password' | 'details' | 'set-password';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_OTP: "That code isn't correct. Check it and try again.",
  OTP_EXPIRED: 'That code has expired. Request a new one.',
  TOO_MANY_ATTEMPTS: 'Too many attempts. Request a new code.',
  INVALID_EMAIL_OR_PASSWORD: "Email and password don't match an account.",
  USER_ALREADY_EXISTS: 'That email already has an account — sign in instead.',
  PASSWORD_TOO_SHORT: 'Passwords need at least 8 characters.',
};

function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

function routeAfterSignIn(
  router: ReturnType<typeof useRouter>,
  tenantId: string | null | undefined,
  next: string | null,
) {
  if (tenantId) router.push(next ?? '/');
  else router.push('/onboarding');
  router.refresh();
}

export function OtpForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const isSignUp = mode === 'sign-up';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resentAt, setResentAt] = useState<number | null>(null);

  const sendCode = async (suppressStep = false) => {
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
    if (!suppressStep) setStep('otp');
    return true;
  };

  /* ---------------- SIGN-UP (email -> code -> details) ---------------- */

  const handleEmailSubmitSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await sendCode(true)) setStep('otp');
  };

  /* ---------------- SIGN-IN ---------------- */

  const handleEmailCheckSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const method = await lookupSignInMethod(email);
    setLoading(false);
    if (!method.exists) {
      setError(`No account for ${email}. Create one below.`);
      return;
    }
    if (method.hasPassword) {
      setStep('password');
      return;
    }
    // OTP-era users: email a code (rare — only until they set a password).
    if (await sendCode(true)) setStep('otp');
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error: signInError } = await authClient.signIn.email({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(
        (signInError.code && ERROR_MESSAGES[signInError.code]) ??
          signInError.message ??
          'Unable to sign in',
      );
      setPassword('');
      return;
    }
    if (data?.user?.tenantId) router.push(next ?? '/');
    else router.push('/onboarding');
    router.refresh();
  };

  /* ---------------- shared OTP ---------------- */

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
      setError(ERROR_MESSAGES[signInError.code ?? ''] ?? (signInError.message ?? 'Unable to verify your code'));
      setOtp('');
      return;
    }
    // Sign-up: account now exists — fill out the rest of the info.
    if (isSignUp) {
      setStep('details');
      return;
    }
    // Sign-in via code: signed in now. If the account has a tenant, offer a
    // one-time password step (OTP-era users have no password yet).
    if (data?.user?.tenantId) {
      const method = await lookupSignInMethod(email);
      if (method.hasPassword) {
        router.push(next ?? '/');
      } else {
        setStep('set-password');
      }
      router.refresh();
      return;
    }
    router.push('/onboarding');
    router.refresh();
  };

  /* ---------------- SIGN-UP details + set-password ---------------- */

  const handleDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Passwords need at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: pwError } = await authClient.$fetch('/set-password', { method: 'POST', body: { newPassword: password } });
    setLoading(false);
    if (pwError) {
      setError(
        "We couldn't save a password — you're signed in by code for now. Try again in Settings or next sign-in.",
      );
      setTimeout(() => {
        router.push('/onboarding');
        router.refresh();
      }, 2200);
      return;
    }
    router.push('/onboarding');
    router.refresh();
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Passwords need at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: pwError } = await authClient.$fetch('/set-password', { method: 'POST', body: { newPassword: password } });
    setLoading(false);
    if (pwError) {
      setError("Couldn't save your password — you can still sign in with a code.");
      setTimeout(() => {
        router.push(next ?? '/');
        router.refresh();
      }, 2200);
      return;
    }
    router.push(next ?? '/');
    router.refresh();
  };



  const headerCopy: Record<Step, { title: string; sub: string }> = {
    email: {
      title: isSignUp ? 'Create your account' : 'Welcome back',
      sub: isSignUp
        ? 'We verify your email with a one-time code — only at signup'
        : 'Sign in with your email and password',
    },
    otp: {
      title: 'Check your email',
      sub: 'Enter the 6-digit code sent to your email',
    },
    password: { title: 'Welcome back', sub: `Enter your password for ${email}` },
    details: { title: 'A bit about you', sub: 'Your name and a password for next time' },
    'set-password': {
      title: 'Secure your account',
      sub: 'Set a password so you can sign in without codes',
    },
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
              {headerCopy[step].title}
            </h1>
            <p className="text-sm text-muted-foreground">{headerCopy[step].sub}</p>
          </div>
        </div>

        {step === 'email' && (
          <form
            onSubmit={isSignUp ? handleEmailSubmitSignUp : handleEmailCheckSignIn}
            className="space-y-4"
          >
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
                {error}{' '}
                {!isSignUp && (
                  <Link href="/sign-up" className="font-medium underline underline-offset-2">
                    Create an account
                  </Link>
                )}
              </p>
            )}

            <Button className="w-full" size="lg" type="submit" disabled={loading || email.length < 5}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
            </Button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handlePasswordSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              Sign In
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
                onClick={async () => {
                  if (await sendCode()) setStep('otp');
                }}
                disabled={loading}
                className="font-medium text-primary hover:underline disabled:opacity-50"
              >
                Email me a code instead
              </button>
            </div>
          </form>
        )}

        {step === 'otp' && (
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

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button className="w-full" size="lg" type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSignUp ? 'Verify Email' : 'Sign In'}
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

        {step === 'details' && (
          <form onSubmit={handleDetails} className="space-y-4">
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
            <div className="space-y-2">
              <Label htmlFor="new-password">Password <span className="text-xs font-normal text-muted-foreground">(min 8)</span></Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
        )}

        {step === 'set-password' && (
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="set-new-password">Password <span className="text-xs font-normal text-muted-foreground">(min 8)</span></Label>
              <Input
                id="set-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="set-confirm">Confirm password</Label>
              <Input
                id="set-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              Set Password
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? (
            <>
              Already have an account?{' '}
              <Link href="/sign-in" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{' '}
              <Link href="/sign-up" className="font-medium text-primary hover:underline">
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
