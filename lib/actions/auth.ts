'use server';

import { prisma } from '@/lib/prisma';

export interface SignInMethod {
  exists: boolean;
  hasPassword: boolean;
}

/**
 * "Validate existing user" for the sign-in flow: check whether the email has
 * an account and whether it already has a password (older OTP-era users were
 * created without one, so they fall back to a one-time code and set a
 * password after signing in).
 */
export async function lookupSignInMethod(email: string): Promise<SignInMethod> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { exists: false, hasPassword: false };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, accounts: { select: { providerId: true } } },
  });
  if (!user) return { exists: false, hasPassword: false };

  return {
    exists: true,
    hasPassword: user.accounts.some((a) => a.providerId === 'credential'),
  };
}
