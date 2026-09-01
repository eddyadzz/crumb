import { describe, expect, it } from 'vitest';
import {
  otpEmailContent,
  welcomeEmailContent,
  trialStartedEmailContent,
  trialReminderEmailContent,
  trialExpiredEmailContent,
  subscriptionActivatedEmailContent,
} from '@/lib/mail/templates';

describe('trial lifecycle emails', () => {
  it('reminder emails pluralise days and state the end date', () => {
    const { subject, html } = trialReminderEmailContent({
      tenantName: 'Sweet Crumbs Bakery',
      planName: 'Pro',
      trialEndsAt: new Date('2026-09-09T12:00:00Z'),
      daysLeft: 3,
    });
    expect(subject).toContain('3 days left');
    expect(html).toContain('Sweet Crumbs Bakery');
    expect(html).toContain('Pro');
    expect(html).toContain('September 9');
  });

  it('reminder singularises for a single day left', () => {
    const { subject } = trialReminderEmailContent({
      tenantName: 'Sweet Crumbs Bakery',
      planName: 'Pro',
      trialEndsAt: new Date('2026-09-03T12:00:00Z'),
      daysLeft: 1,
    });
    expect(subject).toContain('1 day left');
  });

  it('expired emails reassure the workspace is safe', () => {
    const { subject, text } = trialExpiredEmailContent({
      tenantName: 'Sweet Crumbs Bakery',
      planName: 'Pro',
    });
    expect(subject).toContain('has ended');
    expect(text).toContain('workspace is safe');
    expect(text).toContain('Upgrade any time');
  });
});

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