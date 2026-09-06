/**
 * Pure recipe-text parsing for the Recipe Import Assistant (J-8).
 * No server/DB/React imports — unit-testable and shared by the paste preview
 * and the save action.
 *
 * Supported ingredient line shapes (both quantity-first and name-first):
 *   500g flour            Flour - 500g
 *   500 g flour           Flour: 500g
 *   2 eggs                Flour 500g
 *   4 pcs eggs            2 cups sugar  (cups/tbsp/tsp convert to ml)
 *   1 1/2 cups sugar      Salt to taste (qty 1, pcs)
 *   0,5 l milk            a pinch of salt (qty 1, pcs)
 * Yield lines: "Yield: 12 slices", "Makes 12", "Serves 10", "12 servings".
 */

export interface ParsedIngredientLine {
  raw: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface ParsedRecipe {
  name: string | null;
  yieldCount: number | null;
  ingredients: ParsedIngredientLine[];
  instructions: string;
}

/** Unit tokens Crumb accepts → target unit + multiplier applied to the amount. */
const UNIT_MAP: Record<string, { unit: string; factor: number }> = {
  g: { unit: 'g', factor: 1 },
  gram: { unit: 'g', factor: 1 },
  grams: { unit: 'g', factor: 1 },
  gr: { unit: 'g', factor: 1 },
  kg: { unit: 'kg', factor: 1 },
  kgs: { unit: 'kg', factor: 1 },
  kilogram: { unit: 'kg', factor: 1 },
  kilograms: { unit: 'kg', factor: 1 },
  ml: { unit: 'ml', factor: 1 },
  milliliter: { unit: 'ml', factor: 1 },
  milliliters: { unit: 'ml', factor: 1 },
  millilitre: { unit: 'ml', factor: 1 },
  millilitres: { unit: 'ml', factor: 1 },
  l: { unit: 'l', factor: 1 },
  lt: { unit: 'l', factor: 1 },
  liter: { unit: 'l', factor: 1 },
  liters: { unit: 'l', factor: 1 },
  litre: { unit: 'l', factor: 1 },
  litres: { unit: 'l', factor: 1 },
  pcs: { unit: 'pcs', factor: 1 },
  pc: { unit: 'pcs', factor: 1 },
  piece: { unit: 'pcs', factor: 1 },
  pieces: { unit: 'pcs', factor: 1 },
  whole: { unit: 'pcs', factor: 1 },
  unit: { unit: 'pcs', factor: 1 },
  units: { unit: 'pcs', factor: 1 },
  // Kitchen volume → millilitres so the amount stays usable in costing.
  cup: { unit: 'ml', factor: 240 },
  cups: { unit: 'ml', factor: 240 },
  tbsp: { unit: 'ml', factor: 15 },
  tbs: { unit: 'ml', factor: 15 },
  tablespoon: { unit: 'ml', factor: 15 },
  tablespoons: { unit: 'ml', factor: 15 },
  tsp: { unit: 'ml', factor: 5 },
  teaspoon: { unit: 'ml', factor: 5 },
  teaspoons: { unit: 'ml', factor: 5 },
  fl_oz: { unit: 'ml', factor: 30 },
  floz: { unit: 'ml', factor: 30 },
  fluidounce: { unit: 'ml', factor: 30 },
  fluidounces: { unit: 'ml', factor: 30 },
  jigger: { unit: 'ml', factor: 45 },
  jiggers: { unit: 'ml', factor: 45 },
  gill: { unit: 'ml', factor: 120 },
  gills: { unit: 'ml', factor: 120 },
  pint: { unit: 'ml', factor: 480 },
  pts: { unit: 'ml', factor: 480 },
  pints: { unit: 'ml', factor: 480 },
  qt: { unit: 'ml', factor: 960 },
  quart: { unit: 'ml', factor: 960 },
  quarts: { unit: 'ml', factor: 960 },
  gal: { unit: 'ml', factor: 3840 },
  gallon: { unit: 'ml', factor: 3840 },
  gallons: { unit: 'ml', factor: 3840 },
  pinch: { unit: 'ml', factor: 0.625 },
  pinches: { unit: 'ml', factor: 0.625 },
  dash: { unit: 'ml', factor: 0.3125 },
  dashes: { unit: 'ml', factor: 0.3125 },
  cl: { unit: 'ml', factor: 10 },
  dl: { unit: 'ml', factor: 100 },
  // US weight → grams.
  oz: { unit: 'g', factor: 28.35 },
  ounce: { unit: 'g', factor: 28.35 },
  ounces: { unit: 'g', factor: 28.35 },
  lb: { unit: 'g', factor: 453.6 },
  lbs: { unit: 'g', factor: 453.6 },
  pound: { unit: 'g', factor: 453.6 },
  pounds: { unit: 'g', factor: 453.6 },
};

const HEADER_WORDS = new Set([
  'ingredients',
  'ingredient',
  'instructions',
  'directions',
  'method',
  'steps',
  'preparation',
]);

const YIELD_RE =
  /^(?:yield|yields|makes|make|serves|serve|servings)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i;
const SERVINGS_RE = /^(\d+(?:[.,]\d+)?)\s+(?:servings?|portions?)\b/i;

const AMOUNT_RE =
  String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|a|an)`;
const UNIT_TOKEN_RE = String.raw`(?:kg|kgs|kilograms?|milliliters?|millilitres?|cl|dl|ml|l|lt|liters?|litres?|g|gr|grams?|pcs?|pieces?|whole|units?|cups?|tbsps?|tbs|tablespoons?|tsp|teaspoons?|fl_?oz|fluidounces?|jiggers?|gills?|pts?|pints?|qts?|quarts?|gals?|gallons?|pinch(?:es)?|dash(?:es)?|oz|ounces?|lbs?|pounds?)`;

function cleanLine(line: string): string {
  return line
    .replace(/^[\s\-*•·–—]+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAmount(token: string): number | null {
  const t = token.trim().toLowerCase();
  if (t === 'a' || t === 'an') return 1;
  // Mixed number "1 1/2"
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  // Simple fraction "1/2"
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  // Decimal with comma "0,5"
  const dec = t.match(/^(\d+)(?:[.,](\d+))?$/);
  if (dec) return Number(`${dec[1]}.${dec[2] ?? '0'}`);
  return null;
}

function resolveUnit(token: string | undefined): { unit: string; factor: number } | null {
  if (!token) return null;
  return UNIT_MAP[token.toLowerCase().replace(/[.\s]/g, '')] ?? null;
}

/** "500g", "2", "1 1/2 cups" → amount, unit, rest-of-line. */
function matchQuantity(
  segment: string
): { quantity: number; unit: string; rest: string } | null {
  const re = new RegExp(
    `^(${AMOUNT_RE})\\s*(${UNIT_TOKEN_RE})?\\b[.\\s]*\\s*(?:(?:of\\s+)?)(.*)$`,
    'i'
  );
  const m = segment.match(re);
  if (!m) return null;
  const amount = parseAmount(m[1]);
  if (amount === null || amount <= 0) return null;
  const unitInfo = resolveUnit(m[2]);
  const rest = m[3].trim();
  if (!rest) return null;
  return {
    quantity: amount * (unitInfo?.factor ?? 1),
    unit: unitInfo?.unit ?? 'pcs',
    rest,
  };
}

/** Name-first forms: "Flour - 500g", "Flour: 500g", "Flour 500g". */
function matchQuantityTrailing(
  segment: string
): { quantity: number; unit: string; rest: string } | null {
  // Explicit separator: name -/–/—/: amount unit
  const sep = segment.match(
    new RegExp(`^(.+?)\\s*[-–—:]\\s*(${AMOUNT_RE})\\s*(${UNIT_TOKEN_RE})?\\b[.\\s]*$`, 'i')
  );
  if (sep) {
    const amount = parseAmount(sep[2]);
    if (amount === null || amount <= 0) return null;
    const unitInfo = resolveUnit(sep[3]);
    const rest = sep[1].trim();
    if (!rest) return null;
    return {
      quantity: amount * (unitInfo?.factor ?? 1),
      unit: unitInfo?.unit ?? 'pcs',
      rest,
    };
  }
  // Trailing quantity: "Flour 500g"
  const trail = segment.match(
    new RegExp(`^(.+?)\\s+(${AMOUNT_RE})\\s*(${UNIT_TOKEN_RE})?\\b[.\\s]*$`, 'i')
  );
  if (trail) {
    const amount = parseAmount(trail[2]);
    if (amount === null || amount <= 0) return null;
    const unitInfo = resolveUnit(trail[3]);
    const rest = trail[1].replace(/[.,;]$/, '').trim();
    if (!rest || /^\d/.test(rest)) return null;
    return {
      quantity: amount * (unitInfo?.factor ?? 1),
      unit: unitInfo?.unit ?? 'pcs',
      rest,
    };
  }
  return null;
}

function parseIngredientLine(line: string): ParsedIngredientLine | null {
  // Quantity-first
  const leading = matchQuantity(line);
  if (leading) {
    return {
      raw: line,
      name: leading.rest.replace(/[.,;]$/, '').trim(),
      quantity: leading.quantity,
      unit: leading.unit,
    };
  }
  // Name-first
  const trailing = matchQuantityTrailing(line);
  if (trailing) {
    return {
      raw: line,
      name: trailing.rest.replace(/[.,;]$/, '').trim(),
      quantity: trailing.quantity,
      unit: trailing.unit,
    };
  }
  // "to taste" / unquantified: qty 1 pcs
  if (/\bto taste\b/i.test(line) && line.trim().length > 0) {
    return {
      raw: line,
      name: line.replace(/\b\(?\s*to taste\s*\)?\b/i, '').replace(/[.,;]$/, '').trim(),
      quantity: 1,
      unit: 'pcs',
    };
  }
  return null;
}

/** Parse pasted recipe text into a review-ready structure. Pure. */
export function parseRecipeText(text: string): ParsedRecipe {
  const lines = text.split(/\r?\n/);
  const ingredients: ParsedIngredientLine[] = [];
  const prose: string[] = [];
  let name: string | null = null;
  let yieldCount: number | null = null;
  let seenIngredient = false;
  let pendingProse: string | null = null;

  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line) continue;

    // Yield lines
    const yieldMatch = line.match(YIELD_RE) ?? line.match(SERVINGS_RE);
    if (yieldMatch) {
      const v = parseAmount(yieldMatch[1]);
      if (v !== null && yieldCount === null) yieldCount = v;
      continue;
    }

    // Section headers are skipped (their sub-section names become prose)
    if (HEADER_WORDS.has(line.toLowerCase().replace(/[:]$/, ''))) continue;

    const ingredient = parseIngredientLine(line);
    if (ingredient) {
      // A prose line held before the first ingredient is the recipe title.
      if (!seenIngredient && name === null && pendingProse !== null) name = pendingProse;
      pendingProse = null;
      seenIngredient = true;
      ingredients.push(ingredient);
      continue;
    }

    // Sub-section headers like "For the frosting:" carry into instructions
    if (/^for (?:the )?/i.test(line) || seenIngredient) {
      prose.push(line);
      continue;
    }

    // First prose line before any ingredient is the title only when
    // more prose follows it
    if (pendingProse === null) {
      pendingProse = line;
      continue;
    }
    if (prose.length === 0 && name === null) name = pendingProse;
    prose.push(pendingProse);
    pendingProse = line;
  }

  if (pendingProse !== null) prose.push(pendingProse);

  return {
    name,
    yieldCount,
    ingredients,
    instructions: prose.join('\n'),
  };
}

export interface MatchableIngredient {
  id: string;
  name: string;
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Find the tenant ingredient matching a pasted name: exact → singular/plural
 * → containment (both ways, min 4 chars). Pure. */
export function matchIngredientName(
  name: string,
  ingredients: MatchableIngredient[]
): MatchableIngredient | null {
  const target = normalized(name);
  if (!target) return null;

  let candidate = ingredients.find((i) => normalized(i.name) === target);
  if (candidate) return candidate;

  const singular = target.replace(/(ies)$/, 'y').replace(/(ses|xes|zes|ches|shes|es)$/, (m, _, off) =>
    off > 0 ? '' : m
  ).replace(/s$/, '');
  const plural = `${target}s`;
  candidate =
    ingredients.find((i) => normalized(i.name) === singular) ??
    ingredients.find((i) => normalized(i.name) === plural);
  if (candidate) return candidate;

  candidate = ingredients.find((i) => {
    const n = normalized(i.name);
    return (
      n.length >= 4 &&
      target.length >= 4 &&
      (n.includes(target) || target.includes(n))
    );
  });
  return candidate ?? null;
}
