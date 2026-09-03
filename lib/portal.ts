/**
 * Pure validation for the public order portal (Phase J-3). The submit action
 * runs without a session, so every field is re-checked here before any write.
 */

export interface PortalOrderInput {
  name?: unknown;
  phone?: unknown;
  productId?: unknown;
  quantity?: unknown;
  deliveryDate?: unknown;
  deliveryTime?: unknown;
  message?: unknown;
  /** Honeypot — real users never fill this. */
  company?: unknown;
}

export interface ValidPortalOrder {
  name: string;
  phone: string;
  productId: string;
  quantity: number;
  deliveryDate: Date;
  deliveryTime: string | null;
  message: string | null;
}

export type PortalValidationResult =
  | { ok: true; value: ValidPortalOrder }
  | { ok: false; error: string };

const MAX_TEXT = 500;

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Validate a raw portal submission into trusted fields. */
export function validatePortalOrder(
  input: PortalOrderInput,
  { minDate }: { minDate: Date }
): PortalValidationResult {
  // Honeypot: bots fill every field; humans never see this one.
  if (asTrimmed(input.company) !== '') {
    return { ok: false, error: 'Could not submit the order' };
  }

  const name = asTrimmed(input.name);
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: 'Please enter your name' };
  }

  const phone = asTrimmed(input.phone);
  if (!/^[+\d][\d\s-]{5,19}$/.test(phone)) {
    return { ok: false, error: 'Please enter a valid phone number' };
  }

  const productId = asTrimmed(input.productId);
  if (productId.length === 0) {
    return { ok: false, error: 'Please choose what you would like to order' };
  }

  const quantity = typeof input.quantity === 'number' ? input.quantity : Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
    return { ok: false, error: 'Quantity must be between 1 and 500' };
  }

  const deliveryDateRaw = asTrimmed(input.deliveryDate);
  const deliveryDate = new Date(`${deliveryDateRaw}T00:00:00`);
  if (deliveryDateRaw === '' || Number.isNaN(deliveryDate.getTime())) {
    return { ok: false, error: 'Please choose a delivery date' };
  }
  const dayStart = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
  if (deliveryDate < dayStart) {
    return { ok: false, error: 'Delivery date cannot be in the past' };
  }
  const aYearOut = new Date(dayStart);
  aYearOut.setFullYear(aYearOut.getFullYear() + 1);
  if (deliveryDate > aYearOut) {
    return { ok: false, error: 'Delivery date is too far in the future' };
  }

  const deliveryTime = asTrimmed(input.deliveryTime).slice(0, 40) || null;
  const message = asTrimmed(input.message).slice(0, MAX_TEXT) || null;

  return {
    ok: true,
    value: { name, phone, productId, quantity, deliveryDate, deliveryTime, message },
  };
}