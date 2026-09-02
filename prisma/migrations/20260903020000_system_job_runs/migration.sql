-- System job runs (Phase H – Sprint 2).
-- Lightweight operational ledger for scheduled jobs (trial-email cron,
-- notifications cron, future backups/imports). Enables the SaaS dashboard's
-- email-health/job-health view and troubleshooting "I never got the email".

CREATE TABLE "SystemJobRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "message" TEXT,

    CONSTRAINT "SystemJobRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SystemJobRun_job_startedAt_idx" ON "SystemJobRun"("job", "startedAt");