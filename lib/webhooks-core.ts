/**
 * Pure webhook event registry + signing — no server/DB/React deps, so it is
 * unit-testable and safe for both the delivery pipeline and client rendering.
 *
 * Signing follows Stripe-style convention:
 *   X-BoliFlow-Event     : the event name (e.g. order.created)
 *   X-BoliFlow-Timestamp : unix seconds at send time
 *   X-BoliFlow-Signature : v1=<HMAC-SHA256(`${timestamp}.${rawBody}`, secret)>
 *
 * The timestamp is part of the signed material, which defeats replay attacks
 * (a consumer can reject signatures older than their tolerance window).
 */
import { createHmac, randomBytes } from 'node:crypto';

/** The frozen event registry. Add new events only by extending this list. */
export const WEBHOOK_EVENTS = [
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
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const isWebhookEvent = (e: string): e is WebhookEvent =>
  (WEBHOOK_EVENTS as readonly string[]).includes(e);

/** Human labels for the webhook event subscriptions UI. */
export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  'order.created': 'Order created',
  'order.confirmed': 'Order confirmed',
  'order.cancelled': 'Order cancelled',
  'production.created': 'Production started',
  'production.completed': 'Production completed',
  'sale.completed': 'Sale completed',
  'inventory.low_stock': 'Low stock alert',
  'subscription.requested': 'Upgrade requested',
  'subscription.approved': 'Upgrade approved',
  'subscription.rejected': 'Upgrade rejected',
};

/** Validate a webhook destination URL is HTTPS (or localhost for dev). */
export function isValidWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'));
  } catch {
    return false;
  }
}

export const SIGNATURE_VERSION = 'v1';

/** Compute the HMAC-SHA256 signature over `${timestamp}.${body}` with `secret`. */
export function hmacSignature(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
}

/** Format a signature header value: `v1=<hex>`. */
export function signatureHeader(timestamp: string, digest: string): string {
  return `${SIGNATURE_VERSION}=${digest}`;
}

/**
 * Verify an incoming signature header against the endpoint secret and the raw
 * body. Returns true when the signature is well-formed and matches.
 */
export function verifyWebhookSignature(opts: {
  secret: string;
  signatureHeader?: string | null;
  timestamp?: string | null;
  body: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): boolean {
  const header = opts.signatureHeader;
  if (!header) return false;
  // Only accept the versioned prefix we emit.
  if (!header.startsWith(`${SIGNATURE_VERSION}=`)) return false;
  const provided = header.slice(`${SIGNATURE_VERSION}=`.length);
  if (!opts.timestamp) return false;

  // Replay protection: reject timestamps outside the tolerance window.
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = opts.toleranceSeconds ?? 300;
  const ts = Number(opts.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > tolerance) return false;

  const expected = hmacSignature(opts.secret, opts.timestamp, opts.body);
  return safeCompare(provided, expected);
}

/** Constant-time compare of two hex strings. */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Generate a random endpoint secret (hex). */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}