'use client';

import { useState } from 'react';
import { ArrowRightLeft, Scale, Thermometer, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import {
  convertKitchenUnits,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  formatMVR,
  INGREDIENT_DENSITIES,
  KITCHEN_UNITS,
  OVEN_SETTINGS,
  volumeToWeight,
  weightToVolume,
} from '@/lib/costing';

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
  const [tab, setTab] = useState<'units' | 'temperature'>('units');
  const [value, setValue] = useState('');
  const [fromUnit, setFromUnit] = useState<string>('kg');
  const [toUnit, setToUnit] = useState<string>('g');
  const [densityCode, setDensityCode] = useState<string>('all_purpose_flour');
  const [tempValue, setTempValue] = useState('');
  const [tempFrom, setTempFrom] = useState<'c' | 'f'>('c');

  const amount = parseFloat(value) || 0;
  const fromDef = KITCHEN_UNITS.find((u) => u.unit === fromUnit);
  const toDef = KITCHEN_UNITS.find((u) => u.unit === toUnit);
  const direct = amount > 0 ? convertKitchenUnits(amount, fromUnit, toUnit) : null;
  const crossDimension = fromDef && toDef && fromDef.dimension !== toDef.dimension;

  // Mass <-> volume via ingredient density
  let bridged: number | null = null;
  if (crossDimension && amount > 0 && fromDef && toDef) {
    if (fromDef.dimension === 'volume' && toDef.dimension === 'mass') {
      const ml = (amount * fromDef.toBase) / 1;
      const g = volumeToWeight(ml, densityCode);
      bridged = g !== null ? g / toDef.toBase : null;
    } else if (fromDef.dimension === 'mass' && toDef.dimension === 'volume') {
      const g = amount * fromDef.toBase;
      const ml = weightToVolume(g, densityCode);
      bridged = ml !== null ? ml / toDef.toBase : null;
    }
  }

  const result = crossDimension ? bridged : direct;
  const needsDensity = crossDimension && bridged !== null;
  const impossible = crossDimension && bridged === null;

  const tempAmount = parseFloat(tempValue) || 0;
  const tempC = tempFrom === 'f' ? fahrenheitToCelsius(tempAmount) : tempAmount;
  const tempF = tempFrom === 'c' ? celsiusToFahrenheit(tempAmount) : tempAmount;

  const unitGroups = [
    { dimension: 'volume', heading: 'Volume' },
    { dimension: 'mass', heading: 'Weight' },
    { dimension: 'count', heading: 'Count' },
    { dimension: 'length', heading: 'Length' },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowRightLeft className="h-5 w-5 text-primary" />
          Kitchen Converter
        </CardTitle>
        <div className="mt-2 flex rounded-lg border border-border p-0.5">
          <button
            type="button"
            onClick={() => setTab('units')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              tab === 'units' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            )}
          >
            Units
          </button>
          <button
            type="button"
            onClick={() => setTab('temperature')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              tab === 'temperature' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            )}
          >
            Temperature
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {tab === 'units' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="250"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>From</Label>
                <Select value={fromUnit} onValueChange={setFromUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {unitGroups.map((g) => (
                      <div key={g.dimension}>
                        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {g.heading}
                        </p>
                        {KITCHEN_UNITS.filter((u) => u.dimension === g.dimension).map((u) => (
                          <SelectItem key={u.unit} value={u.unit}>{u.label}</SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Select value={toUnit} onValueChange={setToUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unitGroups.map((g) => (
                    <div key={g.dimension}>
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.heading}
                      </p>
                      {KITCHEN_UNITS.filter((u) => u.dimension === g.dimension).map((u) => (
                        <SelectItem key={u.unit} value={u.unit}>{u.label}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {crossDimension && (
              <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                <Label>Ingredient (for weight ↔ volume)</Label>
                <Select value={densityCode} onValueChange={setDensityCode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INGREDIENT_DENSITIES.map((d) => (
                      <SelectItem key={d.code} value={d.code}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Weight and volume are linked by density — 1 cup of flour and 1 cup of sugar do
                  not weigh the same. Pick the closest ingredient for an approximate conversion.
                </p>
              </div>
            )}

            {impossible ? (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-center text-sm text-warning">
                Pick an ingredient above to convert between weight and volume.
              </div>
            ) : (
              <div className="rounded-xl bg-primary/5 p-4 text-center">
                <p className="text-xs text-muted-foreground">Result{needsDensity ? ' (approximate)' : ''}</p>
                <p className="font-display text-3xl font-bold text-primary">
                  {result !== null && amount > 0
                    ? result.toLocaleString('en-US', { maximumFractionDigits: 3 })
                    : '—'}
                  <span className="ml-1 text-base font-normal text-muted-foreground">{toUnit}</span>
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Oven temperature</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="180"
                  value={tempValue}
                  onChange={(e) => setTempValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={tempFrom} onValueChange={(v) => setTempFrom(v as 'c' | 'f')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="c">Celsius (°C)</SelectItem>
                    <SelectItem value="f">Fahrenheit (°F)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {tempValue !== '' && (
              <div className="rounded-xl bg-primary/5 p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  {tempFrom === 'c' ? 'In Fahrenheit' : 'In Celsius'}
                </p>
                <p className="flex items-center justify-center gap-1 font-display text-3xl font-bold text-primary">
                  <Thermometer className="h-6 w-6" />
                  {tempFrom === 'c' ? tempF.toFixed(0) : tempC.toFixed(0)}
                  <span className="text-base font-normal text-muted-foreground">°</span>
                </p>
              </div>
            )}
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                    <th className="px-2 py-1.5 text-left font-medium">Description</th>
                    <th className="px-2 py-1.5 text-right font-medium">°F</th>
                    <th className="px-2 py-1.5 text-right font-medium">°C</th>
                    <th className="px-2 py-1.5 text-right font-medium">Gas</th>
                  </tr>
                </thead>
                <tbody>
                  {OVEN_SETTINGS.map((o) => (
                    <tr key={o.label} className="border-b border-border/60 last:border-0">
                      <td className="px-2 py-1.5">{o.label}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{o.f}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{o.c}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{o.gas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
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
                  {KITCHEN_UNITS.map((u) => (
                    <SelectItem key={u.unit} value={u.unit}>{u.label}</SelectItem>
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
