import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';

export default async function ProductionPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenantId } = await getTenantContext();

  const order = await prisma.productionOrder.findUnique({
    where: { id, tenantId },
    include: {
      items: {
        include: {
          recipe: {
            include: { recipeIngredients: { include: { ingredient: true } } },
          },
        },
      },
    },
  });

  if (!order) notFound();

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <style>{`
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; margin: 0; }
        .sheet { padding: 24px; max-width: 820px; margin: 0 auto; }
        .no-print { margin-bottom: 16px; }
        h1 { font-size: 22px; margin: 0 0 2px; }
        .sub { color: #666; font-size: 13px; margin-bottom: 16px; }
        .order { border: 1px solid #ddd; border-radius: 10px; padding: 14px; margin-bottom: 16px; page-break-inside: avoid; }
        .order h2 { font-size: 15px; margin: 0 0 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
        th { background: #f5f5f5; }
        .actual-bg { background: #fafafa; }
        .variation { width: 90px; }
        .footer { margin-top: 24px; font-size: 12px; color: #888; }
        @media print { .no-print { display: none; } body { padding: 0; } }
      `}</style>

      <div className="sheet">
        <div className="no-print">
          <PrintButton />
        </div>

        <h1>Production Sheet</h1>
        <div className="sub">
          Order #{order.id.slice(-6).toUpperCase()} ·{' '}
          {new Date(order.createdAt).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </div>

        {order.items.map((item) => (
          <div key={item.id} className="order">
            <h2>
              {item.recipe.name} — {item.batchCount} batch{item.batchCount > 1 ? 'es' : ''}
              <span style={{ fontWeight: 400, color: '#666', marginLeft: 8, fontSize: 12 }}>
                {item.recipe.servingsProduced * item.batchCount} servings
              </span>
            </h2>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Ingredient</th>
                  <th style={{ width: '25%' }}>Planned</th>
                  <th className="actual-bg" style={{ width: '25%' }}>Actual</th>
                  <th className="variation">Variance</th>
                </tr>
              </thead>
              <tbody>
                {item.recipe.recipeIngredients.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: '#999' }}>
                      No tracked ingredients
                    </td>
                  </tr>
                ) : (
                  item.recipe.recipeIngredients.map((ri) => (
                    <tr key={ri.id}>
                      <td>{ri.ingredient.name}</td>
                      <td>
                        {(ri.quantity * item.batchCount).toFixed(1)} {ri.unit}
                      </td>
                      <td className="actual-bg"></td>
                      <td className="variation"></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ))}

        <div className="footer">
          Crumb by BoliFlow — production floor sheet. Fill in actual amounts
          during the run, then complete the batch in the app to record variance.
        </div>
      </div>
    </div>
  );
}