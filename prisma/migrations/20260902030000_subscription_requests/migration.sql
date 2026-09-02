-- Manual subscription billing (v1, Maldives): configurable payment methods
-- and proof-of-payment upgrade requests. Approving a request flips the
-- tenant's Subscription to ACTIVE; the whole flow lives on the user-provided
-- PaymentMethod catalog so no deploys are needed to add/remove methods.

CREATE TYPE "SubscriptionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "details" TEXT,
    "currency" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedPlanId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "referenceNumber" TEXT NOT NULL,
    "proofImage" TEXT,
    "notes" TEXT,
    "status" "SubscriptionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,

    CONSTRAINT "SubscriptionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentMethod_code_key" ON "PaymentMethod"("code");
CREATE INDEX "PaymentMethod_active_sortOrder_idx" ON "PaymentMethod"("active", "sortOrder");
CREATE INDEX "SubscriptionRequest_status_idx" ON "SubscriptionRequest"("status");
CREATE INDEX "SubscriptionRequest_tenantId_idx" ON "SubscriptionRequest"("tenantId");
CREATE INDEX "SubscriptionRequest_requestedPlanId_idx" ON "SubscriptionRequest"("requestedPlanId");

ALTER TABLE "SubscriptionRequest" ADD CONSTRAINT "SubscriptionRequest_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubscriptionRequest" ADD CONSTRAINT "SubscriptionRequest_requestedPlanId_fkey"
    FOREIGN KEY ("requestedPlanId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubscriptionRequest" ADD CONSTRAINT "SubscriptionRequest_paymentMethodId_fkey"
    FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubscriptionRequest" ADD CONSTRAINT "SubscriptionRequest_reviewedBy_fkey"
    FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;