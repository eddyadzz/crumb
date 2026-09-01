'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatMVR } from '@/lib/costing';
import { UNIT_OPTIONS } from '@/lib/costing';
import {
  addRecipeIngredient,
  removeRecipeIngredient,
  updateRecipeCosts,
} from '@/lib/actions/recipes';

type RecipeVM = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  instructions: string;
  preparationTime: number;
  servingsProduced: number;
  packagingCost: number;
  utilityCost: number;
  laborCost: number;
};

type IngredientOption = { id: string; name: string; baseUnit: string };
type RecipeIngredientVM = {
  id: string;
  quantity: number;
  unit: string;
  cost: number;
  ingredient: {
    id: string;
    name: string;
    purchaseQuantity: number;
    purchaseUnit: string;
    purchaseCost: number;
  };
};
type LinkedProductVM = {
  id: string;
  name: string;
  type: string;
  availableQuantity: number;
  sellingPrice: number;
};

export function RecipeDetailClient({
  recipe,
  ingredients,
  recipeIngredients: initialIngredients,
  linkedProducts,
  totals,
}: {
  recipe: RecipeVM;
  ingredients: IngredientOption[];
  recipeIngredients: RecipeIngredientVM[];
  linkedProducts: LinkedProductVM[];
  totals: { ingredientCost: number; totalCost: number; perServing: number };
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-1 gap-1">
        <ChevronLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">{recipe.name}</h1>
          {recipe.description && (
            <p className="mt-1 text-sm text-muted-foreground">{recipe.description}</p>
          )}
        </div>
        <Badge
          variant="secondary"
          className={recipe.status === 'ACTIVE' ? 'bg-success/10 text-success' : ''}
        >
          {recipe.status === 'ACTIVE' ? 'active' : 'draft'}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prep Time</p>
              <p className="font-display text-lg font-bold">{recipe.preparationTime}m</p>
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
              <p className="font-display text-lg font-bold">{recipe.servingsProduced}</p>
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
              <p className="font-display text-lg font-bold">{initialIngredients.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Cost Breakdown</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setCostOpen(true)}>
            Edit Costs
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ingredient Cost</span>
            <span className="font-medium">{formatMVR(totals.ingredientCost)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Packaging</span>
            <span className="font-medium">{formatMVR(recipe.packagingCost)}</span>
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
            <span className="font-display text-lg font-bold">{formatMVR(totals.totalCost)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Cost Per Serving</span>
            <span className="font-display text-lg font-bold text-primary">
              {formatMVR(totals.perServing)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Recipe Ingredients</CardTitle>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {initialIngredients.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No ingredients yet — add your first one
            </p>
          )}
          {initialIngredients.map((ri) => (
            <IngredientRow
              key={ri.id}
              item={ri}
              onRemove={() => removeRecipeIngredient(ri.id).then(() => router.refresh())}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {recipe.instructions || 'No instructions added yet.'}
          </p>
        </CardContent>
      </Card>

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
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.type === 'WHOLE' ? 'whole' : 'portion'} · {p.availableQuantity} available
                </p>
              </div>
              <span className="font-display text-sm font-bold">{formatMVR(p.sellingPrice)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button asChild className="flex-1 gap-2">
          <Link href="/produce">
            <Factory className="h-4 w-4" />
            Start Production
          </Link>
        </Button>
      </div>

      <AddIngredientDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        recipeId={recipe.id}
        ingredients={ingredients}
        onSaved={() => router.refresh()}
      />
      <EditCostsDialog
        open={costOpen}
        onOpenChange={setCostOpen}
        recipeId={recipe.id}
        current={{ packaging: recipe.packagingCost, utility: recipe.utilityCost, labor: recipe.laborCost }}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function IngredientRow({
  item,
  onRemove,
}: {
  item: RecipeIngredientVM;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <ChefHat className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">{item.ingredient.name}</p>
          <p className="text-xs text-muted-foreground">
            {item.quantity}
            {item.unit}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold">{formatMVR(item.cost)}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

function AddIngredientDialog({
  open,
  onOpenChange,
  recipeId,
  ingredients,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipeId: string;
  ingredients: IngredientOption[];
  onSaved: () => void;
}) {
  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('g');
  const [pending, startTransition] = useTransition();

  const selected = ingredients.find((i) => i.id === ingredientId);

  const handleSave = () => {
    if (!ingredientId || !quantity || parseFloat(quantity) <= 0) return;
    startTransition(async () => {
      await addRecipeIngredient({
        recipeId,
        ingredientId,
        quantity: parseFloat(quantity),
        unit,
      });
      setIngredientId('');
      setQuantity('');
      setUnit('g');
      onOpenChange(false);
      onSaved();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Ingredient</DialogTitle>
          <DialogDescription>Add an ingredient to this recipe</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Ingredient</Label>
            <Select value={ingredientId} onValueChange={(v) => { setIngredientId(v); setUnit(ingredients.find((i) => i.id === v)?.baseUnit || 'g'); }}>
              <SelectTrigger>
                <SelectValue placeholder="Choose ingredient" />
              </SelectTrigger>
              <SelectContent>
                {ingredients.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                placeholder="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {selected && (
            <p className="text-xs text-muted-foreground">
              Base unit: {selected.baseUnit}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? 'Adding...' : 'Add Ingredient'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditCostsDialog({
  open,
  onOpenChange,
  recipeId,
  current,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipeId: string;
  current: { packaging: number; utility: number; labor: number };
  onSaved: () => void;
}) {
  const [packaging, setPackaging] = useState(String(current.packaging));
  const [utility, setUtility] = useState(String(current.utility));
  const [labor, setLabor] = useState(String(current.labor));
  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await updateRecipeCosts({
        recipeId,
        packagingCost: parseFloat(packaging || '0'),
        utilityCost: parseFloat(utility || '0'),
        laborCost: parseFloat(labor || '0'),
      });
      onOpenChange(false);
      onSaved();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Recipe Costs</DialogTitle>
          <DialogDescription>Adjust overhead costs for this recipe</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Packaging (MVR)</Label>
            <Input type="number" value={packaging} onChange={(e) => setPackaging(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Utility (MVR)</Label>
            <Input type="number" value={utility} onChange={(e) => setUtility(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Labor (MVR)</Label>
            <Input type="number" value={labor} onChange={(e) => setLabor(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? 'Saving...' : 'Save Costs'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
