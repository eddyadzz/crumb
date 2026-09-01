import { redirect } from 'next/navigation';
import { requirePlatformAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect('/sign-in');
  }
  return <>{children}</>;
}