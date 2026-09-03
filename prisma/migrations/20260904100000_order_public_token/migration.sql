-- AlterTable
ALTER TABLE "CustomerOrder" ADD COLUMN "publicToken" TEXT;

-- Backfill unguessable tokens for existing orders (12 hex chars, ~48 bits).
UPDATE "CustomerOrder"
SET "publicToken" = 'ord_' || substr(translate(md5(random()::text || id), 'abcdef', '543210'), 1, 12);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerOrder_publicToken_key" ON "CustomerOrder"("publicToken");
