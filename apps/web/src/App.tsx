import { AppShell } from '@pursberry/ui';
import { computeCartVat, formatNGN, fromMajor } from '@pursberry/shared';

/**
 * WEB-101 placeholder. Renders the shared shell and exercises the shared VAT +
 * money helpers so a regression in packages/shared shows up in the browser
 * build too, not only in the API.
 */
export function App() {
  const totals = computeCartVat([
    { amount: fromMajor(1000), vatable: true },
    { amount: fromMajor(500), vatable: false },
  ]);

  return (
    <AppShell surface="web">
      <div className="pb-card">
        <h2>Environment ready</h2>
        <p>Shared UI, shared domain helpers, and the Vite dev server are wired up.</p>
        <dl>
          <dt>Net</dt>
          <dd>{formatNGN(totals.net)}</dd>
          <dt>VAT (7.5% on VAT-able lines only)</dt>
          <dd>{formatNGN(totals.vat)}</dd>
          <dt>Gross</dt>
          <dd>{formatNGN(totals.gross)}</dd>
        </dl>
      </div>
    </AppShell>
  );
}
