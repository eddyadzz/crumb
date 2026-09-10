import { describe, expect, it } from 'vitest';
import { paymentFieldsFor, serializeDetails } from '@/lib/payment-details';

describe('payment details', () => {
  it('per-method field schemas', () => {
    expect(paymentFieldsFor('BANK_TRANSFER')).toEqual([
      { key: 'bank', label: 'Bank' },
      { key: 'account_name', label: 'Account Name' },
      { key: 'account_number', label: 'Account Number' },
    ]);
    expect(paymentFieldsFor('PAYPAL')).toEqual([
      { key: 'email', label: 'Email (PayPal)' },
    ]);
    expect(paymentFieldsFor('SKRILL')).toEqual([
      { key: 'email', label: 'Email (Skrill)' },
    ]);
    expect(paymentFieldsFor('BINANCE')).toEqual([
      { key: 'uid', label: 'Binance UID' },
    ]);
    expect(paymentFieldsFor('USDT_TRC20')).toEqual([
      { key: 'wallet', label: 'Wallet Address' },
    ]);
    expect(paymentFieldsFor('CARRIER_PIGEON')).toEqual([]);
  });

  it('serializes bank transfer with labeled lines', () => {
    expect(
      serializeDetails('BANK_TRANSFER', {
        bank: 'BML',
        account_name: 'Sweet Crumbs Bakery',
        account_number: '7771234',
      }),
    ).toBe(
      'Bank: BML\nAccount Name: Sweet Crumbs Bakery\nAccount Number: 7771234',
    );
  });

  it('serializes a USDT wallet', () => {
    expect(
      serializeDetails('USDT_TRC20', { wallet: 'TQ6uR7W2jxBqz1F' }),
    ).toBe('Wallet Address: TQ6uR7W2jxBqz1F');
  });

  it('drops dangling labels when a field is empty', () => {
    expect(serializeDetails('BANK_TRANSFER', { bank: 'BML' })).toBe('Bank: BML');
  });
});
