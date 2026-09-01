import { Suspense } from 'react';
import { getIngredientsWithCost } from '@/lib/queries';
import { getTenantContext } from '@/lib/tenant';
import { IngredientsClient } from './ingredients-client';

export const dynamic = 'force-dynamic';

export default async function IngredientsPage() {
  const { tenantId } = await getTenantContext();
  const ingredients = await getIngredientsWithCost(tenantId);
  return (
    <Suspense fallback={<div className="p-8">Loading ingredients...</div>}>
      <IngredientsClient ingredients={ingredients} />
    </Suspense>
  );
}
