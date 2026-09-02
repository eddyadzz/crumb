'use server';

import { prisma } from '@/lib/prisma';
import { requireFeature, type TenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/permissions-core';
import { generateApiKey } from '@/lib/api-keys-core';
import { recordActivity } from '@/lib/activity';
import type { UserRole } from '@prisma/client';

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/**
 * Only owners may create/revoke keys. The user-specified rule is that a key
 * can be managed by anyone holding `billing.manage` OR `team.manage`; both are
 * strictly owner-granted in the permission matrix, so the effective check is
 * "owner".
 */
async function requireApiKeyOwner(): Promise<TenantContext> {
  const ctx = await requireFeature('apiAccess');
  if (!hasPermission(ctx.role as UserRole, 'billing.manage') && !hasPermission(ctx.role as UserRole, 'team.manage')) {
    throw new Error('You do not have permission to manage API keys');
  }
  return ctx;
}

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const ctx = await requireFeature('apiAccess');
  const keys = await prisma.apiKey.findMany({
    where: { tenantId: ctx.tenantId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return keys.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    scopes: k.scopes,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));
}

export type CreateApiKeyResult =
  | { ok: true; id: string; prefix: string; token: string }
  | { ok: false; error: string };

export async function createApiKey(input: { name: string; scopes: string[] }): Promise<CreateApiKeyResult> {
  const ctx = await requireApiKeyOwner();

  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Name is required' };
  const scopes = Array.from(new Set(input.scopes.filter(Boolean)));
  if (scopes.length === 0) return { ok: false, error: 'Select at least one scope' };

  const { prefix, keyHash, token } = generateApiKey();
  const record = await prisma.apiKey.create({
    data: {
      tenantId: ctx.tenantId,
      name,
      prefix,
      keyHash,
      scopes,
      createdById: ctx.userId,
    },
  });

  await recordActivity({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    actorName: ctx.name,
    type: 'API_KEY_CREATED',
    title: `Created API key "${name}"`,
    description: `${prefix} · ${scopes.join(', ')}`,
    entityType: 'ApiKey',
    entityId: record.id,
  });

  return { ok: true, id: record.id, prefix, token };
}

export type RevokeApiKeyResult = { ok: true } | { ok: false; error: string };

export async function revokeApiKey(id: string): Promise<RevokeApiKeyResult> {
  const ctx = await requireApiKeyOwner();
  const key = await prisma.apiKey.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!key) return { ok: false, error: 'API key not found' };
  if (key.revokedAt) return { ok: false, error: 'API key already revoked' };

  await prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  await recordActivity({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    actorName: ctx.name,
    type: 'API_KEY_REVOKED',
    title: `Revoked API key "${key.name}"`,
    description: key.prefix,
    entityType: 'ApiKey',
    entityId: key.id,
  });

  return { ok: true };
}