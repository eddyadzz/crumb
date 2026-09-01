# Crumb MVP
## By BoliFlow

**Tagline:** From Recipe to Profit

---

# Product Vision

Crumb is a mobile-first food production management platform built for:

- Home bakers
- Home kitchens
- Small food producers
- Frozen food sellers
- Cake businesses
- Catering businesses
- Cottage food operators

Crumb helps users answer four critical questions:

1. Do I have enough ingredients?
2. What does this product actually cost to make?
3. How much profit am I making?
4. What ingredients do I need to buy?

Crumb is not a restaurant POS.

Crumb is a production, costing, inventory, and profitability platform.

---

# Core Workflow

```text
Ingredients
    ↓
Recipes
    ↓
Production Planning
    ↓
Shopping List
    ↓
Production
    ↓
Finished Products
    ↓
Sales
    ↓
Profit Reports
```

---

# Design Philosophy

## Mobile First

Most users will interact with Crumb while:

- Cooking
- Baking
- Shopping for ingredients
- Selling products

The application must feel like:

- Shopify Mobile
- Square POS
- Stripe Dashboard
- Notion Mobile

Avoid:

- ERP-style screens
- Large tables
- Complex navigation
- Accounting software appearance

---

# MVP Modules

## 1. Dashboard

The dashboard provides a quick overview of the business.

### KPI Cards

```text
Today's Revenue
Today's Profit
Products Ready
Low Stock Items
Upcoming Production
```

### Quick Actions

```text
Add Ingredient
Create Recipe
Start Production
Create Sale
Open Converter
```

---

# 2. Ingredient Management

Ingredients are the foundation of the system.

---

## Ingredient Fields

```typescript
name
baseUnit
purchaseQuantity
purchaseCost
availableQuantity
reorderLevel
notes
```

---

## Example

```text
Butter

Purchase Quantity:
1000g

Purchase Cost:
50 MVR
```

System calculates:

```text
Cost Per Gram:
0.05 MVR
```

Stored as:

```text
Butter
Available: 1000g
Cost Per Unit: 0.05
```

---

## Supported Units

### Weight

```text
Gram (g)
Kilogram (kg)
```

### Liquid

```text
Milliliter (ml)
Liter (l)
```

### Count

```text
Piece (pcs)
```

Automatic conversions:

```text
1 kg = 1000 g
1 l = 1000 ml
```

---

## Inventory Movements

Inventory changes through:

### Purchase

```text
+1000g Butter
```

### Production

```text
-200g Butter
```

### Adjustment

```text
+50g
-50g
```

All movements are logged.

---

# 3. Recipe Management

Recipes define products.

Recipes are reusable and stored permanently.

---

## Recipe Fields

```typescript
name
description
preparationTime
instructions
servingsProduced
status
```

Example:

```text
Cheese Cake

Servings Produced:
10
```

---

## Recipe Ingredients

Each recipe contains:

```text
Butter          100g
Sugar           200g
Cream Cheese    500g
```

Ingredients must come from inventory.

---

## Recipe Costing

Automatically calculate recipe cost.

Formula:

```text
Ingredient Quantity
×
Cost Per Unit
```

---

## Additional Costs

Optional:

```text
Packaging Cost
Utility Cost
Labor Cost
```

---

## Costing Outputs

Display:

```text
Ingredient Cost

Additional Costs

Total Production Cost

Cost Per Serving
```

Example:

```text
Total Cost:
43 MVR

Servings:
10

Cost Per Serving:
4.30 MVR
```

---

# 4. Production Planning

Production planning helps users prepare for the day.

---

## Daily Production Plan

Example:

```text
2 x Cheese Cake

3 x Brownie

1 x Banana Bread
```

System combines ingredient requirements.

---

## Consolidated Requirements

Example:

```text
Butter Required:
250g

Sugar Required:
500g

Milk Required:
1L
```

---

## Inventory Validation

Before production:

```text
Required:
250g Butter

Available:
180g Butter
```

Result:

```text
Insufficient Stock
```

---

## Shopping List Generator

Automatically generate:

```text
Need To Purchase

Butter 70g
Milk 500ml
```

Actions:

```text
View
Print
Share
Export PDF
```

---

# 5. Production Orders

Production converts ingredients into sellable products.

---

## Create Production Order

Example:

```text
Recipe:
Cheese Cake

Batch Count:
2
```

---

## Workflow

### Step 1

Validate stock.

### Step 2

Reserve ingredients.

### Step 3

Start production.

### Step 4

Mark production completed.

---

## Inventory Deduction

When production completes:

```text
Butter
1000g

↓

800g
```

Automatically update inventory.

---

## Finished Product Creation

Recipe:

```text
Cheese Cake
```

Servings:

```text
10
```

Creates:

```text
Cheese Cake Slice

Quantity:
10
```

---

# 6. Product Management

Products are what customers purchase.

---

## Product Types

### Whole Product

```text
Whole Cheese Cake
```

Quantity:

```text
1
```

---

### Portion Product

```text
Cheese Cake Slice
```

Quantity:

```text
10
```

Users decide how recipe output is sold.

---

## Product Fields

```typescript
name
recipeId
sellingPrice
availableQuantity
```

---

# 7. Selling Screen

The selling screen is the most frequently used area of the application.

Must be optimized for touch devices.

---

## Product Grid

Example:

```text
Cheese Cake Slice

Available:
10

Price:
8 MVR
```

Large touch-friendly cards.

---

## Quick Sale

User taps a product.

Example:

```text
Cheese Cake Slice

Quantity:
2
```

System calculates:

```text
2 × 8

=
16 MVR
```

Add to cart.

---

## Complete Sale

Creates:

```text
Revenue
```

Reduces:

```text
Finished Product Inventory
```

---

# Product Outcomes

Products can be marked as:

```text
Sold
Gifted
Marketing Sample
Spoiled
Staff Consumption
```

Example:

```text
2 slices gifted
```

Inventory decreases.

Revenue remains zero.

This is important for accurate profit reporting.

---

# 8. Reports

Simple but powerful reporting.

---

## Daily Sales Report

Display:

```text
Revenue
Transactions
Units Sold
```

---

## Profit Report

Formula:

```text
Revenue
-
Cost Of Goods Sold
=
Gross Profit
```

Display:

```text
Revenue

Cost

Profit

Margin %
```

---

## Product Profitability

Example:

```text
Cheese Cake Slice

Cost:
4.30

Selling:
8.00

Profit:
3.70
```

---

## Waste Report

Display:

```text
Produced

Sold

Gifted

Spoiled

Staff Consumption
```

Example:

```text
Produced:
100

Sold:
80

Gifted:
5

Spoiled:
15
```

Waste:

```text
15%
```

---

# 9. Kitchen Tools

A utility section designed specifically for food production businesses.

Accessible from:

```text
More
└── Kitchen Tools
```

---

## Weight Converter

Supports:

```text
Gram
Kilogram
```

Example:

```text
500g

↓

0.5kg
```

---

## Liquid Converter

Supports:

```text
Milliliter
Liter
```

Example:

```text
1000ml

↓

1L
```

---

## Batch Scaling Calculator

Scale recipes based on servings.

Example:

Original Recipe:

```text
Servings:
10
```

Need:

```text
25 servings
```

System calculates:

```text
Scale Factor:
2.5x
```

Output:

```text
Butter

100g
↓

250g

Sugar

200g
↓

500g
```

This helps users quickly increase or decrease recipe quantities.

---

## Future Kitchen Tools

Post-MVP:

```text
Ingredient-Specific Converter

Example:

Butter

1 Cup
=
227g
```

Support:

```text
Flour
Sugar
Brown Sugar
Butter
Milk
Water
Honey
Cocoa Powder
```

This feature should not be used for inventory costing until ingredient conversion data is verified.

---

# Navigation

## Mobile Navigation

```text
Home
Recipes
Produce
Sell
More
```

---

## More Menu

```text
Ingredients
Products
Reports
Kitchen Tools
Settings
```

---

# Suggested Database Models

## ingredients

```typescript
id
name
baseUnit
costPerUnit
availableQuantity
reorderLevel
createdAt
updatedAt
```

---

## ingredient_movements

```typescript
id
ingredientId
type
quantity
notes
createdAt
```

Types:

```text
PURCHASE
PRODUCTION
ADJUSTMENT
```

---

## recipes

```typescript
id
name
description
instructions
preparationTime
servingsProduced
createdAt
updatedAt
```

---

## recipe_ingredients

```typescript
id
recipeId
ingredientId
quantity
unit
```

---

## production_orders

```typescript
id
status
createdAt
completedAt
```

Status:

```text
PLANNED
IN_PROGRESS
COMPLETED
CANCELLED
```

---

## production_items

```typescript
id
productionOrderId
recipeId
batchCount
```

---

## products

```typescript
id
recipeId
name
sellingPrice
availableQuantity
```

---

## product_movements

```typescript
id
productId
type
quantity
createdAt
```

Types:

```text
PRODUCED
SOLD
GIFTED
SPOILED
SAMPLE
STAFF_USE
```

---

## sales

```typescript
id
totalAmount
createdAt
```

---

## sale_items

```typescript
id
saleId
productId
quantity
unitPrice
```

---

# Technology Stack

## Frontend

- Next.js 16
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query

---

## Backend

- Next.js Server Actions
- Prisma ORM

---

## Database

- PostgreSQL

---

## Authentication

- Better Auth

---

## Deployment

- Vercel
- Supabase PostgreSQL

---

# Future Roadmap

## Phase 2

- Customer Database
- Customer Orders
- Pre-orders
- Online Ordering

---

## Phase 3

- WhatsApp Order Management
- QR Product Catalog
- Expense Tracking

---

## Phase 4

- Batch Traceability
- Multi-user Teams
- Production Scheduling

---

## Phase 5

AI Features:

- Recipe Cost Optimization
- Smart Shopping Lists
- Suggested Selling Prices
- Ingredient Shortage Forecasting
- Production Forecasting

---

# MVP Success Criteria

A user should be able to:

1. Add ingredients
2. Maintain ingredient inventory
3. Create recipes
4. Calculate recipe costs
5. Plan daily production
6. Generate shopping lists
7. Produce finished products
8. Sell products
9. Record waste and giveaways
10. View profit reports

Without needing spreadsheets.

If a home baker can operate their business entirely inside Crumb and understand their profitability in less than 10 minutes per day, the MVP is successful.