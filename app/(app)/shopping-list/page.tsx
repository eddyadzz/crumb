import { getTenantContext } from '@/lib/tenant';
import { getShoppingList } from '@/lib/queries';
import { ShoppingListClient } from './shopping-list-client';

export const dynamic = 'force-dynamic';

export default async function ShoppingListPage() {
  const { tenantId } = await getTenantContext();
  const vm = await getShoppingList(tenantId);
  return <ShoppingListClient vm={vm} />;
}