'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { equipment, formatDate, type Identity } from '@plant/contracts';
import { Icon, type IconName } from './icon';
import { Overlay } from './overlay';
import { ThemeToggle } from './theme';
import { LogoutButton } from './logout';

type Activity = {
  id: string;
  equipmentCode: string;
  wo: string;
  reason: string;
  brand: string | null;
  positionCount: number;
  actorName: string;
  installedAt: string;
  createdAt: string;
};
type LinkItem = { label: string; href: string; icon: IconName; group: string };
const batchLink = (item: Activity) =>
  `/bag-filter/equipment/${item.equipmentCode.toLowerCase()}?batch=${encodeURIComponent(item.id)}`;
export function Workspace({
  identity,
  active,
  activeEquipment,
  children,
}: {
  identity: Identity;
  active: 'portal' | 'bag-filter' | 'profile' | 'admin';
  activeEquipment?: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [drawer, setDrawer] = useState(false),
    [group, setGroup] = useState(true);
  const [groupPopover, setGroupPopover] = useState(false);
  const groupButton = useRef<HTMLButtonElement>(null);
  const [command, setCommand] = useState(false),
    [query, setQuery] = useState(''),
    [results, setResults] = useState<Activity[]>([]),
    [searchBusy, setSearchBusy] = useState(false),
    [searchError, setSearchError] = useState(''),
    [cursor, setCursor] = useState(0),
    [recent, setRecent] = useState<LinkItem[]>([]);
  const [notifications, setNotifications] = useState(false),
    [items, setItems] = useState<Activity[]>([]),
    [noticeError, setNoticeError] = useState(''),
    [unread, setUnread] = useState(false);
  const [account, setAccount] = useState(false),
    [sessionOpen, setSessionOpen] = useState(false),
    [remaining, setRemaining] = useState<number | null>(null);
  const sidebar = useRef<HTMLElement>(null),
    notificationButton = useRef<HTMLButtonElement>(null),
    accountButton = useRef<HTMLButtonElement>(null),
    sessionButton = useRef<HTMLButtonElement>(null),
    commandInput = useRef<HTMLInputElement>(null),
    list = useRef<HTMLDivElement>(null);
  const grant = identity.grants.find((g) => g.appId === 'bag-filter');
  const links: LinkItem[] = [
    { label: 'Portal', href: '/', icon: 'home', group: 'Halaman' },
    ...(grant ? [{ label: 'Bag Filter', href: '/bag-filter', icon: 'grid' as const, group: 'Halaman' }] : []),
    { label: 'Profil saya', href: '/profile', icon: 'user', group: 'Halaman' },
    ...(identity.portalAdmin
      ? [{ label: 'Kelola akses', href: '/admin', icon: 'settings' as const, group: 'Halaman' }]
      : []),
  ];
  const equipmentLinks: LinkItem[] = equipment
    .filter((e) => grant?.equipment.includes(e.code))
    .map((e) => ({
      label: e.code,
      href: `/bag-filter/equipment/${e.code.toLowerCase()}`,
      icon: 'grid',
      group: 'Equipment',
    }));
  const activeHref = activeEquipment
    ? `/bag-filter/equipment/${activeEquipment.toLowerCase()}`
    : active === 'portal'
      ? '/'
      : active === 'bag-filter'
        ? '/bag-filter'
        : `/${active}`;
  const toggleSidebar = useCallback(
    () =>
      setCollapsed((value) => {
        try {
          localStorage.setItem('plant-sidebar', value ? 'expanded' : 'collapsed');
        } catch {}
        return !value;
      }),
    [],
  );
  useEffect(() => {
    const media = matchMedia('(max-width: 767px)'),
      tablet = matchMedia('(max-width: 1279px)');
    const update = () => {
      setMobile(media.matches);
      let saved: string | null = null;
      try {
        saved = localStorage.getItem('plant-sidebar');
      } catch {}
      setCollapsed(saved ? saved === 'collapsed' : tablet.matches);
    };
    update();
    media.addEventListener('change', update);
    tablet.addEventListener('change', update);
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'k') {
          e.preventDefault();
          setCommand((v) => !v);
        }
        if (e.key.toLowerCase() === 'b') {
          e.preventDefault();
          if (media.matches) setDrawer((v) => !v);
          else toggleSidebar();
        }
      }
    };
    const outside = (e: PointerEvent) => {
      if (tablet.matches && !media.matches && sidebar.current && !sidebar.current.contains(e.target as Node))
        setCollapsed(true);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && tablet.matches) setCollapsed(true);
    };
    let swipeStart: { x: number; y: number } | null = null;
    const touchStart = (e: TouchEvent) => {
      const point = e.touches[0];
      swipeStart = media.matches && point.clientX <= 24 ? { x: point.clientX, y: point.clientY } : null;
    };
    const touchEnd = (e: TouchEvent) => {
      const point = e.changedTouches[0];
      if (swipeStart && point.clientX - swipeStart.x > 80 && Math.abs(point.clientY - swipeStart.y) < 60)
        setDrawer(true);
      swipeStart = null;
    };
    document.addEventListener('touchstart', touchStart, { passive: true });
    document.addEventListener('touchend', touchEnd, { passive: true });
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    try {
      const stored = JSON.parse(localStorage.getItem(`plant-recent-${identity.id}`) || '[]') as LinkItem[];
      setRecent(
        stored
          .filter((item) => [...links, ...equipmentLinks].some((link) => link.href === item.href))
          .slice(0, 5),
      );
    } catch {}
    return () => {
      media.removeEventListener('change', update);
      tablet.removeEventListener('change', update);
      document.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('touchstart', touchStart);
      document.removeEventListener('touchend', touchEnd);
    };
  }, [identity.id, toggleSidebar]);
  useEffect(() => {
    const update = () =>
      setRemaining(
        identity.sessionExpiresAt ? Math.max(0, Date.parse(identity.sessionExpiresAt) - Date.now()) : null,
      );
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [identity.sessionExpiresAt]);
  const loadActivity = useCallback(async () => {
    if (!grant) return;
    try {
      const r = await fetch('/bag-filter/api/activity', { cache: 'no-store' });
      if (!r.ok) throw Error('Aktivitas belum dapat dimuat.');
      const data = await r.json();
      setItems(data.items);
      setNoticeError('');
      let seen = '';
      try {
        seen = localStorage.getItem(`plant-activity-seen-${identity.id}`) || '';
      } catch {}
      setUnread(!!data.items.length && data.items[0].createdAt > seen);
    } catch (e) {
      setItems([]);
      setUnread(false);
      setNoticeError((e as Error).message);
    }
  }, [!!grant, identity.id]);
  useEffect(() => {
    void loadActivity();
    const timer = setInterval(() => {
      if (!document.hidden) void loadActivity();
    }, 60000);
    return () => clearInterval(timer);
  }, [loadActivity]);
  useEffect(() => {
    if (!command || !grant) {
      setResults([]);
      return;
    }
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setSearchBusy(true);
      setSearchError('');
      void fetch(`/bag-filter/api/discovery?q=${encodeURIComponent(query)}`, {
        cache: 'no-store',
        signal: abort.signal,
      })
        .then(async (r) => {
          if (!r.ok) throw Error('Pencarian belum dapat dimuat.');
          return r.json();
        })
        .then((d) => setResults(d.items))
        .catch((e) => {
          if (e.name !== 'AbortError') {
            setResults([]);
            setSearchError(e.message);
          }
        })
        .finally(() => {
          if (!abort.signal.aborted) setSearchBusy(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [command, query, !!grant]);
  const remember = (link: LinkItem) => {
    try {
      localStorage.setItem(
        `plant-recent-${identity.id}`,
        JSON.stringify([link, ...recent.filter((r) => r.href !== link.href)].slice(0, 5)),
      );
    } catch {}
  };
  const matches = [
    ...(!query ? recent.map((r) => ({ ...r, group: 'Terakhir dibuka' })) : []),
    ...links.filter((l) => l.label.toLowerCase().includes(query.toLowerCase())),
    ...equipmentLinks.filter((l) => l.label.toLowerCase().includes(query.toLowerCase())),
    ...results.map((item) => ({
      label: `${item.wo || 'Tanpa WO'} · ${item.equipmentCode}`,
      href: batchLink(item),
      icon: 'clock' as const,
      group: 'Batch',
      detail: `${item.reason} · ${item.positionCount} bag`,
    })),
  ];
  const sessionCard = (
    <>
      <div className="session-heading">
        <Icon name="clock" />
        <span>Sesi aktif</span>
      </div>
      <strong>
        {remaining === null
          ? 'Memuat sesi…'
          : remaining === 0
            ? 'Sesi berakhir'
            : `${Math.floor(remaining / 3600000)}j ${Math.floor(remaining / 60000) % 60}m`}
      </strong>
      <p>Sesi berakhir otomatis setelah delapan jam.</p>
      <LogoutButton />
    </>
  );
  const side = (
    <aside ref={sidebar} className="sidebar" aria-label="Sidebar">
      <a href="/" className="brand">
        <span className="brand-monogram">
          P<span />
        </span>
        <span className="sidebar-label">
          PLANT AREA<small>TUBAN OPERATIONS</small>
        </span>
      </a>
      <p className="nav-label sidebar-label">WORKSPACE</p>
      <nav aria-label="Navigasi utama">
        {links.slice(0, grant ? 2 : 1).map((link) => (
          <a
            key={link.href}
            href={link.href}
            title={collapsed ? link.label : undefined}
            aria-current={link.href === activeHref ? 'page' : undefined}
          >
            <span className="nav-icon">
              <Icon name={link.icon} />
            </span>
            <span className="sidebar-label">{link.label}</span>
            {link.href === '/bag-filter' && <span className="nav-count">{equipmentLinks.length}</span>}
          </a>
        ))}
        {!!equipmentLinks.length && (
          <div className="equipment-nav">
            <button
              ref={groupButton}
              type="button"
              className="nav-group"
              aria-expanded={group && !collapsed}
              onClick={() => {
                if (collapsed) {
                  setGroupPopover(true);
                } else setGroup((v) => !v);
              }}
              title="Equipment"
            >
              <span className="nav-icon">
                <Icon name="filter" />
              </span>
              <span className="sidebar-label">Equipment</span>
              <Icon name="chevron" className="group-chevron" />
            </button>
            {group && (
              <div className="nav-children">
                {equipmentLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    aria-current={link.href === activeHref ? 'page' : undefined}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="sidebar-divider" />
        {links.slice(grant ? 2 : 1).map((link) => (
          <a
            key={link.href}
            href={link.href}
            title={collapsed ? link.label : undefined}
            aria-current={link.href === activeHref ? 'page' : undefined}
          >
            <span className="nav-icon">
              <Icon name={link.icon} />
            </span>
            <span className="sidebar-label">{link.label}</span>
          </a>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="session-card sidebar-label">{sessionCard}</div>
        <button
          ref={sessionButton}
          type="button"
          className="session-mini icon-button"
          aria-label="Sisa waktu sesi"
          title="Sisa waktu sesi"
          onClick={() => setSessionOpen(true)}
        >
          <svg viewBox="0 0 40 40" className="session-ring" aria-hidden="true">
            <circle cx="20" cy="20" r="17" />
            <circle
              cx="20"
              cy="20"
              r="17"
              style={{ strokeDasharray: `${(107 * (remaining ?? 0)) / 28800000} 107` }}
            />
          </svg>
          <Icon name="clock" />
        </button>
        <button
          type="button"
          className="collapse-row"
          aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          aria-expanded={!collapsed}
          onClick={toggleSidebar}
        >
          <span className="nav-icon">
            <Icon name="collapse" style={collapsed ? { transform: 'rotate(180deg)' } : undefined} />
          </span>
          <span className="sidebar-label">Ciutkan sidebar</span>
          <kbd className="sidebar-label">Ctrl B</kbd>
        </button>
      </div>
      <button
        type="button"
        className="sidebar-handle"
        aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
        onClick={toggleSidebar}
      >
        <Icon name="chevron" style={!collapsed ? { transform: 'rotate(180deg)' } : undefined} />
      </button>
    </aside>
  );
  return (
    <div
      className={`shell${collapsed ? ' is-collapsed' : ''}`}
      data-sidebar={collapsed ? 'collapsed' : 'expanded'}
    >
      <Overlay
        open={groupPopover}
        onClose={() => setGroupPopover(false)}
        title="Equipment"
        kind="menu"
        placement="right"
        anchor={groupButton}
      >
        {equipmentLinks.map((link) => (
          <a className="menu-item" href={link.href} key={link.href}>
            <Icon name="grid" />
            {link.label}
          </a>
        ))}
      </Overlay>
      {!mobile ? (
        side
      ) : (
        <Overlay open={drawer} onClose={() => setDrawer(false)} title="Navigasi" kind="drawer">
          {side}
        </Overlay>
      )}
      <div className="workspace">
        <header className="topbar">
          <button
            type="button"
            className="icon-button mobile-menu"
            aria-label="Buka navigasi"
            onClick={() => setDrawer(true)}
          >
            <Icon name="menu" />
          </button>
          <button
            type="button"
            className="search-trigger"
            aria-label="Pencarian cepat"
            onClick={() => {
              setCommand(true);
              setCursor(0);
            }}
          >
            <Icon name="search" />
            <span>Pencarian cepat</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="topbar-actions">
            <ThemeToggle />
            {grant && (
              <button
                ref={notificationButton}
                type="button"
                className="icon-button notification-trigger"
                aria-label="Notifikasi aktivitas batch"
                aria-expanded={notifications}
                onClick={() => {
                  setNotifications(true);
                  void loadActivity();
                  setUnread(false);
                  try {
                    localStorage.setItem(`plant-activity-seen-${identity.id}`, new Date().toISOString());
                  } catch {}
                }}
              >
                <Icon name="bell" />
                {unread && <i className="notification-dot" />}
              </button>
            )}
            <button
              ref={accountButton}
              type="button"
              className="user-menu-trigger"
              aria-label="Menu akun"
              onClick={() => setAccount(true)}
            >
              <span className="avatar">{identity.name.slice(0, 1)}</span>
              <span>
                <strong>{identity.name}</strong>
                <small>{identity.email}</small>
              </span>
              <Icon name="chevron" />
            </button>
            <a className="header-action" href={grant ? '/bag-filter' : '/profile'}>
              <Icon name={grant ? 'grid' : 'user'} />
              <span>{grant ? 'Bag Filter' : 'Profil saya'}</span>
            </a>
          </div>
        </header>
        <main className="page-content">{children}</main>
        <footer className="footer">
          <span>PLANT AREA SYSTEM</span>
          <span>Maintenance Tuban · Asia/Jakarta</span>
        </footer>
      </div>
      <Overlay
        open={command}
        onClose={() => setCommand(false)}
        title="Pencarian cepat"
        kind="command"
        hideTitle
      >
        <div className="command-search">
          <Icon name="search" />
          <input
            ref={commandInput}
            autoFocus
            aria-label="Cari halaman, equipment, atau batch"
            placeholder="Cari halaman, equipment, atau batch…"
            maxLength={200}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const next =
                  (cursor + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % Math.max(1, matches.length);
                setCursor(next);
                list.current?.querySelectorAll<HTMLElement>('a')[next]?.scrollIntoView({ block: 'nearest' });
              }
              if (e.key === 'Enter' && matches[cursor]) {
                remember(matches[cursor]);
                location.assign(matches[cursor].href);
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-results scroll-fade" ref={list}>
          {matches.map((link, i) => (
            <div key={`${link.group}-${link.href}`}>
              {(i === 0 || matches[i - 1].group !== link.group) && (
                <p className="menu-group-label">{link.group}</p>
              )}
              <a
                className={`command-result${cursor === i ? ' is-highlighted' : ''}`}
                href={link.href}
                onPointerMove={() => setCursor(i)}
                onClick={() => remember(link)}
              >
                <Icon name={link.icon} />
                <span>
                  {link.label}
                  {'detail' in link && <small>{String(link.detail)}</small>}
                </span>
                <Icon name="arrow" />
              </a>
            </div>
          ))}
          {searchBusy && <p className="loading-line">Mencari batch…</p>}
          {searchError && (
            <p className="notice error" role="alert">
              {searchError}
            </p>
          )}
          {!matches.length && !searchBusy && <p className="empty">Tidak ada hasil.</p>}
        </div>
        <div className="command-footer">
          ↑↓ Navigasi <span>↵ Buka</span>
          <span>Esc Tutup</span>
        </div>
      </Overlay>
      <Overlay
        open={notifications}
        onClose={() => setNotifications(false)}
        title="Aktivitas batch"
        kind="menu"
        anchor={notificationButton}
      >
        {noticeError ? (
          <div className="notice error" role="alert">
            {noticeError}
            <button type="button" className="ghost" onClick={() => void loadActivity()}>
              Coba lagi
            </button>
          </div>
        ) : !items.length ? (
          <p className="empty">Belum ada aktivitas batch dalam cakupan Anda.</p>
        ) : (
          <div className="activity-scroll">
            {items.map((item) => (
              <a href={batchLink(item)} key={item.id} className="activity-row">
                <span className="app-icon">
                  <Icon name="grid" />
                </span>
                <span>
                  <strong>
                    {item.wo || 'Tanpa WO'} · {item.equipmentCode}
                  </strong>
                  <small>{item.reason}</small>
                  <small>
                    {item.brand || 'Belum tercatat'} · {item.actorName} · {formatDate(item.createdAt)} WIB
                  </small>
                </span>
                <strong>
                  {item.positionCount}
                  <small>bag</small>
                </strong>
              </a>
            ))}
          </div>
        )}
      </Overlay>
      <Overlay
        open={account}
        onClose={() => setAccount(false)}
        title={identity.name}
        kind="menu"
        anchor={accountButton}
      >
        <p className="fine">{identity.email}</p>
        <a href="/profile" className="menu-item">
          <Icon name="user" />
          Profil saya
        </a>
        <a href="/auth/change-password" className="menu-item">
          <Icon name="settings" />
          Ganti password
        </a>
        <LogoutButton />
      </Overlay>
      <Overlay
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        title="Sesi aktif"
        kind="menu"
        anchor={sessionButton}
      >
        <div className="session-card">{sessionCard}</div>
      </Overlay>
    </div>
  );
}
