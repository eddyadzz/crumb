import { describe, expect, it } from 'vitest';
import {
  WEBHOOK_EVENTS,
  isWebhookEvent,
  isValidWebhookUrl,
  generateWebhookSecret,
  hmacSignature,
  signatureHeader,
  SIGNATURE_VERSION,
  verifyWebhookSignature,
  safeCompare,
} from '@/lib/webhooks-core';

describe('webhooks-core: event registry', () => {
  it('freezes the expected event set', () => {
    expect(WEBHOOK_EVENTS).toEqual([
      'order.created',
      'order.confirmed',
      'order.cancelled',
      'production.created',
      'production.completed',
      'sale.completed',
      'inventory.low_stock',
      'subscription.requested',
      'subscription.approved',
      'subscription.rejected',
    ]);
    expect(WEBHOOK_EVENTS).toHaveLength(10);
  });

  it('isWebhookEvent guards membership', () => {
    expect(isWebhookEvent('order.created')).toBe(true);
    expect(isWebhookEvent('order.paid')).toBe(false);
  });
});

describe('webhooks-core: url validation', () => {
  it('accepts https and localhost http', () => {
    expect(isValidWebhookUrl('https://example.com/webhook')).toBe(true);
    expect(isValidWebhookUrl('http://localhost:9000/hooks/crumb')).toBe(true);
    expect(isValidWebhookUrl('http://127.0.0.1:9000/hooks')).toBe(true);
  });

  it('rejects insecure remote and malformed urls', () => {
    expect(isValidWebhookUrl('http://example.com/hook')).toBe(false);
    expect(isValidWebhookUrl('ftp://example.com')).toBe(false);
    expect(isValidWebhookUrl('not-a-url')).toBe(false);
    expect(isValidWebhookUrl('')).toBe(false);
  });
});

describe('webhooks-core: secret + signing', () => {
  it('generates a 64-hex-char secret', () => {
    const s = generateWebhookSecret();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
    expect(s).not.toBe(generateWebhookSecret());
  });

  it('signs timestamp.body deterministically and version-prefixes the header', () => {
    const secret = 's3cret';
    const h = hmacSignature(secret, '1700000000', '{"a":1}');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hmacSignature(secret, '1700000000', '{"a":1}')).toBe(h);
    // Different body -> different signature
    expect(hmacSignature(secret, '1700000000', '{"a":2}')).not.toBe(h);
    // Different secret -> different signature
    expect(hmacSignature('other', '1700000000', '{"a":1}')).not.toBe(h);

    const header = signatureHeader('1700000000', h);
    expect(header).toBe(`${SIGNATURE_VERSION}=${h}`);
  });

  it('safeCompare rejects length mismatch and bad bytes', () => {
    expect(safeCompare('abc', 'abc')).toBe(true);
    expect(safeCompare('abc', 'abd')).toBe(false);
    expect(safeCompare('abc', 'abcd')).toBe(false);
    expect(safeCompare('', '')).toBe(true);
  });
});

describe('webhooks-core: signature verification', () => {
  const secret = 'endpoint-secret';
  const body = '{"event":"order.created","data":{"id":"o1"}}';
  const nowSeconds = 1700000000;

  function makeHeader() {
    const digest = hmacSignature(secret, String(nowSeconds), body);
    return signatureHeader(String(nowSeconds), digest);
  }

  it('verifies a well-formed, fresh request', () => {
    expect(
      verifyWebhookSignature({
        secret,
        signatureHeader: makeHeader(),
        timestamp: String(nowSeconds),
        body,
        nowSeconds,
      })
    ).toBe(true);
  });

  it('rejects tampered body', () => {
    expect(
      verifyWebhookSignature({
        secret,
        signatureHeader: makeHeader(),
        timestamp: String(nowSeconds),
        body: '{"event":"order.created","data":{"id":"o1","amt":999}}',
        nowSeconds,
      })
    ).toBe(false);
  });

  it('rejects the wrong secret', () => {
    expect(
      verifyWebhookSignature({
        secret: 'wrong-secret',
        signatureHeader: makeHeader(),
        timestamp: String(nowSeconds),
        body,
        nowSeconds,
      })
    ).toBe(false);
  });

  it('rejects a replayed (stale) timestamp', () => {
    expect(
      verifyWebhookSignature({
        secret,
        signatureHeader: makeHeader(),
        timestamp: String(nowSeconds),
        body,
        nowSeconds: nowSeconds + 1000, // beyond 300s tolerance
      })
    ).toBe(false);
  });

  it('rejects missing or malformed signature header', () => {
    const header = makeHeader();
    expect(
      verifyWebhookSignature({ secret, signatureHeader: undefined, timestamp: String(nowSeconds), body, nowSeconds })
    ).toBe(false);
    expect(
      verifyWebhookSignature({ secret, signatureHeader: '', timestamp: String(nowSeconds), body, nowSeconds })
    ).toBe(false);
    // unversioned header
    expect(
      verifyWebhookSignature({
        secret,
        signatureHeader: header.slice(SIGNATURE_VERSION.length + 1),
        timestamp: String(nowSeconds),
        body,
        nowSeconds,
      })
    ).toBe(false);
    // non-numeric timestamp
    expect(
      verifyWebhookSignature({ secret, signatureHeader: header, timestamp: 'notatime', body, nowSeconds })
    ).toBe(false);
  });
});