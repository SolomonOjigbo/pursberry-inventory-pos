import { AppShell } from '@pursberry/ui';

/** BILL-102/103 placeholder — plan management and the tenant list land here. */
export function App() {
  return (
    <AppShell surface="admin" title="Pursberry Super Admin">
      <div className="pb-card">
        <h2>Environment ready</h2>
        <p>
          Plan management (BILL-102) and the tenant list with <code>first_use_date</code> (BILL-103)
          mount here. This panel is deliberately a separate app from the tenant UI so super-admin
          auth never shares a session or a role table with tenant staff.
        </p>
      </div>
    </AppShell>
  );
}
