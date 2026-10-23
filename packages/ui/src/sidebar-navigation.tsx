'use client';
import { useRef, useState } from 'react';
import { canConsume, type Identity } from '@plant/contracts';
import { Icon, type IconName } from './icon';
import { Overlay } from './overlay';

type Item = { label: string; href: string };
type App = 'bag-filter' | 'consumables';
export function SidebarNavigation({
  identity,
  activeHref,
  context,
  compact,
  equipmentLinks,
  stockLinks,
}: {
  identity: Identity;
  activeHref: string;
  context: string;
  compact: boolean;
  equipmentLinks: Item[];
  stockLinks: Item[];
}) {
  const [openApp, setOpenApp] = useState<string | null>(context),
    [equipmentOpen, setEquipmentOpen] = useState(true),
    [flyout, setFlyout] = useState<App | null>(null);
  const anchor = useRef<HTMLButtonElement>(null);
  const bagGrant = identity.grants.find((g) => g.appId === 'bag-filter');
  const apps: { id: App; label: string; icon: IconName; items: Item[] }[] = [
    ...(bagGrant
      ? [
          {
            id: 'bag-filter' as const,
            label: 'Bag Filter',
            icon: 'filter' as const,
            items: [
              { label: 'Ringkasan', href: '/bag-filter' },
              ...equipmentLinks,
              ...(bagGrant.role === 'admin' ? [{ label: 'Audit', href: '/bag-filter/audit' }] : []),
            ],
          },
        ]
      : []),
    ...(canConsume(identity, 'read')
      ? [{ id: 'consumables' as const, label: 'Consumable Room', icon: 'box' as const, items: stockLinks }]
      : []),
  ];
  const link = (item: Item) => (
    <a key={item.href} href={item.href} aria-current={activeHref === item.href ? 'page' : undefined}>
      {item.label}
    </a>
  );
  return (
    <>
      <nav aria-label="Navigasi utama" className="sidebar-navigation">
        <a
          href="/"
          aria-current={activeHref === '/' ? 'page' : undefined}
          title={compact ? 'Portal' : undefined}
        >
          <span className="nav-icon">
            <Icon name="home" />
          </span>
          <span className="sidebar-label">Portal</span>
        </a>
        {apps.map((app) => {
          const current = context === app.id,
            expanded = current && openApp === app.id && !compact;
          return (
            <div key={app.id} className="nav-application" data-app={app.id} data-active={current}>
              <div className="application-row">
                {compact ? (
                  <button
                    type="button"
                    className="nav-group app-flyout-trigger"
                    aria-label={`Menu ${app.label}`}
                    title={app.label}
                    aria-haspopup="dialog"
                    aria-expanded={flyout === app.id}
                    onClick={(e) => {
                      anchor.current = e.currentTarget;
                      setFlyout(app.id);
                    }}
                  >
                    <span className="nav-icon">
                      <Icon name={app.icon} />
                    </span>
                  </button>
                ) : (
                  <a
                    href={`/${app.id}`}
                    className="application-link"
                    aria-current={!expanded && activeHref === `/${app.id}` ? 'page' : undefined}
                  >
                    <span className="nav-icon">
                      <Icon name={app.icon} />
                    </span>
                    <span className="sidebar-label">{app.label}</span>
                    {app.id === 'bag-filter' && <span className="nav-count">{equipmentLinks.length}</span>}
                  </a>
                )}
                {!compact && current && (
                  <button
                    className="application-toggle"
                    type="button"
                    aria-label={`${expanded ? 'Tutup' : 'Buka'} menu ${app.label}`}
                    aria-expanded={expanded}
                    aria-controls={`navigation-${app.id}`}
                    onClick={() => setOpenApp(expanded ? null : app.id)}
                  >
                    <Icon name="chevron" />
                  </button>
                )}
              </div>
              {expanded && (
                <div className="nav-children application-children" id={`navigation-${app.id}`}>
                  {app.id === 'consumables' ? (
                    app.items.map(link)
                  ) : (
                    <>
                      {link(app.items[0])}
                      {!!equipmentLinks.length && (
                        <>
                          <button
                            type="button"
                            className="equipment-subgroup"
                            aria-expanded={equipmentOpen}
                            aria-controls="navigation-equipment"
                            onClick={() => setEquipmentOpen((v) => !v)}
                          >
                            Equipment <Icon name="chevron" />
                          </button>
                          {equipmentOpen && (
                            <div className="equipment-links" id="navigation-equipment">
                              {equipmentLinks.map(link)}
                            </div>
                          )}
                        </>
                      )}
                      {bagGrant?.role === 'admin' && link({ label: 'Audit', href: '/bag-filter/audit' })}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <nav aria-label="Akun dan administrasi" className="sidebar-account">
        <a href="/profile" aria-current={activeHref === '/profile' ? 'page' : undefined} title="Profil saya">
          <span className="nav-icon">
            <Icon name="user" />
          </span>
          <span className="sidebar-label">Profil saya</span>
        </a>
        {identity.portalAdmin && (
          <a href="/admin" aria-current={activeHref === '/admin' ? 'page' : undefined} title="Kelola akses">
            <span className="nav-icon">
              <Icon name="settings" />
            </span>
            <span className="sidebar-label">Kelola akses</span>
          </a>
        )}
      </nav>
      <Overlay
        open={!!flyout}
        onClose={() => setFlyout(null)}
        title={apps.find((a) => a.id === flyout)?.label ?? 'Aplikasi'}
        kind="menu"
        placement="right"
        anchor={anchor}
      >
        {apps
          .find((a) => a.id === flyout)
          ?.items.map((item) => (
            <a
              className="menu-item"
              key={item.href}
              href={item.href}
              aria-current={activeHref === item.href ? 'page' : undefined}
            >
              <Icon name={item.href.includes('/equipment/') ? 'filter' : 'grid'} />
              {item.label}
            </a>
          ))}
      </Overlay>
    </>
  );
}
