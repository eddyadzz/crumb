import { Suspense } from 'react';
import { OtpForm } from '@/components/auth/otp-form';

export default function SignInPage() {
  return (
    <Suspense>
      <OtpForm mode="sign-in" />
    </Suspense>
  );
}