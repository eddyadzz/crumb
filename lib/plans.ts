/** Pure plan catalog & capability checks. No server/DB/React dependencies, so
 * this is unit-testable and safe for both server actions and client rendering.
 *
 * Feature gates are the seam Stripe (or any future billing provider) will push
 * through: plans carry their features in the `features` JSON column, and the
 * subscription's status/trial decide whether they apply. Trials get full
 * access until they expire.
 */

export const FEATURE_KEYS = [
  'multiUser',
  'customerManagement',
  'orders',
  'productCatalog',
  'expenseTracking',
  'analytics',
  'suppliers',
  'activityLogs',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Human-readable labels for the feature matrix (settings + admin UIs). */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  multiUser: 'Multi User',
  customerManagement: 'Customer Database',
  orders: 'Orders',
  productCatalog: 'Product Catalog',
  expenseTracking: 'Expense Tracking',
  analytics: 'Profit Reports',
  suppliers: 'Supplier Directory',
  activityLogs: 'Activity Logs',
};

export type PlanFeatures = Partial<Record<FeatureKey, boolean>>;

/** Defaults per built-in plan code. Any plan row can override via `features`. */
export const PLAN_FEATURES: Record<string, PlanFeatures> = {
  free: {},
  pro: {
    customerManagement: true,
    orders: true,
    productCatalog: true,
    expenseTracking: true,
    analytics: true,
  },
  business: {
    multiUser: true,
    customerManagement: true,
    orders: true,
    productCatalog: true,
    expenseTracking: true,
    analytics: true,
    suppliers: true,
    activityLogs: true,
  },
};

/** Anything that looks enough like a Plan to resolve feature access from. */
export type FeaturePlanLike = {
  code?: string | null;
  name?: string | null;
  features?: unknown;
};

function toFeatures(input: unknown): PlanFeatures {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: PlanFeatures = {};
  for (const key of FEATURE_KEYS) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === 'boolean') out[key] = value;
  }
  return out;
}

/** Effective feature set for a plan: built-in defaults merged with any DB
 * overrides, normalised so every feature key is an explicit boolean. */
export function resolvePlanFeatures(plan: FeaturePlanLike | null | undefined): PlanFeatures {
  if (!plan) return { ...emptyFeatures() };
  const base = PLAN_FEATURES[plan.code?.toLowerCase() ?? ''] ?? {};
  return { ...emptyFeatures(), ...base, ...toFeatures(plan.features) };
}

function emptyFeatures(): PlanFeatures {
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, false])) as PlanFeatures;
}

export function planDisplayName(plan: FeaturePlanLike | null | undefined): string {
  if (plan?.name) return plan.name;
  const code = plan?.code?.toLowerCase() ?? '';
  return { free: 'Free', pro: 'Pro', business: 'Business' }[code] ?? 'Free';
}

export function hasPlanFeature(plan: FeaturePlanLike | null | undefined, feature: FeatureKey): boolean {
  return resolvePlanFeatures(plan)[feature] === true;
}

export type AccessState = {
  status?: string | null;
  trialEndsAt?: Date | string | null;
  now?: Date;
};

/** A live trial (status TRIAL, not yet expired) unlocks every feature. */
export function trialGrantsFullAccess({
  status,
  trialEndsAt,
  now,
}: AccessState): boolean {
  if (status !== 'TRIAL') return false;
  if (trialEndsAt == null) return true;
  const end = typeof trialEndsAt === 'string' ? new Date(trialEndsAt) : trialEndsAt;
  return end.getTime() > (now ?? new Date()).getTime();
}

/**
 * True when the current subscription may use `feature`.
 * - Live trial: yes (full access)
 * - ACTIVE: decide by the plan's feature set
 * - Anything else (PAST_DUE / SUSPENDED / CANCELLED / expired trial): no
 */
export function canAccess(
  plan: FeaturePlanLike | null | undefined,
  feature: FeatureKey,
  state: AccessState = {}
): boolean {
  if (trialGrantsFullAccess(state)) return true;
  if (state.status !== 'ACTIVE') return false;
  return hasPlanFeature(plan, feature);
}

export function isFreePlanCode(code?: string | null): boolean {
  return (code ?? '').toLowerCase() === 'free';
}