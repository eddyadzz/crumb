import { NextRequest, NextResponse } from 'next/server';
import { runNotificationsCron } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * Daily notifications cron. Creates per-tenant in-app notices (low stock,
 * production due today, orders due tomorrow) and sends a single digest email
 * when new notices are created (respecting per-tenant email prefs). Protected
 * by a bearer token — clock it daily via Vercel Cron or an external scheduler.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_NOTIFICATIONS_SECRET;
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await runNotificationsCron();
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Cron failed' },
      { status: 500 }
    );
  }
}