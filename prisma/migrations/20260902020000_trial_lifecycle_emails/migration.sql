-- Trial lifecycle emails: track the start of the current trial and which
-- email milestone (7d / 3d / 1d / expired) has already been sent, so the
-- cron handler stays idempotent per trial window.

ALTER TABLE "Subscription" ADD COLUMN "trialStartedAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "trialEmailSentFor" VARCHAR(16);