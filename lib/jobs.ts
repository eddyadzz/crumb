'use server';

import { prisma } from '@/lib/prisma';

export type JobStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';

/** Open a new job run; returns the run id so it can be finished later. */
export async function startJob(job: string): Promise<string> {
  const run = await prisma.systemJobRun.create({
    data: { job },
    select: { id: true },
  });
  return run.id;
}

/** Mark a running job as finished (SUCCESS/FAILED) with an optional message. */
export async function finishJob(
  id: string,
  status: Exclude<JobStatus, 'RUNNING'>,
  message?: string
): Promise<void> {
  await prisma.systemJobRun.update({
    where: { id },
    data: { status, finishedAt: new Date(), message: message ?? null },
  });
}

/**
 * Run a job, persisting a start + finish record. Best-effort writes: if the
 * ledger write itself fails we still throw the job's original error.
 */
export async function runJob(
  job: string,
  fn: () => Promise<void>
): Promise<void> {
  const id = await startJob(job).catch(() => null);
  try {
    await fn();
    if (id) await finishJob(id, 'SUCCESS').catch(() => {});
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Job failed';
    if (id) await finishJob(id, 'FAILED', message).catch(() => {});
    throw err;
  }
}