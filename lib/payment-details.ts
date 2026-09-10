/**
 * Structured payee details for payment methods: platform admins edit labeled
 * fields per method type; the serialized text is shown to bakers when they
 * pick a payment method on the plan-request form. Plain text in/out of
 * `PaymentMethod.details` — no schema change. Pure.
 */

export interface PaymentDetailField {
  key: string;
  label: string;
}

/** Field schema per method code (codes come from the seeded methods). */
export function paymentFieldsFor(code: string): PaymentDetailField[] {
  const c = (code ?? '').trim().toUpperCase();
  if (c === 'BANK_TRANSFER') return [
    { key: 'bank', label: 'Bank' },
    { key: 'account_name', label: 'Account Name' },
    { key: 'account_number', label: 'Account Number' },
  ];
  if (c === 'PAYPAL') return [{ key: 'email', label: 'Email (PayPal)' }];
  if (c === 'SKRILL') return [{ key: 'email', label: 'Email (Skrill)' }];
  if (c === 'BINANCE') return [{ key: 'uid', label: 'Binance UID' }];
  if (c.startsWith('USDT')) return [{ key: 'wallet', label: 'Wallet Address' }];
  return []; // unknown code → free-text details
}

export function paymentFieldsPrefill(
  code: string,
  details: string | null,
): Record<string, string> {
  const fields = paymentFieldsFor(code);
  if (fields.length === 0) return {};
  const out: Record<string, string> = {};
  const lines = (details ?? '').split(/\r?\n/);
  for (const f of fields) {
    const line = lines.find((l) =>
      l.trim().toLowerCase().startsWith(f.label.toLowerCase() + ':'),
    );
    if (line) out[f.key] = line.trim().slice(f.label.length + 1).trim();
    else out[f.key] = '';
  }
  return out;
}

/** Pretty, multi-line pay-to text. */
export function serializeDetails(
  code: string,
  values: Record<string, string>,
): string {
  const fields = paymentFieldsFor(code);
  return fields
    .map((f) => `${f.label}: ${(values[f.key] ?? '').trim()}`)
    .filter((line) => !line.endsWith(': ') && !line.endsWith(':'))
    .join('\n');
}
