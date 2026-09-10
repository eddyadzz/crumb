'use server';

import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { isPlatformAdminEmail } from '@/lib/admin';

export interface SignInMethod {
  exists: boolean;
  hasPassword: boolean;
  /** Listed in PLATFORM_ADMIN_EMAILS — may not have an account yet. */
  isPlatformAdmin: boolean;
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
    return {
      exists: false,
      hasPassword: false,
      isPlatformAdmin: isPlatformAdminEmail(normalized),
    };
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    select: { id: true, accounts: { select: { providerId: true } } },
  });
  if (!user) {
    return {
      exists: false,
      hasPassword: false,
      isPlatformAdmin: isPlatformAdminEmail(normalized),
    };
  }

  return {
    exists: true,
    hasPassword: user.accounts.some((a) => a.providerId === 'credential'),
    isPlatformAdmin: isPlatformAdminEmail(normalized),
  };
}

/** Attach a password to the signed-in session's user (OTP-created accounts
 * have none). Runs server-side because /set-password is createAuthEndpoint
 * .serverOnly — it deliberately has no HTTP surface, so it must be called via
 * auth.api with the forwarded request headers for session context. */
export async function setPasswordForCurrentUser(
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userHeaders = await headers();
  try {
    await auth.api.setPassword({
      body: { newPassword },
      headers: userHeaders,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to set a password';
    return { ok: false, error: message };
  }
}