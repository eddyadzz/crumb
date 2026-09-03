import { NextRequest, NextResponse } from 'next/server';
import { runJob } from '@/lib/jobs';
import { sendOrderReminders, remindersAlreadySentToday } from '@/lib/actions/reminders';

export const dynamic = 'force-dynamic';

/**
 * Morning-briefing cron. Protected by a bearer token so only your scheduler
 * (Vercel Cron / external cron hitting this URL) can trigger it. Set
 * CRON_REMINDERS_SECRET in the environment. Idempotent per day: a second
 * successful run on the same day returns { skipped: true } instead of
 * duplicating notifications.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_REMINDERS_SECRET;
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (await remindersAlreadySentToday()) {
      return NextResponse.json({ skipped: true, reason: 'already sent today' });
    }

    let summary: Awaited<ReturnType<typeof sendOrderReminders>> | null = null;
    await runJob('order-reminders', async () => {
      summary = await sendOrderReminders();
    });
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Cron failed' },
      { status: 500 }
    );
  }
}