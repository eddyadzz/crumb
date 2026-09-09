'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Package, Search, MoreVertical, TrendingUp, Trash2 } from 'lucide-react';
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
import { formatMVR } from '@/lib/costing';
import { createProduct, deleteProduct, bulkLogProductMovement } from '@/lib/actions/products';
import { cn } from '@/lib/utils';

type ProductVM = {
  id: string;
  name: string;
  type: string;
  availableQuantity: number;
  sellingPrice: number;
  recipeId: string;
  recipeName: string;
  cost: number;
  profit: number;
  margin: number;
};

type RecipeOption = { id: string; name: string; servingsProduced: number };

const movementTypes = [
  { value: 'PRODUCED', label: 'Produced' },
  { value: 'GIFTED', label: 'Gifted' },
  { value: 'SPOILED', label: 'Spoiled' },
  { value: 'SAMPLE', label: 'Sample' },
  { value: 'STAFF', label: 'Staff' },
];

export function ProductsClient({
  products: initial,
  recipes,
}: {
  products: ProductVM[];
  recipes: RecipeOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<ProductVM | null>(null);

  const filtered = initial.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const refresh = () => router.refresh();

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
        {filtered.map((product) => (
          <Card key={product.id} className="transition-all hover:shadow-md">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium leading-tight">{product.name}</p>
                    <Badge variant="secondary" className="mt-1">
                      {product.type === 'WHOLE' ? 'whole' : 'portion'}
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
                    <DropdownMenuItem onClick={() => setAdjustProduct(product)}>
                      Record Movement
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => deleteProduct(product.id).then(refresh)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Product
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-xs text-muted-foreground">Available</p>
                  <p className="font-display text-lg font-bold">{product.availableQuantity}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="font-display text-lg font-bold">{formatMVR(product.sellingPrice)}</p>
                </div>
              </div>

              <div className="border-t border-border pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Cost</span>
                  <span className="font-medium">{formatMVR(product.cost)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    Profit
                  </span>
                  <span className="font-bold text-success">
                    {formatMVR(product.profit)} ({product.margin.toFixed(0)}%)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm font-semibold">Add a product so there is something to sell</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Products link your recipes to a selling price — they are what orders,
              the portal, and sales reports are built on.
            </p>
          </div>
        )}
      </div>

      <AddProductDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        recipes={recipes}
        onSaved={refresh}
      />

      {adjustProduct && (
        <MovementDialog
          product={adjustProduct}
          open
          onOpenChange={(v) => !v && setAdjustProduct(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function AddProductDialog({
  open,
  onOpenChange,
  recipes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipes: RecipeOption[];
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [type, setType] = useState<'WHOLE' | 'PORTION'>('PORTION');
  const [price, setPrice] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (!name || !recipeId || !price) {
      setError('Name, recipe and price are required');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createProduct({
          recipeId,
          name: name.trim(),
          sellingPrice: parseFloat(price),
          type,
        });
        setName('');
        setRecipeId('');
        setPrice('');
        onOpenChange(false);
        onSaved();
      } catch {
        setError('Failed to create product');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
          <DialogDescription>Link a recipe to a sellable product</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="productName">Product Name</Label>
            <Input
              id="productName"
              placeholder="e.g. Cheese Cake Slice"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Linked Recipe</Label>
            <Select value={recipeId} onValueChange={setRecipeId}>
              <SelectTrigger>
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
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'WHOLE' | 'PORTION')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PORTION">Portion</SelectItem>
                  <SelectItem value="WHOLE">Whole</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellingPrice">Selling Price (MVR)</Label>
              <Input
                id="sellingPrice"
                type="number"
                placeholder="8"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? 'Saving...' : 'Save Product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementDialog({
  product,
  open,
  onOpenChange,
  onSaved,
}: {
  product: ProductVM;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState('GIFTED');
  const [qty, setQty] = useState('');
  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    const quantity = parseInt(qty, 10);
    if (!quantity || quantity <= 0) return;
    startTransition(async () => {
      await bulkLogProductMovement({
        productId: product.id,
        type: type as 'PRODUCED' | 'GIFTED' | 'SPOILED' | 'SAMPLE' | 'STAFF',
        quantity,
      });
      setQty('');
      onOpenChange(false);
      onSaved();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Movement — {product.name}</DialogTitle>
          <DialogDescription>Available: {product.availableQuantity} units</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Movement Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {movementTypes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={cn(
                    'rounded-lg border p-3 text-sm font-medium transition-colors',
                    type === t.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  {t.label}
                </button>
              ))}
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
          <Button onClick={handleSave} disabled={pending}>
            {pending ? 'Saving...' : 'Record Movement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
