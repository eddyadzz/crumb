'use client';

import { useState } from 'react';
import { Plus, Package, Search, MoreVertical, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  products,
  recipes,
  getRecipe,
  recipeCostPerServing,
  formatMVR,
} from '@/lib/data';
import type { ProductMovementType } from '@/lib/types';
import { cn } from '@/lib/utils';

const movementLabels: Record<ProductMovementType, string> = {
  produced: 'Produced',
  sold: 'Sold',
  gifted: 'Gifted',
  spoiled: 'Spoiled',
  sample: 'Marketing Sample',
  staff: 'Staff Consumption',
};

const movementColors: Record<ProductMovementType, string> = {
  produced: 'bg-success/10 text-success',
  sold: 'bg-primary/10 text-primary',
  gifted: 'bg-accent text-accent-foreground',
  spoiled: 'bg-destructive/10 text-destructive',
  sample: 'bg-chart-5/15 text-chart-5',
  staff: 'bg-muted text-muted-foreground',
};

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<string | null>(null);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Products"
        description="Manage your sellable products and stock"
        action={
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Product</span>
            <span className="sm:hidden">Add</span>
          </Button>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((product) => {
          const recipe = getRecipe(product.recipeId);
          const cost = recipe ? recipeCostPerServing(recipe) : 0;
          const profit = product.sellingPrice - cost;
          const margin = product.sellingPrice > 0 ? (profit / product.sellingPrice) * 100 : 0;

          return (
            <Card key={product.id} className="transition-all hover:shadow-md">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium leading-tight">
                        {product.name}
                      </p>
                      <Badge variant="secondary" className="mt-1">
                        {product.type}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setAdjustProduct(product.id)}>
                        Record Movement
                      </DropdownMenuItem>
                      <DropdownMenuItem>Edit Product</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-xs text-muted-foreground">Available</p>
                    <p className="font-display text-lg font-bold">
                      {product.availableQuantity}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="font-display text-lg font-bold">
                      {formatMVR(product.sellingPrice)}
                    </p>
                  </div>
                </div>

                {recipe && (
                  <div className="border-t border-border pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Cost</span>
                      <span className="font-medium">{formatMVR(cost)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        Profit
                      </span>
                      <span className="font-bold text-success">
                        {formatMVR(profit)} ({margin.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            No products found
          </p>
        )}
      </div>

      {/* Add product dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>
              Link a recipe to a sellable product
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="productName">Product Name</Label>
              <Input id="productName" placeholder="e.g. Cheese Cake Slice" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipeLink">Linked Recipe</Label>
              <Select>
                <SelectTrigger id="recipeLink">
                  <SelectValue placeholder="Select recipe" />
                </SelectTrigger>
                <SelectContent>
                  {recipes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="productType">Type</Label>
                <Select defaultValue="portion">
                  <SelectTrigger id="productType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portion">Portion</SelectItem>
                    <SelectItem value="whole">Whole</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sellingPrice">Selling Price (MVR)</Label>
                <Input id="sellingPrice" type="number" placeholder="8" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setAddOpen(false)}>Save Product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Movement dialog */}
      <MovementDialog
        productId={adjustProduct}
        open={!!adjustProduct}
        onOpenChange={(v) => !v && setAdjustProduct(null)}
      />
    </div>
  );
}

function MovementDialog({
  productId,
  open,
  onOpenChange,
}: {
  productId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const product = products.find((p) => p.id === productId);
  const [type, setType] = useState<ProductMovementType>('gifted');
  const [qty, setQty] = useState('');

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Movement — {product.name}</DialogTitle>
          <DialogDescription>
            Available: {product.availableQuantity} units
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Movement Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(movementLabels) as ProductMovementType[]).map(
                (t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={cn(
                      'rounded-lg border p-3 text-sm font-medium transition-colors',
                      type === t
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {movementLabels[t]}
                  </button>
                )
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="moveQty">Quantity</Label>
            <Input
              id="moveQty"
              type="number"
              placeholder="2"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setQty('');
              onOpenChange(false);
            }}
          >
            Record Movement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
