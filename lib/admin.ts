import 'server-only';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export function isPlatformAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const allow = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

export async function requirePlatformAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !isPlatformAdminEmail(session.user.email)) {
    throw new Error('Forbidden');
  }
  return session.user;
}