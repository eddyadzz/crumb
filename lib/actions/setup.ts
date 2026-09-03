'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/tenant';
import { recordActivity } from '@/lib/activity';

/**
 * Load a small, realistic sample bakery so a brand-new account can explore
 * every screen (variance, pricing, shopping list, reports) with real numbers.
 * Owners only, and only on a fresh account — never mixed with real data.
 */
export async function seedSampleBakery(): Promise<{ ok: true } | { error: string }> {
  const { tenantId } = await requireRole('OWNER');

  const [ingredientCount, recipeCount] = await Promise.all([
    prisma.ingredient.count({ where: { tenantId } }),
    prisma.recipe.count({ where: { tenantId } }),
  ]);
  if (ingredientCount > 0 || recipeCount > 0) {
    return { error: 'Sample data is only available on a fresh account' };
  }

  // Ingredients: purchase packs a bakery would actually buy (MVR prices).
  const ingredientDefs = [
    { name: 'Flour', baseUnit: 'g', purchaseQuantity: 2, purchaseUnit: 'kg', purchaseCost: 85, available: 5000, reorder: 1000 },
    { name: 'Sugar', baseUnit: 'g', purchaseQuantity: 1, purchaseUnit: 'kg', purchaseCost: 45, available: 2000, reorder: 500 },
    { name: 'Butter', baseUnit: 'g', purchaseQuantity: 500, purchaseUnit: 'g', purchaseCost: 60, available: 1000, reorder: 250 },
    { name: 'Eggs', baseUnit: 'pcs', purchaseQuantity: 30, purchaseUnit: 'pcs', purchaseCost: 55, available: 30, reorder: 10 },
    { name: 'Cocoa Powder', baseUnit: 'g', purchaseQuantity: 250, purchaseUnit: 'g', purchaseCost: 95, available: 500, reorder: 100 },
    { name: 'Cream Cheese', baseUnit: 'g', purchaseQuantity: 250, purchaseUnit: 'g', purchaseCost: 70, available: 750, reorder: 200 },
  ];
  const ingredients: Record<string, { id: string; availableQuantity: number }> = {};
  for (const def of ingredientDefs) {
    const ing = await prisma.ingredient.create({
      data: {
        tenantId,
        name: def.name,
        baseUnit: def.baseUnit,
        purchaseQuantity: def.purchaseQuantity,
        purchaseUnit: def.purchaseUnit,
        purchaseCost: def.purchaseCost,
        availableQuantity: def.available,
        reorderLevel: def.reorder,
      },
    });
    await prisma.ingredientMovement.create({
      data: { ingredientId: ing.id, type: 'PURCHASE', quantity: def.purchaseQuantity, notes: 'Initial stock' },
    });
    ingredients[def.name] = { id: ing.id, availableQuantity: ing.availableQuantity };
  }

  const recipe = await prisma.recipe.create({
    data: {
      tenantId,
      name: 'Chocolate Cake',
      description: 'Rich single-layer chocolate cake — 8 slices',
      instructions:
        '1. Cream butter and sugar.\n2. Beat in eggs, then fold in flour and cocoa.\n3. Bake at 180°C for 35 minutes.\n4. Cool before slicing into 8.',
      preparationTime: 60,
      servingsProduced: 8,
      packagingCost: 8,
      utilityCost: 6,
      laborCost: 20,
      recipeIngredients: {
        create: [
          { ingredientId: ingredients['Flour'].id, quantity: 250, unit: 'g' },
          { ingredientId: ingredients['Sugar'].id, quantity: 200, unit: 'g' },
          { ingredientId: ingredients['Butter'].id, quantity: 125, unit: 'g' },
          { ingredientId: ingredients['Eggs'].id, quantity: 3, unit: 'pcs' },
          { ingredientId: ingredients['Cocoa Powder'].id, quantity: 45, unit: 'g' },
        ],
      },
    },
  });

  const product = await prisma.product.create({
    data: {
      tenantId,
      recipeId: recipe.id,
      name: 'Chocolate Cake Slice',
      sellingPrice: 32,
      type: 'WHOLE',
      availableQuantity: 0,
    },
  });

  // A repeat customer with two upcoming orders (for insights + shopping list).
  const customer = await prisma.customer.create({
    data: {
      tenantId,
      name: "Aishah's Café",
      phone: '+960 777-1234',
      email: 'orders@aishahcafe.mv',
      notes: 'Weekly standing order — deliver before 9am',
    },
  });
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await prisma.customerOrder.create({
    data: {
      tenantId,
      customerId: customer.id,
      status: 'CONFIRMED',
      totalAmount: 2 * product.sellingPrice,
      deliveryDate: tomorrow,
      deliveryTime: '09:00',
      items: { create: [{ productId: product.id, quantity: 2, unitPrice: product.sellingPrice }] },
    },
  });
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  await prisma.customerOrder.create({
    data: {
      tenantId,
      customerId: customer.id,
      status: 'PENDING',
      totalAmount: 4 * product.sellingPrice,
      deliveryDate: nextWeek,
      items: { create: [{ productId: product.id, quantity: 4, unitPrice: product.sellingPrice }] },
    },
  });

  // One completed production run WITH deliberate usage variance (+20% butter,
  // -5% sugar) so cost variance, efficiency, and pricing have a story.
  const productionOrder = await prisma.productionOrder.create({
    data: { tenantId, status: 'COMPLETED', completedAt: new Date() },
  });
  const productionItem = await prisma.productionItem.create({
    data: { productionOrderId: productionOrder.id, recipeId: recipe.id, batchCount: 1 },
  });
  const plannedBase: Record<string, number> = {
    Flour: 250,
    Sugar: 200,
    Butter: 125,
    Eggs: 3,
    'Cocoa Powder': 45,
  };
  const multipliers: Record<string, number> = { Butter: 1.2, Sugar: 0.95 };
  const producedUnits = recipe.servingsProduced; // WHOLE product: servings × batches
  for (const [name, planned] of Object.entries(plannedBase)) {
    const actual = planned * (multipliers[name] ?? 1);
    const ing = ingredients[name];
    const newQty = Math.max(0, ing.availableQuantity - actual);
    await prisma.ingredient.update({ where: { id: ing.id }, data: { availableQuantity: newQty } });
    await prisma.ingredientMovement.create({
      data: {
        ingredientId: ing.id,
        type: 'PRODUCTION',
        quantity: -actual,
        notes: `Used for Chocolate Cake (1 batch)`,
      },
    });
    await prisma.productionItemIngredient.create({
      data: {
        productionItemId: productionItem.id,
        ingredientId: ing.id,
        ingredientName: name,
        plannedQuantity: planned,
        actualQuantity: actual,
      },
    });
  }
  await prisma.product.update({
    where: { id: product.id },
    data: { availableQuantity: { increment: producedUnits } },
  });
  await prisma.productMovement.create({
    data: { productId: product.id, type: 'PRODUCED', quantity: producedUnits },
  });

  // A couple of walk-in sales today (for Sell + Reports).
  for (const quantity of [3, 2]) {
    await prisma.sale.create({
      data: {
        tenantId,
        totalAmount: quantity * product.sellingPrice,
        items: { create: [{ productId: product.id, quantity, unitPrice: product.sellingPrice }] },
      },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { availableQuantity: { decrement: quantity } },
    });
    await prisma.productMovement.create({
      data: { productId: product.id, type: 'SOLD', quantity },
    });
  }

  await recordActivity({
    tenantId,
    type: 'PRODUCTION_COMPLETED',
    title: 'Sample bakery loaded',
    description: 'Chocolate Cake with one completed batch, orders, and sales',
  });

  revalidatePath('/');
  revalidatePath('/recipes');
  revalidatePath('/ingredients');
  revalidatePath('/products');
  revalidatePath('/orders');
  revalidatePath('/produce');
  revalidatePath('/reports');
  revalidatePath('/customers');
  return { ok: true };
}