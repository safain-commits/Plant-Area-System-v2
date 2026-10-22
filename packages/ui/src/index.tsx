import type { Identity } from '@plant/contracts';
export { LogoutButton } from './logout';
import { LogoutButton } from './logout';
export function Shell({
  identity,
  active,
  children,
}: {
  identity: Identity;
  active: 'portal' | 'bag-filter' | 'profile' | 'admin';
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <a href="/" className="brand">
          P
          <span>
            PLANT AREA
            <br />
            <small>TUBAN OPERATIONS</small>
          </span>
        </a>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Navigasi utama">
          <a href="/" aria-current={active === 'portal' ? 'page' : undefined}>
            <span>⌂</span>Portal
          </a>
          {identity.grants.some((g) => g.appId === 'bag-filter') && (
            <a href="/bag-filter" aria-current={active === 'bag-filter' ? 'page' : undefined}>
              <span>▦</span>Bag Filter
            </a>
          )}
          <a href="/profile" aria-current={active === 'profile' ? 'page' : undefined}>
            <span>○</span>Profil saya
          </a>
          {identity.portalAdmin && (
            <a href="/admin" aria-current={active === 'admin' ? 'page' : undefined}>
              <span>⚙</span>Kelola akses
            </a>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-chip">
            <span className="avatar">{identity.name.slice(0, 1)}</span>
            <div>
              <strong>{identity.name}</strong>
              <small>{identity.position || (identity.portalAdmin ? 'Admin portal' : 'Maintenance')}</small>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>MAINTENANCE / TUBAN</span>
          <span>
            <i className="live-dot" /> Internal workspace
          </span>
        </header>
        {children}
        <footer className="footer">
          <span>PLANT AREA SYSTEM</span>
          <span>Maintenance Tuban · Asia/Jakarta</span>
        </footer>
      </div>
    </div>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {children}
    </div>
  );
}
