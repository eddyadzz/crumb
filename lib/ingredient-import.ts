/**
 * Pure bulk-ingredient parsing for the ingredient import assistant.
 * No server/DB/React imports. One ingredient per line:
 *
 *   Flour, 2kg, 85, 1kg        (name, pack, cost MVR, optional reorder)
 *   Eggs - 30pcs - 55
 *   Butter  500g  60           (tab-separated, e.g. pasted from a spreadsheet)
 *
 * Packs may use any kitchen unit — non-storage units (cup, tbsp, oz, lb…)
 * are normalized into the units Crumb stores (g / kg / ml / l / pcs) using
 * the factors from `lib/costing.ts`.
 */

import { KITCHEN_UNITS, costPerBaseUnit } from '@/lib/costing';

export interface ParsedIngredientLine {
  raw: string;
  name: string;
  /** Pack size exactly as written. */
  packQuantity: number;
  /** Pack unit exactly as written (canonical code). */
  packUnit: string;
  /** Cost for one pack, MVR. */
  cost: number;
  reorderLevel: number;
  /** Pack normalized into a storage unit (g / kg / ml / l / pcs). */
  storageUnit: string;
  storageQuantity: number;
  costPerBase: number | null;
  valid: boolean;
  error?: string;
}

const STORAGE_UNITS = new Set(['g', 'kg', 'ml', 'l', 'pcs']);

/** Pack-unit synonyms → canonical storage unit (kept as-is) or a kitchen
 * unit code that gets converted to its dimension base. */
const PACK_UNIT_SYNONYMS: Record<string, string> = {
  kg: 'kg', kgs: 'kg', kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg',
  g: 'g', gr: 'g', gram: 'g', grams: 'g',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'l', lt: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  pcs: 'pcs', pc: 'pcs', piece: 'pcs', pieces: 'pcs', whole: 'pcs', unit: 'pcs', units: 'pcs',
  cup: 'cup', cups: 'cup',
  tbsp: 'tbsp', tbs: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  fl_oz: 'fl_oz', floz: 'fl_oz', fluidounce: 'fl_oz', fluidounces: 'fl_oz',
  jigger: 'jigger', jiggers: 'jigger',
  gill: 'gill', gills: 'gill',
  pint: 'pint', pts: 'pint', pints: 'pint',
  qt: 'qt', quart: 'qt', quarts: 'qt',
  gal: 'gal', gallon: 'gal', gallons: 'gal',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  pinch: 'pinch', pinches: 'pinch',
  dash: 'dash', dashes: 'dash',
  cl: 'cl', dl: 'dl',
};

function parseBareNumber(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d+([.,]\d+)?$/.test(t)) return null;
  const dec = t.match(/^(\d+)(?:[.,](\d+))?$/);
  return Number(`${dec![1]}.${dec![2] ?? '0'}`);
}

/** Parse a cost cell: a bare number (dot or comma decimal). Letters make it
 * invalid — "1kg" must never parse as cost 1. */
function parseCost(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d+([.,]\d+)?$/.test(t)) return null;
  return parseBareNumber(t);
}

const PACK_RE = /^([\d.,]+)\s*([a-zA-Z]+)$/;

/** Parse a reorder cell: bare number (same unit as the pack) or a pack-style
 * quantity+unit ("1kg"). Returns the level in storage units. */
function parseReorder(raw: string, packUnit: string): { level: number; inStorage: boolean } | null {
  const bare = parseBareNumber(raw);
  if (bare !== null) {
    const normalized = normalizePack(bare, packUnit);
    return normalized ? { level: normalized.quantity, inStorage: true } : null;
  }
  const m = raw.trim().match(PACK_RE);
  if (!m) return null;
  const qty = parseBareNumber(m[1]);
  if (qty === null || qty <= 0) return null;
  const normalized = normalizePack(qty, m[2]);
  return normalized ? { level: normalized.quantity, inStorage: true } : null;
}

function isPackCell(raw: string): boolean {
  return PACK_RE.test(raw.trim());
}

/** Split a line into cells: tabs first (spreadsheet paste), then " - ",
 * then commas. Names may contain separators — the rightmost cells are
 * structurally recognised instead of positionally assumed. */
function splitCells(line: string): { cells: string[]; sep: string } {
  if (line.includes('\t')) return { cells: line.split('\t'), sep: ' ' };
  if (/\s-\s/.test(line)) {
    const parts = line.split(/\s+-\s+/).map((c) => c.trim());
    if (parts.length >= 3) return { cells: parts, sep: ' - ' };
  }
  if (line.includes(',')) return { cells: line.split(','), sep: ', ' };
  return { cells: [line], sep: ' ' };
}

/** Normalize a pack (quantity, unit) into a storage unit. */
export function normalizePack(quantity: number, unit: string): { quantity: number; unit: string } | null {
  const canonical = PACK_UNIT_SYNONYMS[unit.trim().toLowerCase()];
  if (!canonical) return null;
  const def = KITCHEN_UNITS.find((u) => u.unit === canonical);
  if (!def) return null;
  // Always normalize to the smallest base (g / ml / pcs): costPerBaseUnit is
  // per-base-unit everywhere in the app, and availableQuantity is stored in
  // base units.
  const base = def.dimension === 'mass' ? 'g' : def.dimension === 'volume' ? 'ml' : def.dimension === 'count' ? 'pcs' : null;
  if (!base) return null;
  return { quantity: quantity * def.toBase, unit: base };
}

const HEADER_NAMES = new Set(['name', 'ingredient', 'ingredients']);

export function parseBulkIngredients(text: string): ParsedIngredientLine[] {
  const lines = text.split(/\r?\n/);
  const out: ParsedIngredientLine[] = [];

  for (const raw of lines) {
    if (!raw.trim()) continue;
    const { cells, sep } = splitCells(raw.trim());
    const trimmed = cells.map((c) => c.trim());

    if (cells.length < 3) {
      out.push({ raw, name: '', packQuantity: 0, packUnit: '', cost: 0, reorderLevel: 0, storageUnit: '', storageQuantity: 0, costPerBase: null, valid: false, error: 'Need at least: name, pack size, cost' });
      continue;
    }
    if (HEADER_NAMES.has(trimmed[0].toLowerCase())) continue;

    const base: ParsedIngredientLine = { raw, name: '', packQuantity: 0, packUnit: '', cost: 0, reorderLevel: 0, storageUnit: '', storageQuantity: 0, costPerBase: null, valid: false };
    const fail = (error: string) => out.push({ ...base, error });

    const n = trimmed.length;
    const last = trimmed[n - 1];
    const secondLast = trimmed[n - 2];
    const thirdLast = n >= 4 ? trimmed[n - 3] : null;

    // Recognise the trailing structure. Two shapes, disambiguated by cell
    // type (a cell cannot be both a bare number and a pack pattern):
    //   [name..., pack, cost]            — pack at n-2, bare cost at n-1
    //   [name..., pack, cost, reorder]   — pack at n-3, bare cost at n-2
    let name: string;
    let packCell: string;
    let costCell: string;
    let reorderCell: string | null = null;

    const noReorder = isPackCell(secondLast) && parseCost(last) !== null;
    const withReorder =
      n >= 4 &&
      isPackCell(thirdLast ?? '') &&
      parseCost(secondLast) !== null &&
      parseReorder(last, PACK_UNIT_SYNONYMS[(thirdLast ?? '').trim().match(PACK_RE)?.[2]?.toLowerCase() ?? ''] ?? '') !== null;

    if (noReorder) {
      name = trimmed.slice(0, n - 2).join(sep);
      packCell = secondLast;
      costCell = last;
    } else if (withReorder) {
      name = trimmed.slice(0, n - 3).join(sep);
      packCell = thirdLast!;
      costCell = secondLast;
      reorderCell = last;
    } else {
      fail('Could not read pack size and cost — expected: name, pack size, cost');
      continue;
    }

    if (!name) { fail('Missing ingredient name'); continue; }

    const cost = parseCost(costCell);
    if (cost === null || cost <= 0) { fail(`Cost must be a positive number (got "${costCell}")`); continue; }

    const packMatch = packCell.match(PACK_RE);
    if (!packMatch) { fail(`Cannot read pack size "${packCell}"`); continue; }
    const packQuantity = parseBareNumber(packMatch[1]);
    if (packQuantity === null || packQuantity <= 0) { fail(`Cannot read pack size "${packCell}"`); continue; }
    const packUnit = PACK_UNIT_SYNONYMS[packMatch[2].toLowerCase()];
    if (!packUnit) { fail(`Unknown unit "${packMatch[2]}"`); continue; }

    let reorderLevel = 0;
    if (reorderCell !== null) {
      const r = parseReorder(reorderCell, packUnit);
      if (r === null) { fail(`Cannot read reorder level "${reorderCell}"`); continue; }
      reorderLevel = r.level;
    }

    const normalized = normalizePack(packQuantity, packUnit);
    if (!normalized) { fail(`Unknown unit "${packMatch[2]}"`); continue; }

    out.push({
      raw,
      name,
      packQuantity,
      packUnit,
      cost,
      reorderLevel,
      storageUnit: normalized.unit,
      storageQuantity: normalized.quantity,
      costPerBase: costPerBaseUnit({ purchaseQuantity: packQuantity, purchaseUnit: packUnit, purchaseCost: cost }),
      valid: true,
    });
  }

  return out;
}

export const INGREDIENT_SAMPLE = `Flour, 2kg, 85, 1kg
Sugar, 1kg, 45, 500g
Butter, 500g, 60, 125g
Eggs, 30pcs, 55, 6pcs
Cocoa Powder, 250g, 95
Cream Cheese, 250g, 70
Honey, 1cup, 45
Vanilla Extract, 2tbsp, 25
Food Coloring, 1tsp, 15
Chocolate Chips, 8oz, 120
Almond Flour, 2lb, 180
Milk, 1l, 25
Water, 500ml, 5
Vanilla Beans, 5pcs, 90`;