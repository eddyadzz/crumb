import { getTenantContext } from '@/lib/tenant';
import { recordUsage } from '@/lib/usage';
import { UsageEventType } from '@/lib/usage-events';
import { getShoppingList } from '@/lib/queries';
import { ShoppingListClient } from './shopping-list-client';

export const dynamic = 'force-dynamic';

export default async function ShoppingListPage() {
  const { tenantId } = await getTenantContext();
  const vm = await getShoppingList(tenantId);
  if (vm.total.items > 0) {
    await recordUsage({
      tenantId,
      eventType: UsageEventType.SHOPPING_LIST_GENERATED,
      route: '/shopping-list',
      metadata: { itemCount: vm.total.items },
    });
  }
  return <ShoppingListClient vm={vm} />;
}