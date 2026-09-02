import { describe, expect, it } from 'vitest';
import {
  generateApiKey,
  prefixFromToken,
  redactedKey,
  sha256,
  timingSafeEqualHex,
  verifyApiKey,
  isApiScope,
} from '@/lib/api-keys-core';

describe('api-keys-core', () => {
  it('mints a well-formed, high-entropy key', () => {
    const { prefix, token, keyHash } = generateApiKey();
    expect(token).toContain('.');
    expect(prefixFromToken(token)).toBe(prefix);
    expect(token.startsWith(`${prefix}.`)).toBe(true);
    expect(token.length).toBeGreaterThan(40);
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    expect(keyHash).not.toContain(token); // never stores raw key
    expect(prefix).toMatch(/^bk_live_[0-9a-f]{10}$/);
  });

  it('prefixFromToken handles malformed input', () => {
    expect(prefixFromToken('nodot')).toBeNull();
    expect(prefixFromToken('.onlysecret')).toBeNull();
    expect(prefixFromToken('')).toBeNull();
  });

  it('verifies a correct token and rejects wrong / tampered ones', () => {
    const { prefix, keyHash, token } = generateApiKey();
    expect(verifyApiKey(token, prefix, keyHash)).toBe(true);
    expect(verifyApiKey(token + 'x', prefix, keyHash)).toBe(false); // tampered secret
    expect(verifyApiKey('other', prefix, keyHash)).toBe(false); // wrong prefix
    const other = generateApiKey();
    expect(verifyApiKey(other.token, prefix, keyHash)).toBe(false);
  });

  it('sha256 is deterministic and length-stable', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(sha256('abc')).toHaveLength(64);
    expect(sha256('abc')).not.toBe(sha256('abd'));
  });

  it('timingSafeEqualHex compares securely', () => {
    expect(timingSafeEqualHex('ab', 'ab')).toBe(true);
    expect(timingSafeEqualHex('ab', 'ac')).toBe(false);
    expect(timingSafeEqualHex('abc', 'abcd')).toBe(false);
    expect(timingSafeEqualHex('', '')).toBe(false);
  });

  it('redacts the secret portion of a token', () => {
    const { token } = generateApiKey();
    const redacted = redactedKey(token);
    expect(redacted).toContain('bk_live');
    expect(redacted).toContain('••••');
    expect(redacted).not.toContain(token.slice(token.indexOf('.') + 1));
  });

  it('key scope validator recognises valid scopes', () => {
    expect(isApiScope('orders:read')).toBe(true);
    expect(isApiScope('orders:write')).toBe(true);
    expect(isApiScope('inventory:read')).toBe(true);
    expect(isApiScope('inventory:write')).toBe(true);
    expect(isApiScope('sales:read')).toBe(true);
    expect(isApiScope('sales:write')).toBe(true);
    expect(isApiScope('reports:read')).toBe(true);
    expect(isApiScope('admin:*')).toBe(false);
    expect(isApiScope('')).toBe(false);
  });
});