import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const createMock = vi.fn();
const updateMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    systemJobRun: {
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

import { startJob, finishJob, runJob } from '@/lib/jobs';

beforeEach(() => {
  createMock.mockReset();
  updateMock.mockReset();
  createMock.mockResolvedValue({ id: 'run-1' });
  updateMock.mockResolvedValue({});
});

describe('job helpers', () => {
  it('startJob creates a RUNNING system job run and returns its id', async () => {
    const id = await startJob('notifications');
    expect(id).toBe('run-1');
    expect(createMock).toHaveBeenCalledWith({ select: { id: true }, data: { job: 'notifications' } });
  });

  it('finishJob marks a run with a status, timestamp and message', async () => {
    await finishJob('run-1', 'SUCCESS', 'all good');
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: { status: 'SUCCESS', finishedAt: expect.any(Date), message: 'all good' },
    });
  });

  it('runJob records SUCCESS when the job completes', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    await runJob('trial-emails', fn);
    expect(updateMock).toHaveBeenLastCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({ status: 'SUCCESS' }),
    });
  });

  it('runJob records FAILED with the error message and rethrows', async () => {
    const err = new Error('Mailgun down');
    const fn = vi.fn().mockRejectedValue(err);
    await expect(runJob('notifications', fn)).rejects.toThrow('Mailgun down');
    expect(updateMock).toHaveBeenLastCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({ status: 'FAILED', message: 'Mailgun down' }),
    });
  });

  it('runJob still throws if the ledger write fails on success', async () => {
    updateMock.mockRejectedValue(new Error('db down'));
    const err = new Error('boom');
    await expect(runJob('notifications', vi.fn().mockRejectedValue(err))).rejects.toThrow('boom');
  });
});