'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Clock,
  Users,
  Plus,
  Trash2,
  ChefHat,
  Factory,
  Package,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getRecipe,
  getIngredient,
  recipeIngredientCost,
  recipeTotalIngredientCost,
  recipeTotalCost,
  recipeCostPerServing,
  formatMVR,
  products,
  ingredients,
} from '@/lib/data';
import type { Unit } from '@/lib/types';
import { UNIT_OPTIONS } from '@/lib/types';

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recipe = getRecipe(params.id as string);

  if (!recipe) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center">
        <p className="text-muted-foreground">Recipe not found</p>
        <Button asChild className="mt-4">
          <Link href="/recipes">Back to Recipes</Link>
        </Button>
      </div>
    );
  }

  const ingredientCost = recipeTotalIngredientCost(recipe);
  const totalCost = recipeTotalCost(recipe);
  const perServing = recipeCostPerServing(recipe);
  const linkedProducts = products.filter((p) => p.recipeId === recipe.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="mb-1 gap-1"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </Button>

      <PageHeader
        title={recipe.name}
        description={recipe.description}
        action={
          <Badge
            variant="secondary"
            className={
              recipe.status === 'active' ? 'bg-success/10 text-success' : ''
            }
          >
            {recipe.status}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prep Time</p>
              <p className="font-display text-lg font-bold">
                {recipe.preparationTime}m
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Servings</p>
              <p className="font-display text-lg font-bold">
                {recipe.servingsProduced}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <ChefHat className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ingredients</p>
              <p className="font-display text-lg font-bold">
                {recipe.recipeIngredients.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ingredient Cost</span>
            <span className="font-medium">{formatMVR(ingredientCost)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Packaging</span>
            <span className="font-medium">
              {formatMVR(recipe.packagingCost)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Utility</span>
            <span className="font-medium">{formatMVR(recipe.utilityCost)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Labor</span>
            <span className="font-medium">{formatMVR(recipe.laborCost)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Total Cost</span>
            <span className="font-display text-lg font-bold">
              {formatMVR(totalCost)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Cost Per Serving</span>
            <span className="font-display text-lg font-bold text-primary">
              {formatMVR(perServing)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Ingredients */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Recipe Ingredients</CardTitle>
          <Button variant="outline" size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {recipe.recipeIngredients.map((ri) => {
            const ing = getIngredient(ri.ingredientId);
            if (!ing) return null;
            const cost = recipeIngredientCost(recipe, ing);
            return (
              <div
                key={ri.id}
                className="flex items-center justify-between rounded-xl border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <ChefHat className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{ing.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ri.quantity}
                      {ri.unit}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{formatMVR(cost)}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {recipe.instructions}
          </p>
        </CardContent>
      </Card>

      {/* Linked products */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Linked Products</CardTitle>
          <Button variant="outline" size="sm" className="gap-1" asChild>
            <Link href="/products">
              <Package className="h-4 w-4" />
              Manage
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {linkedProducts.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No products linked yet
            </p>
          )}
          {linkedProducts.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-border p-3"
            >
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.type} · {p.availableQuantity} available
                </p>
              </div>
              <span className="font-display text-sm font-bold">
                {formatMVR(p.sellingPrice)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button asChild className="flex-1 gap-2">
          <Link href="/produce">
            <Factory className="h-4 w-4" />
            Start Production
          </Link>
        </Button>
      </div>
    </div>
  );
}
