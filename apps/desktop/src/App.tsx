import { useEffect, useState } from 'react';
import { AppShell } from '@pursberry/ui';
import { breakdown, formatBreakdown, type ProductUnit } from '@pursberry/shared';
import { getBridge } from './bridge.js';

const DEMO_UNITS: ProductUnit[] = [
  { code: 'CARTON', label: 'Carton', baseUnitsPerUnit: 120 },
  { code: 'PACK', label: 'Pack', baseUnitsPerUnit: 10 },
  { code: 'UNIT', label: 'Unit', baseUnitsPerUnit: 1 },
];

/** POS-101 placeholder — the checkout screen (POS-102) replaces this. */
export function App() {
  const [userDataPath, setUserDataPath] = useState<string | null>(null);

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) return;
    void bridge.getAppInfo().then((info) => setUserDataPath(info.userDataPath));
  }, []);

  return (
    <AppShell surface="pos" title="Pursberry POS">
      <div className="pb-card">
        <h2>Environment ready</h2>
        <p>
          125 base units renders as <strong>{formatBreakdown(breakdown(DEMO_UNITS, 125))}</strong>{' '}
          via the shared packaging helpers.
        </p>
        <p>
          Local store location:{' '}
          <code>{userDataPath ?? 'not running under Electron (browser preview)'}</code>
        </p>
      </div>
    </AppShell>
  );
}
