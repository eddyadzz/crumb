import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { prisma } from '@/lib/prisma';

const PUBLIC_ROUTES = ['/sign-in', '/sign-up', '/invite'];

const PORTAL_ROOTS = new Set([
  'ingredients',
  'recipes',
  'products',
  'produce',
  'sell',
  'reports',
  'settings',
  'tools',
]);

const RESERVED = new Set([
  'sign-in',
  'sign-up',
  'onboarding',
  'admin',
  'api',
  '_next',
]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  const isApiAuth = pathname.startsWith('/api/auth');
  const isApiCron = pathname.startsWith('/api/cron');

  // Auth + cron endpoints are public at the proxy; auth is handled inside the
  // route (bearer token for cron, better-auth for auth).
  if (isPublic || isApiAuth || isApiCron) return NextResponse.next();

  const sessionCookie = getSessionCookie(request, { cookiePrefix: 'crumb' });

  // Path-based tenant URLs: /{slug}/{portal...} rewrites to the tenant portal.
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0 && !RESERVED.has(segments[0]) && !PORTAL_ROOTS.has(segments[0])) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: segments[0] },
      select: { id: true },
    });
    if (tenant) {
      if (sessionCookie) {
        const url = request.nextUrl.clone();
        url.pathname = `/${segments.slice(1).join('/')}`;
        return NextResponse.rewrite(url);
      }
      // Keep the slug in the return-to URL so users land back on it after login.
      const url = request.nextUrl.clone();
      url.pathname = '/sign-in';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
  }

  if (!sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};