import type { ReactNode } from 'react';

export type Surface = 'pos' | 'web' | 'admin';

export interface AppShellProps {
  /** Which client is rendering. Same component tree, three hosts — POS-101's AC. */
  surface: Surface;
  title?: string;
  children?: ReactNode;
}

const SURFACE_LABEL: Record<Surface, string> = {
  pos: 'POS terminal',
  web: 'Web',
  admin: 'Super admin',
};

export function AppShell({ surface, title = 'Pursberry', children }: AppShellProps) {
  return (
    <div className="pb-shell">
      <header className="pb-shell__header">
        <h1 className="pb-shell__title">{title}</h1>
        <span className="pb-shell__badge">{SURFACE_LABEL[surface]}</span>
      </header>
      <main className="pb-shell__main">{children}</main>
    </div>
  );
}
