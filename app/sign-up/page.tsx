import { Suspense } from 'react';
import { OtpForm } from '@/components/auth/otp-form';

export default function SignUpPage() {
  return (
    <Suspense>
      <OtpForm mode="sign-up" />
    </Suspense>
  );
}