/**
 * Server-side bearer-token authentication for the public v1 API.
 * Resolves an ApiKey from the presented token, verifies its hash, and enforces
 * plan (apiAccess) + scope. On success it returns the tenant context and the
 * authenticated key. Uses RecordActivity for the first-use audit trail.
 */
import 'server-only';

import { prisma } from '@/lib/prisma';
import { prefixFromToken, sha256, timingSafeEqualHex } from '@/lib/api-keys-core';
import { canAccess } from '@/lib/plans';
import { recordActivity } from '@/lib/activity';

export class ApiAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface AuthedApiKey {
  tenantId: string;
  keyId: string;
}

/**
 * Authenticate an API request by bearer token and scope.
 * Throws ApiAuthError with an HTTP-friendly status on failure.
 */
export async function withApiAuth(
  token: string | null,
  requiredScope: string
): Promise<AuthedApiKey> {
  if (!token) throw new ApiAuthError(401, 'Missing Authorization: Bearer token');

  const prefix = prefixFromToken(token);
  if (!prefix) throw new ApiAuthError(401, 'Invalid API key');

  const key = await prisma.apiKey.findFirst({ where: { prefix } });
  if (!key) throw new ApiAuthError(401, 'Invalid API key');
  if (key.revokedAt) throw new ApiAuthError(401, 'API key revoked');
  if (key.expiresAt && key.expiresAt.getTime() < Date.now()) throw new ApiAuthError(401, 'API key expired');

  if (!timingSafeEqualHex(sha256(token), key.keyHash)) {
    throw new ApiAuthError(401, 'Invalid API key');
  }

  // Entitlement: apiAccess is a Business feature (trials unlock everything).
  const tenant = await prisma.tenant.findUnique({
    where: { id: key.tenantId },
    select: {
      status: true,
      subscription: {
        select: {
          status: true,
          trialEndsAt: true,
          plan: { select: { code: true, name: true, features: true } },
        },
      },
    },
  });
  if (!tenant || tenant.status === 'SUSPENDED') throw new ApiAuthError(401, 'Invalid API key');

  const sub = tenant.subscription;
  const state = { status: sub?.status ?? null, trialEndsAt: sub?.trialEndsAt ?? null };
  if (!canAccess(sub?.plan ?? null, 'apiAccess', state)) {
    throw new ApiAuthError(403, 'API access is not included in your plan');
  }

  if (!key.scopes.includes(requiredScope)) {
    throw new ApiAuthError(403, `Missing required scope: ${requiredScope}`);
  }

  const wasUnused = key.lastUsedAt == null;
  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });

  // Record first use in the timeline (only once, to avoid log spam).
  if (wasUnused) {
    await recordActivity({
      tenantId: key.tenantId,
      type: 'API_KEY_USED',
      title: `API key "${key.name}" used`,
      description: `${prefix} · ${requiredScope}`,
      entityType: 'ApiKey',
      entityId: key.id,
    });
  }

  return { tenantId: key.tenantId, keyId: key.id };
}

/** Scope constant referenced for readability at call sites. */
export const scopeGate = {
  orders: { read: 'orders:read', write: 'orders:write' },
  inventory: { read: 'inventory:read', write: 'inventory:write' },
  sales: { read: 'sales:read', write: 'sales:write' },
  reports: { read: 'reports:read' },
} as const;