'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  RefreshCcw,
  FileUp,
  Check,
  X,
  Search,
  Carrot,
  AlertTriangle,
  History,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import {
  createIngredient,
  adjustStock,
  getMovementsForIngredient,
  updateIngredientCost,
  bulkImportIngredients,
} from '@/lib/actions/ingredients';
import { INGREDIENT_SAMPLE, parseBulkIngredients } from '@/lib/ingredient-import';

type IngredientVM = {
  id: string;
  name: string;
  baseUnit: string;
  purchaseUnit: string;
  purchaseQuantity: number;
  purchaseCost: number;
  availableQuantity: number;
  reorderLevel: number;
  notes: string | null;
  costPerBaseUnit: number;
  updatedAt: Date;
};

type MovementVM = {
  id: string;
  type: string;
  quantity: number;
  notes: string | null;
  createdAt: Date;
};

export function IngredientsClient({
  ingredients: initial,
}: {
  ingredients: IngredientVM[];
}) {
  const router = useRouter();
  const ingredients = initial;
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [adjustIng, setAdjustIng] = useState<IngredientVM | null>(null);
  const [costIng, setCostIng] = useState<IngredientVM | null>(null);
  const [historyIng, setHistoryIng] = useState<IngredientVM | null>(null);
  const [movements, setMovements] = useState<MovementVM[]>([]);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  const filtered = ingredients.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const openHistory = async (ing: IngredientVM) => {
    setHistoryIng(ing);
    setMovements([]);
    const rows = await getMovementsForIngredient(ing.id);
    setMovements(rows);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Ingredients"
        description="Manage your pantry and track costs"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)} disabled={isPending}>
              <FileUp className="h-4 w-4" />
              <span className="hidden sm:inline">Bulk Import</span>
              <span className="sm:hidden">Import</span>
            </Button>
            <Button className="gap-2" onClick={() => setAddOpen(true)} disabled={isPending}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Ingredient</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
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
            onAdjust={() => setAdjustIng(ing)}
            onCostEdit={() => setCostIng(ing)}
            onHistory={() => openHistory(ing)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm font-semibold">Start by adding your first ingredient</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Ingredients unlock costing, low-stock alerts, and shopping lists.
              Add them one by one, or paste a whole pantry at once.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add an ingredient
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setImportOpen(true)}>
                <FileUp className="h-3.5 w-3.5" />
                Bulk import
              </Button>
            </div>
            {search && (
              <p className="mt-3 text-xs text-muted-foreground">
                Nothing matches “{search}” — try a different name.
              </p>
            )}
          </div>
        )}
      </div>

      <AddIngredientDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => refresh()}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        existingNames={ingredients.map((i) => i.name)}
        onImported={() => refresh()}
      />

      {adjustIng && (
        <AdjustDialog
          ingredient={adjustIng}
          open
          onOpenChange={(v) => !v && setAdjustIng(null)}
          onAdjusted={() => refresh()}
        />
      )}

      {costIng && (
        <CostDialog
          ingredient={costIng}
          open
          onOpenChange={(v) => !v && setCostIng(null)}
          onSaved={() => refresh()}
        />
      )}

      <HistoryDialog
        ingredient={historyIng}
        open={!!historyIng}
        onOpenChange={(v) => !v && setHistoryIng(null)}
        movements={movements}
      />
    </div>
  );
}

function IngredientCard({
  ingredient,
  onAdjust,
  onHistory,
  onCostEdit,
}: {
  ingredient: IngredientVM;
  onAdjust: () => void;
  onHistory: () => void;
  onCostEdit: () => void;
}) {
  const isLow = ingredient.availableQuantity <= ingredient.reorderLevel;

  return (
    <Card className={cn('transition-all hover:shadow-md', isLow && 'border-warning/40')}>
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
                className={cn('h-5 w-5', isLow ? 'text-warning' : 'text-muted-foreground')}
              />
            </div>
            <div>
              <p className="font-medium leading-tight">{ingredient.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatMVR(ingredient.costPerBaseUnit)}/{ingredient.baseUnit}
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
          <Button variant="outline" size="sm" className="flex-1" onClick={onAdjust}>
            Adjust
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={onCostEdit}>
            Cost
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
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [purchaseQuantity, setPurchaseQuantity] = useState('');
  const [purchaseUnit, setPurchaseUnit] = useState('g');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [baseUnit, setBaseUnit] = useState('g');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (!name || !purchaseQuantity || !purchaseCost) {
      setError('Name, quantity and cost are required');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createIngredient({
          name: name.trim(),
          baseUnit,
          purchaseQuantity: parseFloat(purchaseQuantity),
          purchaseUnit,
          purchaseCost: parseFloat(purchaseCost),
          reorderLevel: parseFloat(reorderLevel || '0'),
          notes: notes || undefined,
        });
        setName('');
        setPurchaseQuantity('');
        setPurchaseCost('');
        setReorderLevel('');
        setNotes('');
        onOpenChange(false);
        onCreated();
      } catch {
        setError('Failed to save ingredient');
      }
    });
  };

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
            <Input id="name" placeholder="e.g. Butter" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="purchaseQty">Purchase Quantity</Label>
              <Input
                id="purchaseQty"
                type="number"
                placeholder="1000"
                value={purchaseQuantity}
                onChange={(e) => setPurchaseQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseUnit">Unit</Label>
              <Select value={purchaseUnit} onValueChange={setPurchaseUnit}>
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
            <Input
              id="purchaseCost"
              type="number"
              placeholder="50"
              value={purchaseCost}
              onChange={(e) => setPurchaseCost(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reorderLevel">Reorder Level</Label>
            <Input
              id="reorderLevel"
              type="number"
              placeholder="200"
              value={reorderLevel}
              onChange={(e) => setReorderLevel(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Track In</Label>
            <Select value={baseUnit} onValueChange={setBaseUnit}>
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
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" placeholder="Storage, brand, etc." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? 'Saving...' : 'Save Ingredient'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({
  ingredient,
  open,
  onOpenChange,
  onAdjusted,
}: {
  ingredient: IngredientVM;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdjusted: () => void;
}) {
  const [type, setType] = useState<'add' | 'remove'>('add');
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransition();

  const handleAdjust = () => {
    const quantity = parseFloat(qty);
    if (!quantity || quantity <= 0) return;
    startTransition(async () => {
      await adjustStock({
        ingredientId: ingredient.id,
        type,
        quantity,
        notes: notes || undefined,
      });
      setQty('');
      setNotes('');
      onOpenChange(false);
      onAdjusted();
    });
  };

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
            <Label htmlFor="adjustQty">Quantity ({ingredient.baseUnit})</Label>
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
            <Input
              id="adjustNotes"
              placeholder="Spillage, correction, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={type === 'remove' ? 'destructive' : 'default'}
            onClick={handleAdjust}
            disabled={pending}
          >
            {pending ? 'Saving...' : 'Confirm Adjustment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({
  ingredient,
  open,
  onOpenChange,
  movements,
}: {
  ingredient: IngredientVM | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  movements: MovementVM[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Movement History — {ingredient?.name}</DialogTitle>
          <DialogDescription>All stock changes for this ingredient</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {movements.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No movements recorded yet
            </p>
          )}
          {movements.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      m.type === 'PURCHASE' && 'bg-success/10 text-success',
                      m.type === 'PRODUCTION' && 'bg-primary/10 text-primary',
                      m.type === 'ADJUSTMENT' && 'bg-warning/10 text-warning'
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
                    {ingredient?.baseUnit}
                  </span>
                </div>
                {m.notes && <p className="mt-1 text-xs text-muted-foreground">{m.notes}</p>}
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
  );
}

function CostDialog({
  ingredient,
  open,
  onOpenChange,
  onSaved,
}: {
  ingredient: IngredientVM;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [cost, setCost] = useState(String(ingredient.purchaseCost));
  const [packQty, setPackQty] = useState(String(ingredient.purchaseQuantity));
  const [packUnit, setPackUnit] = useState(ingredient.purchaseUnit);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const parsedCost = parseFloat(cost);
  const parsedQty = parseFloat(packQty);
  const previewPerBase =
    Number.isFinite(parsedCost) && Number.isFinite(parsedQty) && parsedQty > 0
      ? parsedCost / parsedQty
      : null;

  const handleSave = () => {
    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      setError('Enter a valid cost');
      return;
    }
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError('Pack size must be greater than zero');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await updateIngredientCost({
          ingredientId: ingredient.id,
          purchaseCost: parsedCost,
          purchaseQuantity: parsedQty,
          purchaseUnit: packUnit,
        });
        onOpenChange(false);
        onSaved();
      } catch {
        setError('Failed to update cost');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Cost — {ingredient.name}</DialogTitle>
          <DialogDescription>
            Future costing, pricing, and variance use the new cost. Existing
            production records are unchanged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="costPackQty">Pack size</Label>
              <Input
                id="costPackQty"
                type="number"
                step="any"
                min="0"
                value={packQty}
                onChange={(e) => setPackQty(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costPackUnit">Pack unit</Label>
              <Input
                id="costPackUnit"
                value={packUnit}
                onChange={(e) => setPackUnit(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="costValue">Pack cost (MVR)</Label>
            <Input
              id="costValue"
              type="number"
              step="any"
              min="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </div>
          {previewPerBase !== null && (
            <div className="rounded-lg bg-primary/5 p-3 text-center">
              <p className="text-xs text-muted-foreground">New cost per base unit</p>
              <p className="font-display text-lg font-bold text-primary">
                {formatMVR(previewPerBase)}/{ingredient.baseUnit}
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Last updated:{' '}
            {new Date(ingredient.updatedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? 'Saving...' : 'Update Cost'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  existingNames,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingNames: string[];
  onImported: () => void;
}) {
  const [text, setText] = useState('');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseBulkIngredients(text), [text]);
  const valid = parsed.filter((p) => p.valid);
  const invalid = parsed.filter((p) => !p.valid);
  const known = useMemo(() => new Set(existingNames.map((n) => n.toLowerCase())), [existingNames]);

  const handleImport = () => {
    if (valid.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const summary = await bulkImportIngredients(
          valid.map((p) => ({
            name: p.name,
            purchaseQuantity: p.packQuantity,
            purchaseUnit: p.packUnit,
            purchaseCost: p.cost,
            reorderLevel: p.reorderLevel,
            baseUnit: p.storageUnit,
            baseQuantity: p.storageQuantity,
          })),
        );
        setResult(summary);
        setText('');
        onImported();
      } catch {
        setError('Import failed — please try again');
      }
    });
  };

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setResult(null);
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Ingredients</DialogTitle>
          <DialogDescription>
            One ingredient per line: <span className="font-mono text-xs">name, pack size, cost</span>
            {' '}— optional 4th column sets the reorder level. Paste straight from a
            spreadsheet (tab-separated works too). Known ingredients get their cost
            updated; new ones are created.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-4 text-center">
            <p className="font-display text-lg font-bold text-success">
              {result.created} created · {result.updated} updated
            </p>
            <Button variant="outline" onClick={() => close(false)}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="bulk-paste">Ingredient list</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setText(INGREDIENT_SAMPLE)}
                >
                  <FileUp className="h-3.5 w-3.5" />
                  Load sample
                </Button>
              </div>
              <Textarea
                id="bulk-paste"
                className="min-h-[160px] font-mono text-sm"
                placeholder={'Flour, 2kg, 85, 1kg\nSugar, 1kg, 45\nEggs, 30pcs, 55'}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            {parsed.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                      <th className="px-2 py-1.5 text-left font-medium">Name</th>
                      <th className="px-2 py-1.5 text-left font-medium">Pack</th>
                      <th className="px-2 py-1.5 text-left font-medium">Stock unit</th>
                      <th className="px-2 py-1.5 text-right font-medium">Cost</th>
                      <th className="px-2 py-1.5 text-right font-medium">/base</th>
                      <th className="px-2 py-1.5 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((p, i) => (
                      <tr key={i} className={cn('border-b border-border/60 last:border-0', !p.valid && 'bg-destructive/5')}>
                        <td className="px-2 py-1.5 font-medium">{p.name || '—'}</td>
                        <td className="px-2 py-1.5">
                          {p.valid ? `${p.packQuantity} ${p.packUnit}` : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {p.valid ? `${p.storageQuantity} ${p.storageUnit}` : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {p.valid ? formatMVR(p.cost) : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {p.costPerBase !== null ? formatMVR(p.costPerBase) : '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          {!p.valid ? (
                            <span className="flex items-center gap-1 text-destructive">
                              <X className="h-3.5 w-3.5" />
                              {p.error}
                            </span>
                          ) : known.has(p.name.toLowerCase()) ? (
                            <span className="flex items-center gap-1 text-warning">
                              <RefreshCcw className="h-3.5 w-3.5" />
                              Updates cost
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-success">
                              <Check className="h-3.5 w-3.5" />
                              New
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={pending || valid.length === 0}>
                {pending
                  ? 'Importing…'
                  : `Import ${valid.length} ingredient${valid.length === 1 ? '' : 's'}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
