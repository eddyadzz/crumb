-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "yearlyPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "Plan_active_sortOrder_idx" ON "Plan"("active", "sortOrder");

-- Backfill Plan rows from the legacy SubscriptionTier catalog.
-- Reuse the tier ids so existing Subscriptions can be mapped by join.
INSERT INTO "Plan" ("id", "code", "name", "description", "monthlyPrice", "yearlyPrice", "active", "sortOrder", "features", "createdAt", "updatedAt")
SELECT "id",
       lower("key"::text),
       "name",
       NULL,
       "priceMonthly",
       "priceYearly",
       "isActive",
       CASE "key"::text WHEN 'FREE' THEN 0 WHEN 'PRO' THEN 1 WHEN 'BUSINESS' THEN 2 ELSE 99 END,
       to_jsonb("features"),
       "createdAt",
       "updatedAt"
FROM "SubscriptionTier";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_tierId_fkey";

-- DropIndex
DROP INDEX "Subscription_tenantId_idx";

-- DropIndex
DROP INDEX "Subscription_tierId_idx";

-- DropIndex
DROP INDEX "Tenant_subscriptionTier_idx";

-- AlterTable (add the new columns; planId starts nullable so it can be backfilled)
ALTER TABLE "Subscription"
ADD COLUMN     "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "planId" TEXT,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- Map existing subscriptions to their legacy tier (now a Plan)
UPDATE "Subscription" s
SET "planId" = "Plan"."id"
FROM "Plan"
WHERE s."tierId" = "Plan"."id";

-- Carry the trial end date onto the subscription (was duplicated on the Tenant)
UPDATE "Subscription" s
SET "trialEndsAt" = t."trialEndsAt"
FROM "Tenant" t
WHERE s."tenantId" = t."id"
  AND t."trialEndsAt" IS NOT NULL
  AND s."trialEndsAt" IS NULL;

-- Ensure every tenant has exactly one subscription (created from the tenant's
-- denormalized subscription state where none existed before).
INSERT INTO "Subscription" ("id", "tenantId", "planId", "status", "billingInterval", "startsAt", "endsAt", "trialEndsAt", "autoRenew", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t."id", p."id",
       t."subscriptionStatus",
       'MONTHLY'::"BillingInterval",
       t."createdAt",
       t."trialEndsAt",
       t."trialEndsAt",
       true,
       t."createdAt",
       now()
FROM "Tenant" t
JOIN "Plan" p ON p."code" = lower(t."subscriptionTier"::text)
WHERE NOT EXISTS (SELECT 1 FROM "Subscription" s WHERE s."tenantId" = t."id");

-- planId is now populated everywhere
ALTER TABLE "Subscription" ALTER COLUMN "planId" SET NOT NULL;

-- DropColumn
ALTER TABLE "Subscription" DROP COLUMN "tierId";

-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "subscriptionStatus",
DROP COLUMN "subscriptionTier",
DROP COLUMN "trialEndsAt";

-- DropTable
DROP TABLE "SubscriptionTier";

-- DropEnum
DROP TYPE "TierKey";

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_tenantId_key" ON "Subscription"("tenantId");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;