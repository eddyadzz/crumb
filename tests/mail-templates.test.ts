import { describe, expect, it } from 'vitest';
import {
  otpEmailContent,
  welcomeEmailContent,
  trialStartedEmailContent,
  subscriptionActivatedEmailContent,
} from '@/lib/mail/templates';

describe('email templates', () => {
  it('otp emails carry the code and a clear subject', () => {
    const { subject, html, text } = otpEmailContent({ otp: '123456', type: 'sign-in' });
    expect(subject).toContain('login code');
    expect(html).toContain('123456');
    expect(text).toContain('123456');
  });

  it('verification otps differ by subject', () => {
    expect(otpEmailContent({ otp: '1', type: 'email-verification' }).subject).toContain('verification');
  });

  it('welcome emails greet the recipient by name', () => {
    const { subject, html } = welcomeEmailContent({ name: 'Aisha' });
    expect(subject).toBe('Welcome to Crumb');
    expect(html).toContain('Aisha');
  });

  it('trial emails state the plan and end date', () => {
    const { html, text } = trialStartedEmailContent({
      tenantName: 'Sweet Crumbs Bakery',
      planName: 'Pro',
      trialEndsAt: new Date('2026-09-16T12:00:00Z'),
    });
    expect(html).toContain('Sweet Crumbs Bakery');
    expect(html).toContain('Pro');
    expect(html).toContain('14-day free trial');
    expect(text).toContain('free trial runs until');
  });

  it('subscription-activated emails format the price and interval', () => {
    const { subject, html } = subscriptionActivatedEmailContent({
      tenantName: 'Sweet Crumbs Bakery',
      planName: 'Business',
      amount: 799,
      interval: 'monthly',
    });
    expect(subject).toContain('Business');
    expect(html).toContain('MVR 799.00/monthly');
  });
});