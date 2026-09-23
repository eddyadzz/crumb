-- Align invoiceSentAt with schema (TIMESTAMPTZ) and drop the unindexed-schema index
ALTER TABLE "CustomerOrder" ALTER COLUMN "invoiceSentAt" TYPE TIMESTAMPTZ(6);
DROP INDEX "CustomerOrder_invoiceSentAt_idx";
