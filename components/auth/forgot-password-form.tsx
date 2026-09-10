'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Carrot, Loader2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = 'email' | 'reset';

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Never reveal whether the account exists — same message either way.
  const GENERIC_SENT = 'If an account exists with that email, a reset code is on its way.';

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await authClient.emailOtp.requestPasswordReset({ email });
    setLoading(false);
    if (res.error) {
      setError(res.error.message ?? 'Unable to send a reset code');
      return;
    }
    setStep('reset');
  };

  const handleResend = async () => {
    setLoading(true);
    setError(null);
    await authClient.emailOtp.requestPasswordReset({ email });
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
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
    const res = await authClient.emailOtp.resetPassword({
      email,
      otp,
      password,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error.message ?? "Couldn't reset your password");
      return;
    }
    router.push('/sign-in?reset=1');
    router.refresh();
  };

  const headerCopy: Record<Step, { title: string; sub: string }> = {
    email: {
      title: 'Reset your password',
      sub: 'Enter your email and we\u2019ll send a 6-digit reset code',
    },
    reset: {
      title: 'Enter your reset code',
      sub: 'Code, plus the new password for next time',
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

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
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
              Email me a reset code
            </Button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-otp">Reset code</Label>
              <Input
                id="reset-otp"
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
            <div className="space-y-2">
              <Label htmlFor="reset-password">
                New password <span className="text-xs font-normal text-muted-foreground">(min 8)</span>
              </Label>
              <Input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-confirm">Confirm password</Label>
              <Input
                id="reset-confirm"
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
              Reset Password
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
                Resend code
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{' '}
          <Link href="/sign-in" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
