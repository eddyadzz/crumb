/**
 * Pure API-key material generation & verification — no server/DB/React deps.
 *
 * Format is Stripe-like: `bk_live_<prefixId>.` our random secret.
 *   - `prefix`  short, shown in the UI as the key's identifier (e.g. bk_live_ab12cd)
 *   - `token`   the full key presented with every request; the ONLY value the
 *               caller ever sees, returned exactly once at creation time.
 *   - `keyHash` SHA-256 of the full token; never the raw key. We verify by
 *               deriving the prefix lookup id from the presented token.
 */
import { createHash, randomBytes } from 'node:crypto';

export const KEY_PREFIX = 'bk_live';

/** The small set of scopes v1 supports. More can be added without migration. */
export const API_SCOPES = [
  'orders:read',
  'orders:write',
  'inventory:read',
  'inventory:write',
  'sales:read',
  'sales:write',
  'reports:read',
] as const;

export type ApiScope = (typeof API_SCOPES)[number];
export const isApiScope = (s: string): s is ApiScope => (API_SCOPES as readonly string[]).includes(s);

const PREFIX_ID_LENGTH = 10; // hex chars after `bk_live_`
const SECRET_BYTES = 24; // ~48 hex chars of entropy

/** A freshly minted key: store { prefix, keyHash }, hand back `token` once. */
export interface GeneratedApiKey {
  prefix: string;
  keyHash: string;
  token: string;
}

export function generateApiKey(): GeneratedApiKey {
  const prefixId = randomBytes((PREFIX_ID_LENGTH + 1) / 2).toString('hex').slice(0, PREFIX_ID_LENGTH);
  const secret = randomBytes(SECRET_BYTES).toString('hex');
  const token = `${KEY_PREFIX}_${prefixId}.${secret}`;
  return { prefix: `${KEY_PREFIX}_${prefixId}`, keyHash: sha256(token), token };
}

/** Derive the lookup prefix from a full token, or null when it isn't well-formed. */
export function prefixFromToken(token: string): string | null {
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  return token.slice(0, dot);
}

/** SHA-256 hex digest. */
export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Constant-time-safe comparison of two hex digests. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const buffA = Buffer.from(a, 'hex');
  const buffB = Buffer.from(b, 'hex');
  if (buffA.length !== buffB.length || buffA.length === 0) return false;
  // Use crypto.timingSafeEqual on the buffers (length already validated).
  let diff = 0;
  for (let i = 0; i < buffA.length; i++) diff |= buffA[i] ^ buffB[i];
  return diff === 0;
}

/** True when a presented token matches the stored prefix + hash. */
export function verifyApiKey(token: string, prefix: string, keyHash: string): boolean {
  if (prefixFromToken(token) !== prefix) return false;
  return timingSafeEqualHex(sha256(token), keyHash);
}

/** Redact helper: never leak a secret portion into logs/errors. */
export function redactedKey(token: string): string {
  const prefix = prefixFromToken(token);
  return prefix ? `${prefix}••••` : '••••';
}