-- AlterTable Tenant
ALTER TABLE "Tenant" ADD COLUMN "invoiceDetails" TEXT;

-- AlterTable CustomerOrder
ALTER TABLE "CustomerOrder" ADD COLUMN "invoiceSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CustomerOrder_invoiceSentAt_idx" ON "CustomerOrder"("invoiceSentAt");
