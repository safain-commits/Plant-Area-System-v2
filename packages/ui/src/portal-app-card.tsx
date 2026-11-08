'use client';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  appCatalog,
  formatDate,
  formatRelativeWib,
  wibWeekStarts,
  type AppId,
  type Identity,
  type PortalSummary,
  type PortalIconName,
} from '@plant/contracts';
import { Icon, type IconName } from './icon';
import { AnimatedNumber } from './dashboard';
import { Overlay } from './overlay';
import { countScale } from './chart-scale';

export type PortalCatalogApp = {
  id: AppId;
  icon: IconName;
  name: string;
  description: string;
  status: 'active' | 'planned';
  path?: string;
  portalSummary?: string;
};

export type PortalTestFixture = {
  catalog?: readonly PortalCatalogApp[];
  grants?: { appId: string; role: 'viewer' | 'operator' | 'storekeeper' | 'admin' }[];
};

declare global {
  interface Window {
    __PORTAL_TEST_FIXTURE__?: PortalTestFixture;
  }
}

const SERIES_COLORS = [
  'var(--primary-500)',
  'var(--primary-800)',
  'var(--primary-300)',
  'var(--gray-700)',
] as const;

export function PortalAppCard({
  app,
  readOnly = false,
  status,
  summary,
  error,
  onRetry,
}: {
  app: PortalCatalogApp & { path: string };
  readOnly?: boolean;
  status: 'loading' | 'ready' | 'error';
  summary?: PortalSummary;
  error?: string;
  onRetry?: () => void;
}) {
  const headline = summary?.headline;
  const total = headline?.total ?? 0;
  const value = headline?.value ?? 0;
  const progressRatio = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  const caption =
    headline?.caption ??
    (total === 0 ? `Belum ada ${app.name} tercatat.` : `${value} ${headline?.unit ?? ''}`);

  return (
    <section
      className="panel application-summary portal-app-card"
      data-app-id={app.id}
      aria-label={`Ringkasan ${app.name}`}
    >
      <div className="section-head">
        <h2>
          <span>{app.name}</span>
          {readOnly && <span className="badge neutral">Hanya lihat</span>}
        </h2>
        <span className="app-icon" aria-hidden="true">
          <Icon name={app.icon} />
        </span>
      </div>

      {status === 'loading' && (
        <div className="portal-card-loading" role="status" aria-label={`Memuat ringkasan ${app.name}`}>
          <div className="skeleton portal-headline-skeleton" aria-hidden="true" />
          <div className="skeleton portal-track-skeleton" aria-hidden="true" />
          <div className="skeleton portal-caption-skeleton" aria-hidden="true" />
          <div className="app-card-secondary" aria-hidden="true">
            <div>
              <span className="skeleton portal-metric-label-skeleton" />
              <span className="skeleton portal-metric-value-skeleton" />
            </div>
            <div>
              <span className="skeleton portal-metric-label-skeleton" />
              <span className="skeleton portal-metric-value-skeleton" />
            </div>
          </div>
          <span className="sr-only">Memuat ringkasan {app.name}…</span>
        </div>
      )}

      {status === 'error' && (
        <div className="portal-card-error" role="alert">
          <p className="muted">{error || `Ringkasan ${app.name} belum dapat dimuat.`}</p>
          {onRetry && (
            <button type="button" className="secondary small" onClick={onRetry}>
              Coba lagi
            </button>
          )}
        </div>
      )}

      {status === 'ready' && summary && (
        <>
          <strong className="display-lg">
            <AnimatedNumber value={value} />
            <small>
              {' '}
              / {total.toLocaleString('id-ID')} {headline?.unit ?? ''}
            </small>
          </strong>

          <div
            className="progress-track"
            role="meter"
            aria-label={headline?.label ?? app.name}
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={total || 1}
          >
            <i className="hatched" style={{ transform: `scaleX(${progressRatio})` }} />
          </div>

          <p className="fine">{caption}</p>

          {summary.metrics.length > 0 && (
            <div className="app-card-secondary">
              {summary.metrics.slice(0, 2).map((m) => {
                const isTone = m.tone === 'danger' || m.tone === 'warning';
                return (
                  <div key={m.key} className="app-card-metric">
                    <span className="app-card-metric-label">{m.label}</span>
                    <strong className={`app-card-metric-value${isTone ? ' negative-text' : ''}`}>
                      {m.href ? (
                        <a href={m.href} className="metric-link">
                          <AnimatedNumber value={m.value} />
                        </a>
                      ) : (
                        <AnimatedNumber value={m.value} />
                      )}
                    </strong>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="portal-card-footer">
        <a className="summary-open" href={app.path}>
          <span>Buka {app.name}</span>
          <Icon name="arrow" />
        </a>
      </div>
    </section>
  );
}

export type AppSummaryState = {
  status: 'loading' | 'ready' | 'error';
  summary?: PortalSummary;
  error?: string;
};

export function PortalActivityChart({
  activeApps,
  states,
}: {
  activeApps: readonly (PortalCatalogApp & { path: string; portalSummary: string })[];
  states: Record<string, AppSummaryState>;
}) {
  const weeks = useMemo(() => wibWeekStarts(Date.now(), 12), []);
  const [activeSlot, setActiveSlot] = useState<number>(11); // Default to current week (last slot)

  // Determine series config per app
  const seriesConfig = useMemo(() => {
    return activeApps.map((app, index) => {
      const color = SERIES_COLORS[Math.min(index, SERIES_COLORS.length - 1)];
      const outline = index >= 2;
      return { appId: app.id, appName: app.name, color, outline };
    });
  }, [activeApps]);

  // Build slot data for the 12 weeks
  const slots = useMemo(() => {
    return weeks.map((w) => {
      let total = 0;
      const segments: {
        appId: string;
        count: number;
        color: string;
        outline: boolean;
      }[] = [];

      for (let idx = 0; idx < activeApps.length; idx++) {
        const app = activeApps[idx];
        const summary = states[app.id]?.summary;
        const weekData = summary?.activity.weeks.find((x) => x.start === w.start);
        const count = weekData?.count ?? 0;
        total += count;

        const color = SERIES_COLORS[Math.min(idx, SERIES_COLORS.length - 1)];
        const outline = idx >= 2;
        segments.push({ appId: app.id, count, color, outline });
      }

      // Format date range e.g. "3–9 Nov 2026"
      const startDate = new Date(w.startMs + 7 * 3_600_000);
      const endDate = new Date(w.endMs - 1000 + 7 * 3_600_000);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const startDay = startDate.getUTCDate();
      const endDay = endDate.getUTCDate();
      const startMonth = months[startDate.getUTCMonth()];
      const endMonth = months[endDate.getUTCMonth()];
      const year = endDate.getUTCFullYear();

      const dateRangeLabel =
        startMonth === endMonth
          ? `${startDay}–${endDay} ${endMonth} ${year}`
          : `${startDay} ${startMonth} – ${endDay} ${endMonth} ${year}`;

      return {
        ...w,
        total,
        segments,
        dateRangeLabel,
      };
    });
  }, [weeks, activeApps, states]);

  const totalCatatan12Minggu = useMemo(() => slots.reduce((sum, s) => sum + s.total, 0), [slots]);

  const maxVal = Math.max(...slots.map((s) => s.total), 1);
  const { maximum: max, ticks } = countScale(maxVal);

  const activeSlotData = slots[activeSlot] ?? slots[slots.length - 1];

  const currentWeekTotal = slots[11]?.total ?? 0;
  const prev11Total = slots.slice(0, 11).reduce((sum, s) => sum + s.total, 0);
  const prev11Avg = Math.round(prev11Total / 11);

  const hasFailedApp = activeApps.some((app) => states[app.id]?.status === 'error');

  return (
    <div className="chart-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">CATATAN PEKERJAAN</p>
          <strong
            className="display-xl"
            title="Satu catatan = satu batch penggantian Bag Filter atau satu dokumen Consumable Room yang final. Batch yang dibatalkan tidak dihitung."
          >
            <AnimatedNumber value={totalCatatan12Minggu} />
            <small> catatan</small>
          </strong>
          <p className="muted">12 minggu terakhir · Senin–Minggu (WIB)</p>
        </div>
      </div>

      {activeApps.length >= 2 && (
        <div className="chart-legend">
          {seriesConfig.map((item) => (
            <span key={item.appId}>
              <i
                style={{
                  background: item.color,
                  ...(item.outline ? { boxShadow: 'inset 0 0 0 1px var(--series-accent-outline)' } : {}),
                }}
              />
              {item.appName}
            </span>
          ))}
        </div>
      )}

      <div
        className="bar-chart"
        role="figure"
        aria-label={`Catatan pekerjaan 12 minggu: ${totalCatatan12Minggu} catatan`}
      >
        <div className="chart-grid-lines">
          {ticks.map((t) => (
            <span key={t}>
              <small>{t.toLocaleString('id-ID')}</small>
            </span>
          ))}
        </div>
        <div className="bar-slots">
          {slots.map((slot, i) => {
            const isActive = i === activeSlot;
            return (
              <button
                type="button"
                key={slot.start}
                className={`bar-slot${isActive ? ' is-active' : ''}`}
                aria-label={`Minggu ${slot.dateRangeLabel}: ${slot.total} catatan`}
                aria-pressed={isActive}
                onPointerEnter={() => setActiveSlot(i)}
                onFocus={() => setActiveSlot(i)}
                onClick={() => setActiveSlot(i)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    setActiveSlot((prev) => Math.max(0, prev - 1));
                  } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    setActiveSlot((prev) => Math.min(slots.length - 1, prev + 1));
                  }
                }}
              >
                <span className="bar-stack">
                  {slot.total > 0 ? (
                    slot.segments.map((seg) => (
                      <i
                        key={seg.appId}
                        className={isActive ? 'hatched' : ''}
                        style={{
                          height: `${(seg.count / max) * 100}%`,
                          background: isActive ? seg.color : 'var(--placeholder)',
                          ...(seg.outline
                            ? { boxShadow: 'inset 0 0 0 1px var(--series-accent-outline)' }
                            : {}),
                        }}
                      />
                    ))
                  ) : (
                    <i className="empty-bar" />
                  )}
                </span>
                <small>{slot.label}</small>
              </button>
            );
          })}
        </div>
      </div>

      <div className="chart-tooltip" aria-live="polite">
        <span>
          Minggu {activeSlotData?.dateRangeLabel} ·{' '}
          <b>
            {activeSlotData?.total.toLocaleString('id-ID')} catatan{hasFailedApp ? ' (sebagian)' : ''}
          </b>
          {activeApps.map((app) => {
            const state = states[app.id];
            if (state?.status === 'error') {
              return (
                <Fragment key={app.id}>
                  {' · '}
                  <span>{app.name} belum termuat</span>
                </Fragment>
              );
            }
            const summary = state?.summary;
            const weekCount =
              summary?.activity.weeks.find((x) => x.start === activeSlotData?.start)?.count ?? 0;
            const unit = summary?.activity.unitSingular ?? 'catatan';
            return (
              <Fragment key={app.id}>
                {' · '}
                <span>
                  {app.name}{' '}
                  <b>
                    {weekCount.toLocaleString('id-ID')} {unit}
                  </b>
                </span>
              </Fragment>
            );
          })}
        </span>
      </div>

      <p className="trend-row">
        Minggu ini {currentWeekTotal.toLocaleString('id-ID')} catatan · rata-rata 11 minggu sebelumnya{' '}
        {prev11Avg.toLocaleString('id-ID')}
      </p>
    </div>
  );
}

export function PortalKpiRail({
  activeApps,
  states,
  anyLoading,
}: {
  activeApps: readonly PortalCatalogApp[];
  states: Record<string, AppSummaryState>;
  anyLoading: boolean;
}) {
  const [showOverlay, setShowOverlay] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  // Group attention items by group.key
  const { groups, allItems } = useMemo(() => {
    const groupMap = new Map<
      string,
      {
        key: string;
        label: string;
        unit: string;
        appName: string;
        appId: string;
        totalValue: number;
        severity: 'danger' | 'warning';
        primaryHref: string;
        items: {
          key: string;
          label: string;
          value: number;
          severity: 'danger' | 'warning';
          href: string;
          appName: string;
          appId: string;
        }[];
      }
    >();

    const all: {
      key: string;
      label: string;
      value: number;
      severity: 'danger' | 'warning';
      href: string;
      appName: string;
      appId: string;
    }[] = [];

    for (const app of activeApps) {
      const summary = states[app.id]?.summary;
      if (!summary) continue;

      for (const item of summary.attention) {
        if (item.value > 0) {
          const itemRecord = {
            key: item.key,
            label: item.label,
            value: item.value,
            severity: item.severity,
            href: item.href,
            appName: app.name,
            appId: app.id,
          };
          all.push(itemRecord);

          const groupKey = item.group?.key || item.key;
          const existing = groupMap.get(groupKey);
          if (existing) {
            existing.totalValue += item.value;
            if (item.severity === 'danger') existing.severity = 'danger';
            existing.items.push(itemRecord);
          } else {
            groupMap.set(groupKey, {
              key: groupKey,
              label: item.group?.label || item.label,
              unit: item.group?.unit || '',
              appName: app.name,
              appId: app.id,
              totalValue: item.value,
              severity: item.severity,
              primaryHref: item.href,
              items: [itemRecord],
            });
          }
        }
      }
    }

    const sortedGroups = Array.from(groupMap.values()).sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'danger' ? -1 : 1;
      return b.totalValue - a.totalValue;
    });

    return { groups: sortedGroups, allItems: all };
  }, [activeApps, states]);

  const top3 = groups.slice(0, 3);
  const showMore = groups.length > 3 || groups.some((g) => g.items.length > 1);

  return (
    <div className="kpi-rail">
      <div className="section-head">
        <h2>
          <Icon name="info" />
          <span>Perlu perhatian</span>
        </h2>
      </div>

      {anyLoading && groups.length === 0 ? (
        [0, 1, 2].map((i) => (
          <article className="metric-block" key={i}>
            <span className="skeleton portal-kpi-label-skeleton" />
            <strong className="skeleton portal-kpi-value-skeleton" />
            <small className="skeleton portal-kpi-small-skeleton" />
          </article>
        ))
      ) : groups.length === 0 ? (
        <article className="metric-block is-calm">
          <span>Perlu perhatian</span>
          <strong className="display-lg">0</strong>
          <small>Tidak ada yang perlu ditindaklanjuti</small>
        </article>
      ) : (
        top3.map((grp) => {
          const smallText =
            grp.items.length > 1 ? `di ${grp.items.length} equipment · ${grp.appName}` : grp.appName;
          return (
            <article className="metric-block" key={grp.key}>
              <a href={grp.primaryHref} className="metric-block-link">
                <span>{grp.label}</span>
                <strong className={grp.totalValue > 0 ? 'negative-text' : ''}>
                  <AnimatedNumber value={grp.totalValue} />
                </strong>
                <small>{smallText}</small>
              </a>
            </article>
          );
        })
      )}

      {showMore && (
        <>
          <button
            ref={moreButtonRef}
            type="button"
            className="secondary small kpi-rail-more"
            onClick={() => setShowOverlay(true)}
          >
            Lihat semua ({allItems.length})
          </button>
          <Overlay
            open={showOverlay}
            onClose={() => setShowOverlay(false)}
            title="Semua perhatian"
            kind="menu"
            placement="bottom-end"
            anchor={moreButtonRef}
          >
            <div className="portal-attention-overlay-content">
              {activeApps.map((app) => {
                const appItems = allItems.filter((it) => it.appId === app.id);
                if (appItems.length === 0) return null;
                return (
                  <div key={app.id} className="portal-attention-overlay-group">
                    <p className="eyebrow">{app.name.toUpperCase()}</p>
                    <ul className="portal-attention-overlay-list">
                      {appItems.map((item) => (
                        <li key={item.key}>
                          <a href={item.href} className="portal-attention-overlay-item">
                            <strong className={item.severity === 'danger' ? 'negative-text' : 'warning-text'}>
                              {item.value.toLocaleString('id-ID')}
                            </strong>
                            <span>{item.label}</span>
                            <Icon name="arrow" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Overlay>
        </>
      )}
    </div>
  );
}

export function PortalQuickActions({
  activeApps,
  states,
  canHaveActions = false,
  anyLoading = false,
}: {
  activeApps: readonly PortalCatalogApp[];
  states: Record<string, AppSummaryState>;
  canHaveActions?: boolean;
  anyLoading?: boolean;
}) {
  const actions = useMemo(() => {
    const list: {
      appId: string;
      appName: string;
      label: string;
      href: string;
      icon: PortalIconName;
    }[] = [];

    for (const app of activeApps) {
      const summary = states[app.id]?.summary;
      if (summary?.action) {
        list.push({
          appId: app.id,
          appName: app.name,
          label: summary.action.label,
          href: summary.action.href,
          icon: summary.action.icon,
        });
      }
    }
    return list.slice(0, 3);
  }, [activeApps, states]);

  if (actions.length === 0) {
    if (anyLoading && canHaveActions) {
      return (
        <section className="feature-widget portal-quick-actions" aria-label="Aksi cepat">
          <p className="eyebrow">AKSI CEPAT</p>
          <div className="feature-contours" aria-hidden="true" />
          <div className="portal-action-list" role="status" aria-label="Memuat aksi cepat">
            <div className="portal-action-row" style={{ opacity: 0.6 }}>
              <span className="skeleton portal-action-skeleton" />
            </div>
            <div className="portal-action-row" style={{ opacity: 0.6 }}>
              <span className="skeleton portal-action-skeleton" />
            </div>
          </div>
        </section>
      );
    }
    return null;
  }

  return (
    <section className="feature-widget portal-quick-actions" aria-label="Aksi cepat">
      <p className="eyebrow">AKSI CEPAT</p>
      <div className="feature-contours" aria-hidden="true" />
      <div className="portal-action-list">
        {actions.map((act) => (
          <a key={act.appId} href={act.href} className="portal-action-row">
            <span className="portal-action-icon" aria-hidden="true">
              <Icon name={act.icon} />
            </span>
            <span className="portal-action-text">
              <strong className="portal-action-label">{act.label}</strong>
              <small className="portal-action-app">{act.appName}</small>
            </span>
            <span className="portal-action-arrow" aria-hidden="true">
              <Icon name="arrow" />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

export function PortalActivityFeed({
  activeApps,
  states,
  anyLoading,
}: {
  activeApps: readonly PortalCatalogApp[];
  states: Record<string, AppSummaryState>;
  anyLoading: boolean;
}) {
  const [feedFilter, setFeedFilter] = useState<string>('all');

  const allRecent = useMemo(() => {
    const list: {
      appId: string;
      appName: string;
      appIcon: IconName;
      id: string;
      title: string;
      meta: string;
      at: string;
      href: string;
      value?: number;
      unit?: string;
    }[] = [];

    for (const app of activeApps) {
      const summary = states[app.id]?.summary;
      if (!summary) continue;

      for (const item of summary.recent.slice(0, 5)) {
        list.push({
          appId: app.id,
          appName: app.name,
          appIcon: app.icon,
          ...item,
        });
      }
    }

    return list.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
  }, [activeApps, states]);

  const filteredRecent = useMemo(() => {
    const list = feedFilter === 'all' ? allRecent : allRecent.filter((item) => item.appId === feedFilter);
    return list.slice(0, 8);
  }, [feedFilter, allRecent]);

  return (
    <section className="panel recent-card" aria-label="Aktivitas terbaru">
      <div className="section-head">
        <h2>Aktivitas terbaru</h2>
        <Icon name="clock" />
      </div>

      {activeApps.length >= 3 && (
        <div className="portal-feed-filters" role="group" aria-label="Filter aplikasi">
          <button
            type="button"
            className={`portal-filter-chip${feedFilter === 'all' ? ' is-active' : ''}`}
            aria-pressed={feedFilter === 'all'}
            onClick={() => setFeedFilter('all')}
          >
            Semua
          </button>
          {activeApps.map((app) => (
            <button
              key={app.id}
              type="button"
              className={`portal-filter-chip${feedFilter === app.id ? ' is-active' : ''}`}
              aria-pressed={feedFilter === app.id}
              onClick={() => setFeedFilter(app.id)}
            >
              {app.name}
            </button>
          ))}
        </div>
      )}

      <div className="activity-scroll">
        {anyLoading && allRecent.length === 0 ? (
          <div className="portal-feed-skeleton" role="status" aria-label="Memuat aktivitas">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton portal-feed-skeleton-row" />
            ))}
          </div>
        ) : filteredRecent.length > 0 ? (
          filteredRecent.map((item) => (
            <a
              key={`${item.appId}-${item.id}`}
              className="activity-row"
              href={item.href}
              title={`${formatDate(item.at)} WIB`}
            >
              <span className="app-icon">
                <Icon name={item.appIcon} />
              </span>
              <span>
                <strong className="code-text">{item.title}</strong>
                <small>{item.meta}</small>
                <small className="tabular-nums">{formatRelativeWib(item.at)}</small>
              </span>
              {item.value !== undefined && (
                <strong>
                  {item.value.toLocaleString('id-ID')}
                  {item.unit && <small>{item.unit}</small>}
                </strong>
              )}
            </a>
          ))
        ) : (
          <div className="empty">
            <Icon name="clock" />
            <p>Belum ada aktivitas dalam cakupan Anda.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function PortalHub({
  identity,
  greeting,
  dateLabel,
}: {
  identity: Identity;
  greeting: string;
  dateLabel: string;
}) {
  const [fixture, setFixture] = useState<PortalTestFixture | null>(null);
  const [states, setStates] = useState<Record<string, AppSummaryState>>({});
  const controllersRef = useRef<Record<string, AbortController>>({});
  const startedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== 'undefined' && window.__PORTAL_TEST_FIXTURE__) {
      startedRef.current.clear();
      setFixture(window.__PORTAL_TEST_FIXTURE__);
    }
  }, []);

  const catalog: readonly PortalCatalogApp[] = fixture?.catalog ?? appCatalog;
  const grants = fixture?.grants ?? identity.grants;

  const activeApps = useMemo(
    () =>
      catalog.filter(
        (app): app is PortalCatalogApp & { path: string; portalSummary: string } =>
          app.status === 'active' &&
          Boolean(app.path) &&
          Boolean(app.portalSummary) &&
          grants.some((g) => g.appId === app.id),
      ),
    [catalog, grants],
  );

  const plannedApps = useMemo(() => catalog.filter((app) => app.status === 'planned'), [catalog]);

  const fetchAppSummary = useCallback(
    (app: PortalCatalogApp & { portalSummary: string }, force = false) => {
      const cacheKey = `${fixture ? 'fx' : 'std'}:${app.id}:${app.portalSummary}`;
      if (!force && startedRef.current.has(cacheKey)) return;
      startedRef.current.add(cacheKey);
      controllersRef.current[app.id]?.abort();
      const controller = new AbortController();
      controllersRef.current[app.id] = controller;
      const timer = setTimeout(() => {
        controller.abort(new Error(`Waktu muat ringkasan ${app.name} habis.`));
      }, 5000);

      setStates((prev) => ({
        ...prev,
        [app.id]: { status: 'loading' },
      }));

      void fetch(app.portalSummary, { cache: 'no-store', signal: controller.signal })
        .then(async (res) => {
          const contentType = res.headers.get('content-type') || '';
          const body = contentType.includes('application/json') ? await res.json() : null;
          if (!res.ok || !body) {
            throw new Error(body?.error || `Ringkasan ${app.name} belum tersedia.`);
          }
          if (controller.signal.aborted) return;
          setStates((prev) => ({
            ...prev,
            [app.id]: { status: 'ready', summary: body as PortalSummary },
          }));
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted && !(err instanceof Error && err.message.includes('Waktu muat'))) {
            return;
          }
          const message =
            err instanceof Error && err.name !== 'AbortError'
              ? err.message
              : `Ringkasan ${app.name} belum tersedia.`;
          setStates((prev) => ({
            ...prev,
            [app.id]: { status: 'error', error: message },
          }));
        })
        .finally(() => {
          clearTimeout(timer);
        });
    },
    [fixture],
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && window.__PORTAL_TEST_FIXTURE__ && !fixture) {
      return;
    }
    for (const app of activeApps) {
      fetchAppSummary(app, false);
    }
  }, [activeApps, fetchAppSummary, fixture]);

  const anyLoading = activeApps.some((app) => (states[app.id]?.status ?? 'loading') === 'loading');

  const appGridColsClass = activeApps.length <= 1 ? 'cols-1' : activeApps.length === 2 ? 'cols-2' : 'cols-3';

  const canHaveQuickActions = useMemo(() => {
    return grants.some((g) => g.role !== 'viewer' && activeApps.some((a) => a.id === g.appId));
  }, [grants, activeApps]);

  const hasQuickActions = useMemo(() => {
    const hasLoadedAction = activeApps.some((app) => Boolean(states[app.id]?.summary?.action));
    return hasLoadedAction || (anyLoading && canHaveQuickActions);
  }, [activeApps, states, anyLoading, canHaveQuickActions]);

  return (
    <div className="portal-hub">
      <div className="heading portal-heading">
        <div>
          <p className="eyebrow">TQ-CMMS / PORTAL</p>
          <h1>{greeting}</h1>
          <p className="muted">Ringkasan pekerjaan dan perhatian di area Anda.</p>
        </div>
        <time className="portal-date-slot">{dateLabel}</time>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          {activeApps.length > 0 && (
            <section className="panel hero-chart-card" aria-label="Catatan pekerjaan dan perhatian">
              <PortalActivityChart activeApps={activeApps} states={states} />
              <PortalKpiRail activeApps={activeApps} states={states} anyLoading={anyLoading} />
            </section>
          )}

          {activeApps.length > 0 ? (
            <div className={`portal-app-grid ${appGridColsClass}`}>
              {activeApps.map((app) => {
                const grant = grants.find((g) => g.appId === app.id);
                const state = states[app.id] ?? { status: 'loading' };
                return (
                  <PortalAppCard
                    key={app.id}
                    app={app}
                    readOnly={grant?.role === 'viewer'}
                    status={state.status}
                    summary={state.summary}
                    error={state.error}
                    onRetry={() => fetchAppSummary(app, true)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="panel empty portal-no-access">
              Belum ada akses aplikasi. Hubungi admin portal untuk menentukan peran dan cakupan Anda.
            </div>
          )}

          {plannedApps.length > 0 && (
            <section className="portal-planned" aria-label="Segera hadir">
              <div className="section-head">
                <div>
                  <h2 className="portal-section-title">Segera hadir</h2>
                  <p className="fine">Dalam pengembangan</p>
                </div>
              </div>
              <div className={`portal-planned-grid ${appGridColsClass}`}>
                {plannedApps.map((app) => (
                  <div key={app.id} className="portal-planned-tile">
                    <span className="portal-planned-icon" aria-hidden="true">
                      <Icon name={app.icon} />
                    </span>
                    <div className="portal-planned-copy">
                      <strong>{app.name}</strong>
                      <span>{app.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {activeApps.length > 0 && (
          <aside
            className={`dashboard-rail${hasQuickActions ? '' : ' no-actions'}`}
            aria-label="Aksi cepat dan aktivitas"
          >
            <PortalQuickActions
              activeApps={activeApps}
              states={states}
              canHaveActions={canHaveQuickActions}
              anyLoading={anyLoading}
            />
            <PortalActivityFeed activeApps={activeApps} states={states} anyLoading={anyLoading} />
          </aside>
        )}
      </div>
    </div>
  );
}
