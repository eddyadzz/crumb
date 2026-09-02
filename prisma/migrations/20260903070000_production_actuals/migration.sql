-- CreateTable
CREATE TABLE "ProductionItemIngredient" (
    "id" TEXT NOT NULL,
    "productionItemId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "ingredientName" TEXT NOT NULL,
    "plannedQuantity" DOUBLE PRECISION NOT NULL,
    "actualQuantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ProductionItemIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionItemIngredient_productionItemId_idx" ON "ProductionItemIngredient"("productionItemId");

-- CreateIndex
CREATE INDEX "ProductionItemIngredient_ingredientId_idx" ON "ProductionItemIngredient"("ingredientId");

-- AddForeignKey
ALTER TABLE "ProductionItemIngredient" ADD CONSTRAINT "ProductionItemIngredient_productionItemId_fkey" FOREIGN KEY ("productionItemId") REFERENCES "ProductionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionItemIngredient" ADD CONSTRAINT "ProductionItemIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;