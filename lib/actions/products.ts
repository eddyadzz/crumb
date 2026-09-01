'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/tenant';

export interface CreateProductInput {
  recipeId: string;
  name: string;
  sellingPrice: number;
  type: 'WHOLE' | 'PORTION';
}

export async function createProduct(input: CreateProductInput) {
  const { tenantId } = await requireTenant();
  const recipe = await prisma.recipe.findFirst({
    where: { id: input.recipeId, tenantId },
    select: { id: true },
  });
  if (!recipe) throw new Error('Recipe not found');

  const product = await prisma.product.create({
    data: {
      tenantId,
      recipeId: input.recipeId,
      name: input.name,
      sellingPrice: input.sellingPrice,
      type: input.type,
      availableQuantity: 0,
    },
  });
  revalidatePath('/products');
  revalidatePath('/recipes');
  return product;
}

export async function deleteProduct(productId: string) {
  const { tenantId } = await requireTenant();
  const p = await prisma.product.findUnique({
    where: { id: productId, tenantId },
  });
  if (!p) throw new Error('Product not found');
  await prisma.product.delete({ where: { id: productId, tenantId } });
  revalidatePath('/products');
  revalidatePath(`/recipes/${p.recipeId}`);
  return true;
}

export async function bulkLogProductMovement(input: {
  productId: string;
  type: 'PRODUCED' | 'GIFTED' | 'SPOILED' | 'SAMPLE' | 'STAFF';
  quantity: number;
}) {
  const { tenantId } = await requireTenant();
  const product = await prisma.product.findUnique({
    where: { id: input.productId, tenantId },
  });
  if (!product) throw new Error('Product not found');

  const delta = input.type === 'PRODUCED' ? input.quantity : -input.quantity;
  const newQty = Math.max(0, product.availableQuantity + delta);

  await prisma.product.update({
    where: { id: input.productId },
    data: { availableQuantity: newQty },
  });
  await prisma.productMovement.create({
    data: { productId: input.productId, type: input.type, quantity: input.quantity },
  });
  revalidatePath('/products');
  return { newQuantity: newQty };
}