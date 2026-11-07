import { BrandLogo } from './brand';
import { Icon } from './icon';
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="table-skeleton" role="status" aria-label="Memuat data">
      <span className="sr-only">Memuat data…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div className="table-skeleton-row" key={i}>
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      ))}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon name="box" />
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {children}
    </div>
  );
}
export function ShellSkeleton() {
  return (
    <div className="shell shell-skeleton" aria-busy="true">
      <aside className="sidebar">
        <BrandLogo />
        <div className="shell-skeleton-nav">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="skeleton" />
          ))}
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="skeleton shell-skeleton-search" />
        </header>
        <main className="page-content" role="status" aria-label="Memuat halaman">
          <div className="skeleton shell-skeleton-title" />
          <div className="panel">
            <TableSkeleton />
          </div>
        </main>
      </div>
    </div>
  );
}
