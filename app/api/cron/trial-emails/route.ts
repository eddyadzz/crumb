import { NextRequest, NextResponse } from 'next/server';
import { sendTrialEmails } from '@/lib/actions/trial';
import { runJob } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

/**
 * Trial lifecycle email cron. Protected by a bearer token so only your
 * scheduler (Vercel Cron / external cron hitting this URL) can trigger it.
 * Set CRON_TRIAL_SECRET in the environment.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_TRIAL_SECRET;
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let summary: Awaited<ReturnType<typeof sendTrialEmails>> | null = null;
    await runJob('trial-emails', async () => {
      summary = await sendTrialEmails();
    });
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Cron failed' },
      { status: 500 }
    );
  }
}