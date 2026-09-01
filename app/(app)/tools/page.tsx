'use client';

import { useState } from 'react';
import { ArrowRightLeft, Scale, Wand2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { convertToBase, formatMVR, UNIT_OPTIONS } from '@/lib/costing';

export default function KitchenToolsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Kitchen Tools"
        description="Converters and calculators for the kitchen floor"
      />

      <div className="grid gap-6 md:grid-cols-2">
        <UnitConverter />
        <BatchScaler />
      </div>
    </div>
  );
}

function UnitConverter() {
  const [value, setValue] = useState('');
  const [fromUnit, setFromUnit] = useState<string>('kg');
  const [toUnit, setToUnit] = useState<string>('g');

  const amount = parseFloat(value) || 0;
  const converted =
    toUnit === 'g' || toUnit === 'kg'
      ? convertToBase(amount, fromUnit) * (toUnit === 'kg' ? 0.001 : 1)
      : toUnit === 'l' || toUnit === 'ml'
        ? convertToBase(amount, fromUnit) * (toUnit === 'l' ? 0.001 : 1)
        : amount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowRightLeft className="h-5 w-5 text-primary" />
          Unit Converter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Value</Label>
          <Input
            type="number"
            placeholder="250"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 items-end gap-3">
          <div className="space-y-2">
            <Label>From</Label>
            <Select value={fromUnit} onValueChange={setFromUnit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Select value={toUnit} onValueChange={setToUnit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="rounded-xl bg-primary/5 p-4 text-center">
          <p className="text-xs text-muted-foreground">Result</p>
          <p className="font-display text-3xl font-bold text-primary">
            {amount > 0 ? converted.toFixed(3) : '—'}
            <span className="ml-1 text-base font-normal text-muted-foreground">{toUnit}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Batch scaler helper
function BatchScaler() {
  const [servings, setServings] = useState('');
  const [target, setTarget] = useState('');
  const [ingredientQty, setIngredientQty] = useState('');
  const [ingredientUnit, setIngredientUnit] = useState<string>('g');
  const [cost, setCost] = useState('');

  const base = parseFloat(servings) || 0;
  const desired = parseFloat(target) || 0;
  const scale = base > 0 ? desired / base : 0;

  const scaledIngredient = (parseFloat(ingredientQty) || 0) * scale;
  const scaledCost = (parseFloat(cost) || 0) * scale;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-5 w-5 text-primary" />
          Batch Scaler
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Base Servings</Label>
            <Input type="number" placeholder="10" value={servings} onChange={(e) => setServings(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Target Servings</Label>
            <Input type="number" placeholder="30" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
        </div>
        <div className="rounded-xl bg-muted p-3 text-center">
          <p className="text-xs text-muted-foreground">Scale Factor</p>
          <p className="font-display text-2xl font-bold">
            {scale > 0 ? `${scale.toFixed(2)}×` : '—'}
          </p>
        </div>
        <div className="border-t border-border pt-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Wand2 className="h-4 w-4 text-primary" />
            Scale an ingredient
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Ingredient Qty</Label>
              <Input type="number" placeholder="250" value={ingredientQty} onChange={(e) => setIngredientQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={ingredientUnit} onValueChange={setIngredientUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Total Cost (MVR)</Label>
              <Input type="number" placeholder="50" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div>
              <Label className="invisible">Result</Label>
              <div className="flex h-9 items-center rounded-lg bg-primary/5 px-3 text-sm font-semibold text-primary">
                {scale > 0 ? `${scaledIngredient.toFixed(1)}${ingredientUnit}` : '—'}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/5 p-3">
            <span className="text-sm font-medium">Scaled Cost</span>
            <span className="font-display text-lg font-bold text-primary">
              {scale > 0 && cost ? formatMVR(scaledCost) : '—'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
