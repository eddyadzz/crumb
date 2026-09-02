-- Activity Timeline (Phase H – Sprint 3).
-- Adds a per-tenant, append-only audit stream of user/system actions. Powers
-- the tenant /activity page, the Home widget, and (later) the SaaS feed.
-- actorUserId is recorded now so multi-user events populate automatically.

CREATE TYPE "ActivityType" AS ENUM ('ORDER_CREATED', 'ORDER_CONFIRMED', 'ORDER_CANCELLED', 'PRODUCTION_CREATED', 'PRODUCTION_COMPLETED', 'PRODUCTION_CANCELLED', 'SALE_COMPLETED', 'UPGRADE_REQUESTED', 'UPGRADE_APPROVED', 'UPGRADE_REJECTED', 'USER_INVITED', 'USER_REMOVED', 'SYSTEM');

CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityEvent_tenantId_createdAt_idx" ON "ActivityEvent"("tenantId", "createdAt");

ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;