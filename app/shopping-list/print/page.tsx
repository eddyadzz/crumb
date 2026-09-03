import { getTenantContext } from '@/lib/tenant';
import { getShoppingList } from '@/lib/queries';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';

export default async function ShoppingListPrintPage() {
  const { tenantId } = await getTenantContext();
  const vm = await getShoppingList(tenantId);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <style>{`
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; margin: 0; }
        .sheet { padding: 24px; max-width: 720px; margin: 0 auto; }
        .no-print { margin-bottom: 16px; }
        h1 { font-size: 22px; margin: 0 0 2px; }
        .sub { color: #666; font-size: 13px; margin-bottom: 16px; }
        .item { display: flex; align-items: center; gap: 12px; padding: 10px 4px; border-bottom: 1px solid #eee; page-break-inside: avoid; }
        .box { width: 20px; height: 20px; border: 2px solid #999; border-radius: 4px; flex-shrink: 0; }
        .name { font-weight: 700; font-size: 15px; }
        .meta { color: #666; font-size: 12px; }
        .cost { margin-left: auto; font-weight: 600; font-size: 13px; white-space: nowrap; }
        .total { display: flex; justify-content: flex-end; gap: 16px; padding: 12px 4px; font-weight: 800; font-size: 15px; border-bottom: 2px solid #111; }
        .instock { margin-top: 20px; color: #888; font-size: 12px; }
        .footer { margin-top: 24px; font-size: 12px; color: #888; }
        @media print { .no-print { display: none; } }
      `}</style>

      <div className="sheet">
        <div className="no-print">
          <PrintButton />
        </div>

        <h1>Shopping List</h1>
        <div className="sub">
          {vm.orderCount > 0 &&
            `${vm.orderCount} upcoming order${vm.orderCount > 1 ? 's' : ''}`}
          {vm.nextDelivery &&
            ` · next delivery ${new Date(vm.nextDelivery).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
          {vm.orderCount === 0 && 'No upcoming orders yet'}
          {' · '}
          {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>

        {vm.items.length === 0 ? (
          <p style={{ color: '#999', padding: '24px 0' }}>Nothing to buy — stock covers all upcoming orders.</p>
        ) : (
          <>
            {vm.items.map((item) => (
              <div key={item.ingredientId} className="item">
                <div className="box" aria-hidden />
                <div>
                  <p className="name">{item.name}</p>
                  <p className="meta">
                    buy {item.toBuyBase.toFixed(0)} {item.baseUnit}
                    {item.packs !== null && item.packSize !== null
                      ? ` (${item.packs} × ${item.packSize}${item.packUnit ?? item.baseUnit} pack${item.packs > 1 ? 's' : ''})`
                      : ''}
                    {` · in stock ${item.availableBase.toFixed(0)}`}
                  </p>
                </div>
                <span className="cost">
                  {item.estimatedCost.toFixed(2)} MVR
                </span>
              </div>
            ))}
            <div className="total">
              <span>Total estimated</span>
              <span>{vm.total.totalCost.toFixed(2)} MVR</span>
            </div>
          </>
        )}

        {vm.inStock.length > 0 && (
          <p className="instock">
            Already in stock:{' '}
            {vm.inStock.map((s) => `${s.name} (${s.requiredBase.toFixed(0)}${s.baseUnit})`).join(', ')}
          </p>
        )}

        <div className="footer">Crumb by BoliFlow — generated from upcoming orders and current stock.</div>
      </div>
    </div>
  );
}