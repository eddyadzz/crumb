import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/lib/prisma';
import { sendOtpEmail } from '@/lib/mail';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  user: {
    additionalFields: {
      tenantId: { type: 'string' },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      resendStrategy: 'reuse',
      sendVerificationOTP: async ({ email, otp, type }) => {
        await sendOtpEmail({ to: email, otp, type });
      },
    }),
  ],
  advanced: {
    cookiePrefix: 'crumb',
  },
});