import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const trialDays = Number(process.env.SEED_TRIAL_DAYS ?? '14');

async function main() {
  console.log('Seeding database...');

  // Clear existing data in dependency order
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.productMovement.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productionItem.deleteMany();
  await prisma.productionOrder.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.ingredientMovement.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.subscriptionTier.deleteMany();
  await prisma.tenant.deleteMany();

  // Auth tables (sessions/accounts cascade from user delete)
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();

  // --- Subscription tiers ---
  const tiers = [
    {
      key: 'FREE' as const,
      name: 'Free',
      priceMonthly: 0,
      priceYearly: 0,
      features: ['1 business', '1 user', 'Unlimited recipes & ingredients', 'Unlimited sales & production'],
    },
    {
      key: 'PRO' as const,
      name: 'Pro',
      priceMonthly: 199,
      priceYearly: 1990,
      features: ['Everything in Free', 'Customer management', 'Product catalog', 'Expense tracking', 'Recipe scaling', 'Exports'],
    },
    {
      key: 'BUSINESS' as const,
      name: 'Business',
      priceMonthly: 499,
      priceYearly: 4990,
      features: ['Everything in Pro', 'Multiple users & team roles', 'Activity logs', 'Supplier directory', 'Advanced reporting'],
    },
  ];
  await prisma.subscriptionTier.createMany({ data: tiers });

  // --- Demo tenant ---
  const trialEnd = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
  const freeTier = await prisma.subscriptionTier.findUniqueOrThrow({
    where: { key: 'FREE' },
  });
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Sweet Crumbs Bakery',
      slug: 'sweet-crumbs',
      email: process.env.SEED_OWNER_EMAIL ?? 'owner@crumb.mv',
      phone: '+960 777 0000',
      country: 'MV',
      status: 'ACTIVE',
      subscriptionTier: 'FREE',
      subscriptionStatus: 'TRIAL',
      trialEndsAt: trialEnd,
    },
  });
  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      tierId: freeTier.id,
      status: 'TRIAL',
      startsAt: new Date(),
      endsAt: trialEnd,
      autoRenew: true,
    },
  });

  // --- Demo owner user (passwordless: sign in via email OTP) ---
  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? 'owner@crumb.mv';
  await prisma.user.create({
    data: {
      name: 'Sweet Crumbs Bakery',
      email: ownerEmail,
      emailVerified: true,
      tenantId: tenant.id,
      role: 'OWNER',
      isOwner: true,
    },
  });
  console.log(`Demo owner user ready: ${ownerEmail} (sign in with email OTP)`);

  // --- Ingredients ---
  const ingredients = [
    {
      name: 'Butter', baseUnit: 'g', purchaseQuantity: 1000, purchaseUnit: 'g',
      purchaseCost: 50, availableQuantity: 820, reorderLevel: 200,
      notes: 'Unsalted, stored in fridge', createdAt: new Date('2025-08-01T08:00:00Z'),
    },
    {
      name: 'Sugar', baseUnit: 'g', purchaseQuantity: 1, purchaseUnit: 'kg',
      purchaseCost: 35, availableQuantity: 1450, reorderLevel: 500,
      createdAt: new Date('2025-08-01T08:00:00Z'),
    },
    {
      name: 'Cream Cheese', baseUnit: 'g', purchaseQuantity: 500, purchaseUnit: 'g',
      purchaseCost: 120, availableQuantity: 480, reorderLevel: 250,
      createdAt: new Date('2025-08-02T08:00:00Z'),
    },
    {
      name: 'Flour', baseUnit: 'g', purchaseQuantity: 1, purchaseUnit: 'kg',
      purchaseCost: 28, availableQuantity: 180, reorderLevel: 500,
      notes: 'All-purpose', createdAt: new Date('2025-08-01T08:00:00Z'),
    },
    {
      name: 'Eggs', baseUnit: 'pcs', purchaseQuantity: 30, purchaseUnit: 'pcs',
      purchaseCost: 45, availableQuantity: 18, reorderLevel: 6,
      createdAt: new Date('2025-08-01T08:00:00Z'),
    },
    {
      name: 'Cocoa Powder', baseUnit: 'g', purchaseQuantity: 250, purchaseUnit: 'g',
      purchaseCost: 60, availableQuantity: 220, reorderLevel: 100,
      createdAt: new Date('2025-08-03T08:00:00Z'),
    },
    {
      name: 'Vanilla Extract', baseUnit: 'ml', purchaseQuantity: 100, purchaseUnit: 'ml',
      purchaseCost: 80, availableQuantity: 75, reorderLevel: 30,
      createdAt: new Date('2025-08-03T08:00:00Z'),
    },
    {
      name: 'Milk', baseUnit: 'ml', purchaseQuantity: 1, purchaseUnit: 'l',
      purchaseCost: 18, availableQuantity: 350, reorderLevel: 500,
      createdAt: new Date('2025-08-04T08:00:00Z'),
    },
  ];

  const ingRecords: Record<string, { id: string }> = {};
  let ingIndex = 0;
  for (const ing of ingredients) {
    const rec = await prisma.ingredient.create({
      data: { ...ing, tenantId: tenant.id },
    });
    ingRecords[ing.name] = rec;
    ingIndex += 1;
  }

  // --- Ingredient movements ---
  await prisma.ingredientMovement.createMany({
    data: [
      { ingredientId: ingRecords['Butter'].id, type: 'PURCHASE', quantity: 1000, notes: 'Initial stock', createdAt: new Date('2025-08-01T08:00:00Z') },
      { ingredientId: ingRecords['Butter'].id, type: 'PRODUCTION', quantity: -200, notes: 'Cheese Cake batch', createdAt: new Date('2025-08-28T07:30:00Z') },
      { ingredientId: ingRecords['Flour'].id, type: 'ADJUSTMENT', quantity: -20, notes: 'Spillage', createdAt: new Date('2025-08-29T10:00:00Z') },
    ],
  });

  // --- Recipes ---
  const recipeData = [
    {
      name: 'Classic Cheese Cake',
      description: 'New York style baked cheesecake with graham crust',
      instructions:
        '1. Preheat oven to 175°C.\n2. Mix graham crumbs with melted butter, press into pan.\n3. Beat cream cheese with sugar until smooth.\n4. Add eggs one at a time, then vanilla.\n5. Pour filling over crust.\n6. Bake 55 minutes, turn off oven, let cool inside 1 hour.\n7. Chill 4+ hours before serving.',
      preparationTime: 90, servingsProduced: 10, status: 'ACTIVE' as const,
      packagingCost: 20, utilityCost: 15, laborCost: 30,
    },
    {
      name: 'Fudge Brownie',
      description: 'Dense, fudgy chocolate brownies',
      instructions:
        '1. Preheat oven to 180°C.\n2. Melt butter and cocoa together.\n3. Beat in sugar, then eggs.\n4. Fold in flour.\n5. Pour into lined tray.\n6. Bake 25 minutes until set but still soft.',
      preparationTime: 45, servingsProduced: 12, status: 'ACTIVE' as const,
      packagingCost: 10, utilityCost: 8, laborCost: 15,
    },
    {
      name: 'Banana Bread',
      description: 'Moist banana bread loaf',
      instructions:
        '1. Preheat oven to 175°C.\n2. Mash ripe bananas.\n3. Cream butter and sugar.\n4. Beat in eggs and bananas.\n5. Fold in flour and vanilla.\n6. Pour into loaf pan.\n7. Bake 50-55 minutes.',
      preparationTime: 60, servingsProduced: 8, status: 'ACTIVE' as const,
      packagingCost: 12, utilityCost: 10, laborCost: 20,
    },
  ];

  const recRecords: Record<string, { id: string }> = {};
  const recipeIngredientSource: Record<string, Array<{ ingredient: string; quantity: number; unit: string }>> = {
    'Classic Cheese Cake': [
      { ingredient: 'Butter', quantity: 100, unit: 'g' },
      { ingredient: 'Sugar', quantity: 200, unit: 'g' },
      { ingredient: 'Cream Cheese', quantity: 500, unit: 'g' },
      { ingredient: 'Eggs', quantity: 3, unit: 'pcs' },
      { ingredient: 'Vanilla Extract', quantity: 10, unit: 'ml' },
    ],
    'Fudge Brownie': [
      { ingredient: 'Butter', quantity: 150, unit: 'g' },
      { ingredient: 'Cocoa Powder', quantity: 80, unit: 'g' },
      { ingredient: 'Sugar', quantity: 250, unit: 'g' },
      { ingredient: 'Flour', quantity: 100, unit: 'g' },
      { ingredient: 'Eggs', quantity: 4, unit: 'pcs' },
    ],
    'Banana Bread': [
      { ingredient: 'Butter', quantity: 80, unit: 'g' },
      { ingredient: 'Sugar', quantity: 150, unit: 'g' },
      { ingredient: 'Flour', quantity: 200, unit: 'g' },
      { ingredient: 'Eggs', quantity: 2, unit: 'pcs' },
      { ingredient: 'Vanilla Extract', quantity: 5, unit: 'ml' },
    ],
  };

  for (const rec of recipeData) {
    const created = await prisma.recipe.create({
      data: {
        tenantId: tenant.id,
        name: rec.name,
        description: rec.description,
        instructions: rec.instructions,
        preparationTime: rec.preparationTime,
        servingsProduced: rec.servingsProduced,
        status: rec.status,
        packagingCost: rec.packagingCost,
        utilityCost: rec.utilityCost,
        laborCost: rec.laborCost,
        recipeIngredients: {
          create: recipeIngredientSource[rec.name].map((ri) => ({
            ingredientId: ingRecords[ri.ingredient].id,
            quantity: ri.quantity,
            unit: ri.unit,
          })),
        },
      },
    });
    recRecords[rec.name] = created;
  }

  // --- Production orders ---
  await prisma.productionOrder.create({
    data: {
      tenantId: tenant.id,
      status: 'COMPLETED',
      createdAt: new Date('2025-08-28T07:00:00Z'),
      completedAt: new Date('2025-08-28T09:30:00Z'),
      items: {
        create: [{ recipeId: recRecords['Classic Cheese Cake'].id, batchCount: 2 }],
      },
    },
  });
  await prisma.productionOrder.create({
    data: {
      tenantId: tenant.id,
      status: 'IN_PROGRESS',
      createdAt: new Date('2025-08-30T06:00:00Z'),
      items: {
        create: [
          { recipeId: recRecords['Fudge Brownie'].id, batchCount: 3 },
          { recipeId: recRecords['Banana Bread'].id, batchCount: 1 },
        ],
      },
    },
  });
  await prisma.productionOrder.create({
    data: {
      tenantId: tenant.id,
      status: 'PLANNED',
      createdAt: new Date('2025-08-31T05:00:00Z'),
      items: {
        create: [{ recipeId: recRecords['Classic Cheese Cake'].id, batchCount: 1 }],
      },
    },
  });

  // --- Products ---
  const productData = [
    { name: 'Cheese Cake Slice', recipe: 'Classic Cheese Cake', price: 8, qty: 10, type: 'PORTION' as const },
    { name: 'Whole Cheese Cake', recipe: 'Classic Cheese Cake', price: 75, qty: 1, type: 'WHOLE' as const },
    { name: 'Fudge Brownie', recipe: 'Fudge Brownie', price: 5, qty: 36, type: 'PORTION' as const },
    { name: 'Banana Bread Slice', recipe: 'Banana Bread', price: 6, qty: 8, type: 'PORTION' as const },
  ];

  const prodRecords: Record<string, { id: string }> = {};
  for (const p of productData) {
    const created = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: p.name,
        recipeId: recRecords[p.recipe].id,
        sellingPrice: p.price,
        availableQuantity: p.qty,
        type: p.type,
      },
    });
    prodRecords[p.name] = created;
  }

  // --- Product movements ---
  await prisma.productMovement.createMany({
    data: [
      { productId: prodRecords['Cheese Cake Slice'].id, type: 'PRODUCED', quantity: 20, createdAt: new Date('2025-08-28T09:30:00Z') },
      { productId: prodRecords['Cheese Cake Slice'].id, type: 'SOLD', quantity: 5, createdAt: new Date('2025-08-29T10:00:00Z') },
      { productId: prodRecords['Cheese Cake Slice'].id, type: 'GIFTED', quantity: 2, createdAt: new Date('2025-08-29T12:00:00Z') },
      { productId: prodRecords['Cheese Cake Slice'].id, type: 'SPOILED', quantity: 3, createdAt: new Date('2025-08-30T08:00:00Z') },
      { productId: prodRecords['Fudge Brownie'].id, type: 'PRODUCED', quantity: 36, createdAt: new Date('2025-08-30T06:00:00Z') },
    ],
  });

  // --- Sales ---
  const saleData = [
    { total: 16, items: [{ product: 'Cheese Cake Slice', qty: 2, price: 8 }], at: '2025-08-31T08:30:00Z' },
    { total: 15, items: [{ product: 'Fudge Brownie', qty: 3, price: 5 }], at: '2025-08-31T10:15:00Z' },
    { total: 75, items: [{ product: 'Whole Cheese Cake', qty: 1, price: 75 }], at: '2025-08-31T11:45:00Z' },
    { total: 12, items: [{ product: 'Banana Bread Slice', qty: 2, price: 6 }], at: '2025-08-31T13:20:00Z' },
    { total: 20, items: [{ product: 'Fudge Brownie', qty: 4, price: 5 }], at: '2025-08-30T09:00:00Z' },
    { total: 24, items: [{ product: 'Cheese Cake Slice', qty: 3, price: 8 }], at: '2025-08-30T14:30:00Z' },
  ];

  for (const s of saleData) {
    await prisma.sale.create({
      data: {
        tenantId: tenant.id,
        totalAmount: s.total,
        createdAt: new Date(s.at),
        items: {
          create: s.items.map((it) => ({
            productId: prodRecords[it.product].id,
            quantity: it.qty,
            unitPrice: it.price,
          })),
        },
      },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });