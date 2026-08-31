'use client';

import { useState } from 'react';
import { Plus, Search, Carrot, AlertTriangle, History } from 'lucide-react';
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
  ingredients,
  ingredientMovements,
  ingredientCostPerBaseUnit,
  formatMVR,
  getIngredient,
} from '@/lib/data';
import type { Ingredient, Unit } from '@/lib/types';
import { UNIT_OPTIONS } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function IngredientsPage() {
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = ingredients.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const selected = selectedId ? getIngredient(selectedId) : null;
  const selectedMovements = selectedId
    ? ingredientMovements.filter((m) => m.ingredientId === selectedId)
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Ingredients"
        description="Manage your pantry and track costs"
        action={
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Ingredient</span>
            <span className="sm:hidden">Add</span>
          </Button>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search ingredients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((ing) => (
          <IngredientCard
            key={ing.id}
            ingredient={ing}
            onAdjust={() => {
              setSelectedId(ing.id);
              setAdjustOpen(true);
            }}
            onHistory={() => {
              setSelectedId(ing.id);
              setHistoryOpen(true);
            }}
          />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            No ingredients found
          </p>
        )}
      </div>

      {/* Add dialog */}
      <AddIngredientDialog open={addOpen} onOpenChange={setAddOpen} />

      {/* Adjust dialog */}
      {selected && (
        <AdjustDialog
          ingredient={selected}
          open={adjustOpen}
          onOpenChange={setAdjustOpen}
        />
      )}

      {/* History dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Movement History — {selected?.name}</DialogTitle>
            <DialogDescription>
              All stock changes for this ingredient
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {selectedMovements.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No movements recorded yet
              </p>
            )}
            {selectedMovements.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={cn(
                        m.type === 'purchase' && 'bg-success/10 text-success',
                        m.type === 'production' &&
                          'bg-primary/10 text-primary',
                        m.type === 'adjustment' &&
                          'bg-warning/10 text-warning'
                      )}
                    >
                      {m.type}
                    </Badge>
                    <span
                      className={cn(
                        'text-sm font-bold',
                        m.quantity > 0 ? 'text-success' : 'text-destructive'
                      )}
                    >
                      {m.quantity > 0 ? '+' : ''}
                      {m.quantity}
                      {selected?.baseUnit}
                    </span>
                  </div>
                  {m.notes && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {m.notes}
                    </p>
                  )}
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {new Date(m.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IngredientCard({
  ingredient,
  onAdjust,
  onHistory,
}: {
  ingredient: Ingredient;
  onAdjust: () => void;
  onHistory: () => void;
}) {
  const costPerUnit = ingredientCostPerBaseUnit(ingredient);
  const isLow = ingredient.availableQuantity <= ingredient.reorderLevel;

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-md',
        isLow && 'border-warning/40'
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl',
                isLow ? 'bg-warning/15' : 'bg-muted'
              )}
            >
              <Carrot
                className={cn(
                  'h-5 w-5',
                  isLow ? 'text-warning' : 'text-muted-foreground'
                )}
              />
            </div>
            <div>
              <p className="font-medium leading-tight">{ingredient.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatMVR(costPerUnit)}/{ingredient.baseUnit}
              </p>
            </div>
          </div>
          {isLow && (
            <Badge variant="secondary" className="bg-warning/15 text-warning">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Low
            </Badge>
          )}
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Available</p>
            <p className="font-display text-xl font-bold">
              {ingredient.availableQuantity}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {ingredient.baseUnit}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Reorder at</p>
            <p className="text-sm font-medium text-muted-foreground">
              {ingredient.reorderLevel}
              {ingredient.baseUnit}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onAdjust}
          >
            Adjust
          </Button>
          <Button variant="ghost" size="sm" onClick={onHistory}>
            <History className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddIngredientDialog({
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
          <DialogTitle>Add Ingredient</DialogTitle>
          <DialogDescription>
            Enter the details for your new ingredient
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. Butter" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="purchaseQty">Purchase Quantity</Label>
              <Input id="purchaseQty" type="number" placeholder="1000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseUnit">Unit</Label>
              <Select defaultValue="g">
                <SelectTrigger id="purchaseUnit">
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
          <div className="space-y-2">
            <Label htmlFor="purchaseCost">Purchase Cost (MVR)</Label>
            <Input id="purchaseCost" type="number" placeholder="50" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reorderLevel">Reorder Level</Label>
            <Input id="reorderLevel" type="number" placeholder="200" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" placeholder="Storage, brand, etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)}>Save Ingredient</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({
  ingredient,
  open,
  onOpenChange,
}: {
  ingredient: Ingredient;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [type, setType] = useState<'add' | 'remove'>('add');
  const [qty, setQty] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock — {ingredient.name}</DialogTitle>
          <DialogDescription>
            Current: {ingredient.availableQuantity}
            {ingredient.baseUnit}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={type === 'add' ? 'default' : 'outline'}
              onClick={() => setType('add')}
              className="h-12"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Stock
            </Button>
            <Button
              variant={type === 'remove' ? 'destructive' : 'outline'}
              onClick={() => setType('remove')}
              className="h-12"
            >
              Remove Stock
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjustQty">
              Quantity ({ingredient.baseUnit})
            </Label>
            <Input
              id="adjustQty"
              type="number"
              placeholder="50"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjustNotes">Reason (optional)</Label>
            <Input id="adjustNotes" placeholder="Spillage, correction, etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={type === 'remove' ? 'destructive' : 'default'}
            onClick={() => {
              setQty('');
              onOpenChange(false);
            }}
          >
            Confirm Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
