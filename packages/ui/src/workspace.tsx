'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  equipment,
  formatDate,
  canConsume,
  formatQuantity,
  type Movement,
  type Identity,
} from '@plant/contracts';
import { Icon, type IconName } from './icon';
import { Overlay } from './overlay';
import { ThemeToggle } from './theme';
import { LogoutButton } from './logout';
import { SidebarNavigation } from './sidebar-navigation';

type Activity = {
  id: string;
  equipmentCode: string;
  wo: string;
  reason: string;
  brand: string | null;
  positionCount: number | string;
  appId?: string;
  unit?: string;
  actorName: string;
  installedAt: string;
  createdAt: string;
};
type LinkItem = { label: string; href: string; icon: IconName; group: string };
const batchLink = (item: Activity) =>
  item.appId === 'consumables'
    ? `/consumables/history?movement=${encodeURIComponent(item.id)}`
    : `/bag-filter/equipment/${item.equipmentCode.toLowerCase()}?batch=${encodeURIComponent(item.id)}`;
export function Workspace({
  identity,
  active,
  activeEquipment,
  activePath,
  children,
}: {
  identity: Identity;
  active: 'portal' | 'bag-filter' | 'consumables' | 'profile' | 'admin';
  activePath?: string;
  activeEquipment?: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [drawer, setDrawer] = useState(false);
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
    sessionSummaryButton = useRef<HTMLButtonElement>(null),
    commandInput = useRef<HTMLInputElement>(null),
    list = useRef<HTMLDivElement>(null);
  const grant = identity.grants.find((g) => g.appId === 'bag-filter');
  const stockGrant = canConsume(identity, 'read');
  const stockLinks: LinkItem[] = stockGrant
    ? [
        { label: 'Ringkasan', href: '/consumables', icon: 'grid', group: 'Consumable Room' },
        ...(
          [
            ['stock', 'Cek stok', 'read'],
            ['receive', 'Penerimaan', 'receive'],
            ['issue', 'Pemakaian', 'issue'],
            ['history', 'Riwayat', 'read'],
            ['manage', 'Pengelolaan', 'manage'],
            ['audit', 'Audit', 'audit'],
          ] as const
        )
          .filter((v) => canConsume(identity, v[2]))
          .map(([path, label]) => ({
            label,
            href: '/consumables/' + path,
            icon: 'grid' as const,
            group: 'Consumable Room',
          })),
      ]
    : [];
  const sourceIds = [...(grant ? ['bag-filter'] : []), ...(stockGrant ? ['consumables'] : [])];
  const normalizeStock = (m: Movement): Activity => ({
    id: m.id,
    equipmentCode: m.mmid,
    wo: m.reference,
    reason:
      { opening: 'Saldo awal', receipt: 'Penerimaan', issue: 'Pemakaian', adjustment: 'Koreksi' }[m.type] +
      ' · ' +
      m.description,
    brand: m.locationName,
    positionCount: formatQuantity(m.quantity),
    unit: m.unit,
    actorName: m.actorName,
    installedAt: m.createdAt,
    createdAt: m.createdAt,
    appId: 'consumables',
  });
  const [materialResults, setMaterialResults] = useState<LinkItem[]>([]);
  const links: LinkItem[] = [
    { label: 'Portal', href: '/', icon: 'home', group: 'Halaman' },
    ...(grant ? [{ label: 'Bag Filter', href: '/bag-filter', icon: 'grid' as const, group: 'Halaman' }] : []),
    ...(stockGrant
      ? [{ label: 'Consumable Room', href: '/consumables', icon: 'grid' as const, group: 'Halaman' }]
      : []),
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
  const activeHref =
    activePath ||
    (activeEquipment
      ? `/bag-filter/equipment/${activeEquipment.toLowerCase()}`
      : active === 'portal'
        ? '/'
        : active === 'bag-filter'
          ? '/bag-filter'
          : `/${active}`);
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
    const sources = [...(grant ? ['bag-filter'] : []), ...(stockGrant ? ['consumables'] : [])];
    const results = await Promise.allSettled(
      sources.map(async (source) => {
        const r = await fetch('/' + source + '/api/activity', { cache: 'no-store' });
        if (!r.ok) throw Error(source + ': aktivitas belum dapat dimuat.');
        const d = await r.json();
        return {
          source,
          items:
            source === 'consumables'
              ? d.items.map(normalizeStock)
              : (d.items.map((i: Activity) => ({ ...i, appId: source })) as Activity[]),
        };
      }),
    );
    const all: Activity[] = [];
    let unseen = false;
    const errors: string[] = [];
    for (const result of results) {
      if (result.status === 'rejected') {
        errors.push(String(result.reason?.message || 'Aktivitas tidak tersedia.'));
        continue;
      }
      const { source, items: loaded } = result.value;
      all.push(...loaded);
      let seen = '';
      try {
        seen = localStorage.getItem('plant-activity-seen-' + identity.id + '-' + source) || '';
      } catch {}
      if (loaded.some((i: Activity) => i.createdAt > seen)) unseen = true;
    }
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    setItems(all.slice(0, 24));
    setUnread(unseen);
    setNoticeError(errors.join(' '));
  }, [!!grant, stockGrant, identity.id]);
  useEffect(() => {
    void loadActivity();
    const timer = setInterval(() => {
      if (!document.hidden) void loadActivity();
    }, 60000);
    return () => clearInterval(timer);
  }, [loadActivity]);
  useEffect(() => {
    if (!command || (!grant && !stockGrant)) {
      setResults([]);
      setMaterialResults([]);
      return;
    }
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setSearchBusy(true);
      setSearchError('');
      const sources = [...(grant ? ['bag-filter'] : []), ...(stockGrant ? ['consumables'] : [])];
      void Promise.allSettled(
        sources.map(async (source) => {
          const r = await fetch('/' + source + '/api/discovery?q=' + encodeURIComponent(query), {
            cache: 'no-store',
            signal: abort.signal,
          });
          if (!r.ok) throw Error(source + ': pencarian tidak tersedia.');
          return { source, data: await r.json() };
        }),
      )
        .then((results) => {
          if (abort.signal.aborted) return;
          const activities: Activity[] = [],
            materials: LinkItem[] = [],
            errors: string[] = [];
          for (const r of results) {
            if (r.status === 'rejected') {
              errors.push(String(r.reason?.message));
              continue;
            }
            const { source, data } = r.value;
            if (source === 'bag-filter') activities.push(...data.items);
            else {
              activities.push(...data.items.map(normalizeStock));
              materials.push(
                ...data.materials.map((m: { id: string; mmid: string; description: string }) => ({
                  label: m.mmid + ' ? ' + m.description,
                  href: '/consumables/stock?material=' + m.id,
                  icon: 'grid' as const,
                  group: 'Material',
                })),
              );
            }
          }
          setResults(activities);
          setMaterialResults(materials);
          setSearchError(errors.join(' '));
        })
        .finally(() => {
          if (!abort.signal.aborted) setSearchBusy(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [command, query, !!grant, stockGrant]);
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
    ...stockLinks.filter((l) => l.label.toLowerCase().includes(query.toLowerCase())),
    ...materialResults,
    ...results.map((item) => ({
      label: `${item.wo || 'Tanpa WO'} · ${item.equipmentCode}`,
      href: batchLink(item),
      icon: 'clock' as const,
      group: item.appId === 'consumables' ? 'Transaksi material' : 'Batch',
      detail: `${item.reason} · ${item.positionCount} ${item.unit || 'bag'}`,
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
      <p>
        {identity.sessionExpiresAt
          ? `Berakhir ${formatDate(identity.sessionExpiresAt)} WIB.`
          : 'Sesi berakhir otomatis setelah delapan jam.'}
      </p>
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
      <SidebarNavigation
        identity={identity}
        activeHref={activeHref}
        context={active}
        compact={collapsed && !mobile}
        equipmentLinks={equipmentLinks}
        stockLinks={stockLinks}
      />
      <div className="sidebar-bottom">
        <div className="session-compact sidebar-label">
          <button
            type="button"
            ref={sessionSummaryButton}
            className="session-summary"
            aria-label="Detail sesi aktif"
            onClick={() => setSessionOpen(true)}
          >
            <Icon name="clock" />
            <span>Sesi aktif</span>
            <strong>
              {remaining === null
                ? '…'
                : remaining === 0
                  ? 'Berakhir'
                  : `${Math.floor(remaining / 3600000)}j ${Math.floor(remaining / 60000) % 60}m`}
            </strong>
          </button>
          <LogoutButton />
        </div>
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
            {(grant || stockGrant) && (
              <button
                ref={notificationButton}
                type="button"
                className="icon-button notification-trigger"
                aria-label="Notifikasi aktivitas"
                aria-expanded={notifications}
                onClick={() => {
                  setNotifications(true);
                  void loadActivity();
                  setUnread(false);
                  try {
                    for (const source of sourceIds)
                      localStorage.setItem(
                        'plant-activity-seen-' + identity.id + '-' + source,
                        new Date().toISOString(),
                      );
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
            <a
              className="header-action"
              href={
                active === 'consumables'
                  ? '/consumables'
                  : grant
                    ? '/bag-filter'
                    : stockGrant
                      ? '/consumables'
                      : '/profile'
              }
            >
              <Icon name={grant ? 'grid' : 'user'} />
              <span>
                {active === 'consumables'
                  ? 'Consumable Room'
                  : grant
                    ? 'Bag Filter'
                    : stockGrant
                      ? 'Consumable Room'
                      : 'Profil saya'}
              </span>
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
          {searchBusy && <p className="loading-line">Mencari data…</p>}
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
        title="Aktivitas aplikasi"
        kind="menu"
        anchor={notificationButton}
      >
        {noticeError && (
          <div className="notice error" role="alert">
            {noticeError}
            <button type="button" className="ghost" onClick={() => void loadActivity()}>
              Coba lagi
            </button>
          </div>
        )}
        {!items.length ? (
          <p className="empty">Belum ada aktivitas aplikasi dalam cakupan Anda.</p>
        ) : (
          <div className="activity-scroll">
            {items.map((item) => (
              <a
                href={batchLink(item)}
                key={`${item.appId || 'bag-filter'}-${item.id}`}
                className="activity-row"
              >
                <span className="app-icon">
                  <Icon name="grid" />
                </span>
                <span>
                  <strong>
                    {item.wo || 'Tanpa WO'} · {item.equipmentCode}
                  </strong>
                  <small>
                    {item.appId === 'consumables' ? 'Consumable Room' : 'Bag Filter'} ? {item.reason}
                  </small>
                  <small>
                    {item.brand || 'Belum tercatat'} · {item.actorName} · {formatDate(item.createdAt)} WIB
                  </small>
                </span>
                <strong>
                  {item.positionCount}
                  <small>{item.unit || 'bag'}</small>
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
        anchor={collapsed && !mobile ? sessionButton : sessionSummaryButton}
      >
        <div className="session-card">{sessionCard}</div>
      </Overlay>
    </div>
  );
}
