'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, ChefHat, Clock, Users } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  recipes,
  recipeTotalCost,
  recipeCostPerServing,
  recipeTotalIngredientCost,
  formatMVR,
  getIngredient,
  products,
} from '@/lib/data';

export default function RecipesPage() {
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const filtered = recipes.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Recipes"
        description="Create and manage your product recipes"
        action={
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Recipe</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((recipe) => {
          const ingredientCost = recipeTotalIngredientCost(recipe);
          const totalCost = recipeTotalCost(recipe);
          const perServing = recipeCostPerServing(recipe);
          const product = products.find((p) => p.recipeId === recipe.id);
          const profit = product
            ? product.sellingPrice - perServing
            : 0;
          const margin = product && product.sellingPrice > 0
            ? (profit / product.sellingPrice) * 100
            : 0;

          return (
            <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/30 active:scale-[0.98]">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <ChefHat className="h-5 w-5 text-primary" />
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        recipe.status === 'active'
                          ? 'bg-success/10 text-success'
                          : ''
                      }
                    >
                      {recipe.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-medium leading-tight">{recipe.name}</p>
                    {recipe.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {recipe.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {recipe.preparationTime}m
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {recipe.servingsProduced} servings
                    </span>
                  </div>
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Cost/serving
                      </span>
                      <span className="font-bold">{formatMVR(perServing)}</span>
                    </div>
                    {product && (
                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Profit</span>
                        <span className="font-bold text-success">
                          {formatMVR(profit)} ({margin.toFixed(0)}%)
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            No recipes found
          </p>
        )}
      </div>

      <AddRecipeDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function AddRecipeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Recipe</DialogTitle>
          <DialogDescription>
            Create a new recipe — you can add ingredients next
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipeName">Recipe Name</Label>
            <Input id="recipeName" placeholder="e.g. Chocolate Cake" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipeDesc">Description (optional)</Label>
            <Textarea id="recipeDesc" placeholder="Short description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="prepTime">Prep Time (min)</Label>
              <Input id="prepTime" type="number" placeholder="60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="servings">Servings Produced</Label>
              <Input id="servings" type="number" placeholder="10" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              placeholder="Step by step instructions..."
              className="min-h-[120px]"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="packagingCost">Packaging (MVR)</Label>
              <Input id="packagingCost" type="number" placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="utilityCost">Utility (MVR)</Label>
              <Input id="utilityCost" type="number" placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="laborCost">Labor (MVR)</Label>
              <Input id="laborCost" type="number" placeholder="0" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)}>Create Recipe</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
