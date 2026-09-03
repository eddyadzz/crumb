import { randomBytes } from 'node:crypto';

/**
 * Unguessable public token for a customer order, used on the status page:
 * /status/{token}. Format: `ord_` + 12 hex chars (48 bits of entropy) so
 * sequential ids are never exposed and other customers' orders can't be
 * guessed.
 */
export function newOrderPublicToken(): string {
  return `ord_${randomBytes(6).toString('hex')}`;
}

export function isValidOrderPublicToken(token: string): boolean {
  return /^ord_[0-9a-f]{12}$/.test(token);
}