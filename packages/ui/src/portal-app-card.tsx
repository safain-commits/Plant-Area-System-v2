'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  appCatalog,
  formatDate,
  type AppId,
  type Identity,
  type PortalSummary,
  type PortalTone,
} from '@plant/contracts';
import { Icon, type IconName } from './icon';

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

const ageKeys = ['age-0', 'age-210', 'age-420', 'age-630', 'age-840', 'age-1050', 'age-1260'] as const;

function segmentBackground(scale: 'age' | 'series', index: number, tone?: PortalTone, key?: string) {
  if (scale === 'age') {
    if (key && (ageKeys as readonly string[]).includes(key)) return `var(--${key})`;
    return `var(--${ageKeys[Math.min(index, ageKeys.length - 1)]})`;
  }
  if (tone === 'accent') return 'var(--series-2)';
  if (tone === 'danger' || tone === 'warning') return 'var(--series-3)';
  return 'var(--series-4)';
}

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
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const signal = summary?.signal;
  const signalTotal = signal ? signal.segments.reduce((sum, s) => sum + s.value, 0) : 0;
  const activeSegments = signal
    ? signal.segments.map((s, index) => ({ ...s, index })).filter((s) => s.value > 0)
    : [];
  const hoveredSegment = activeSegments.find((s) => s.key === hoveredKey) ?? null;

  return (
    <section
      className="panel application-summary portal-app-card"
      data-app-id={app.id}
      aria-label={`Ringkasan ${app.name}`}
    >
      <div className="section-head">
        <h2>
          <Icon name={app.icon} />
          <span>{app.name}</span>
        </h2>
        {readOnly && <span className="badge neutral">Hanya lihat</span>}
      </div>

      {status === 'loading' && (
        <div className="portal-card-loading" role="status" aria-label={`Memuat ringkasan ${app.name}`}>
          <div className="summary-metrics cols-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <span className="skeleton portal-metric-label-skeleton" />
                <span className="skeleton portal-metric-value-skeleton" />
              </div>
            ))}
          </div>
          <div className="skeleton portal-signal-skeleton" aria-hidden="true" />
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
          <dl className={`summary-metrics cols-${Math.min(3, Math.max(1, summary.metrics.length))}`}>
            {summary.metrics.slice(0, 3).map((m) => (
              <div key={m.key}>
                <dt>{m.label}</dt>
                <dd className="tabular-nums">
                  {m.href ? (
                    <a href={m.href}>
                      {m.value.toLocaleString('id-ID')}
                      {m.unit ? <small> {m.unit}</small> : null}
                    </a>
                  ) : (
                    <>
                      {m.value.toLocaleString('id-ID')}
                      {m.unit ? <small> {m.unit}</small> : null}
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {signal && (
            <div
              className="portal-signal"
              role="group"
              aria-label={signal.label}
              tabIndex={0}
              onBlur={() => setHoveredKey(null)}
            >
              <div className="portal-signal-bar">
                {activeSegments.length > 0 ? (
                  activeSegments.map((seg) => (
                    <span
                      key={seg.key}
                      data-segment={seg.key}
                      className={`portal-signal-seg scale-${signal.scale} tone-${seg.tone || 'neutral'}`}
                      style={{
                        flexGrow: seg.value,
                        flexBasis: 0,
                        background: segmentBackground(signal.scale, seg.index, seg.tone, seg.key),
                      }}
                      title={`${seg.label}: ${seg.value.toLocaleString('id-ID')}`}
                      onPointerEnter={() => setHoveredKey(seg.key)}
                      onPointerLeave={() => setHoveredKey(null)}
                    />
                  ))
                ) : (
                  <span className="portal-signal-empty" />
                )}
              </div>
              <p className="portal-signal-caption">
                <span>{signal.label}</span>
                <span className="tabular-nums">
                  {hoveredSegment
                    ? `${hoveredSegment.label}: ${hoveredSegment.value.toLocaleString('id-ID')}`
                    : activeSegments.length > 0
                      ? activeSegments
                          .slice(0, 2)
                          .map((s) => `${s.label} ${s.value.toLocaleString('id-ID')}`)
                          .join(' · ')
                      : `0 dari ${signalTotal.toLocaleString('id-ID')}`}
                </span>
              </p>
            </div>
          )}
        </>
      )}

      <div className="portal-card-footer">
        {!readOnly && status === 'ready' && summary?.action && (
          <a className="button secondary small portal-card-action" href={summary.action.href}>
            <Icon name={summary.action.icon} />
            <span>{summary.action.label}</span>
          </a>
        )}
        <a className="summary-open" href={app.path}>
          <span>Buka {app.name}</span>
          <Icon name="arrow" />
        </a>
      </div>
    </section>
  );
}

type AppSummaryState = {
  status: 'loading' | 'ready' | 'error';
  summary?: PortalSummary;
  error?: string;
};

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
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [feedFilter, setFeedFilter] = useState<string>('all');
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

  const attentionItems = useMemo(() => {
    const list: {
      appId: string;
      appName: string;
      appIcon: IconName;
      key: string;
      label: string;
      value: number;
      severity: 'warning' | 'danger';
      href: string;
    }[] = [];
    for (const app of activeApps) {
      const summary = states[app.id]?.summary;
      if (!summary) continue;
      for (const item of summary.attention) {
        if (item.value > 0) {
          list.push({
            appId: app.id,
            appName: app.name,
            appIcon: app.icon,
            ...item,
          });
        }
      }
    }
    return list.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'danger' ? -1 : 1;
      return b.value - a.value;
    });
  }, [activeApps, states]);

  const recentItems = useMemo(() => {
    const list: {
      appId: string;
      appName: string;
      appIcon: IconName;
      id: string;
      title: string;
      meta: string;
      at: string;
      href: string;
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

  const filteredRecent = useMemo(
    () =>
      (feedFilter === 'all' ? recentItems : recentItems.filter((item) => item.appId === feedFilter)).slice(
        0,
        8,
      ),
    [feedFilter, recentItems],
  );

  const visibleAttention = showAllAttention ? attentionItems : attentionItems.slice(0, 4);

  return (
    <div className="portal-hub">
      <div className="heading portal-heading">
        <div>
          <p className="eyebrow">Portal</p>
          <div className="portal-greeting-row">
            <h1>{greeting}</h1>
            <time className="portal-date">{dateLabel}</time>
          </div>
          <p className="muted">Ringkasan pekerjaan dan perhatian di area Anda.</p>
        </div>
      </div>

      <div className="portal-layout">
        <div className="portal-main">
          {activeApps.length > 0 && (
            <section className="portal-attention" aria-label="Perlu perhatian">
              <h2>
                <Icon name="info" />
                <span>Perlu perhatian</span>
              </h2>
              <div className="portal-attention-body">
                {anyLoading && attentionItems.length === 0 ? (
                  <div
                    className="portal-attention-skeleton-row"
                    role="status"
                    aria-label="Memuat item perhatian"
                  >
                    <span className="skeleton portal-attention-skeleton" />
                    <span className="skeleton portal-attention-skeleton" />
                  </div>
                ) : attentionItems.length === 0 ? (
                  <div className="portal-attention-calm">
                    <Icon name="check" />
                    <span>Tidak ada yang perlu ditindaklanjuti</span>
                  </div>
                ) : (
                  <div className="portal-attention-chips">
                    {visibleAttention.map((item) => (
                      <a
                        key={`${item.appId}-${item.key}`}
                        href={item.href}
                        className={`portal-attention-chip is-${item.severity}`}
                      >
                        <Icon name={item.appIcon} />
                        <strong className="tabular-nums">{item.value.toLocaleString('id-ID')}</strong>
                        <span>{item.label}</span>
                        <Icon name="chevron" />
                      </a>
                    ))}
                    {attentionItems.length > 4 && (
                      <button
                        type="button"
                        className="secondary small portal-attention-more"
                        onClick={() => setShowAllAttention((v) => !v)}
                      >
                        {showAllAttention ? 'Ringkas' : `Lihat semua (${attentionItems.length})`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeApps.length > 0 ? (
            <div className="portal-summaries">
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
              <h2 className="portal-section-title">Segera hadir</h2>
              <div className="portal-planned-grid">
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
          <aside className="panel portal-rail" aria-label="Aktivitas terbaru">
            <div className="section-head">
              <h2>Aktivitas terbaru</h2>
              <span className="fine">{filteredRecent.length} entri</span>
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

            <div className="portal-feed-list scroll-fade">
              {anyLoading && recentItems.length === 0 ? (
                <div className="portal-feed-skeleton" role="status" aria-label="Memuat aktivitas">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="skeleton portal-feed-skeleton-row" />
                  ))}
                </div>
              ) : filteredRecent.length > 0 ? (
                filteredRecent.map((item) => (
                  <a key={`${item.appId}-${item.id}`} href={item.href} className="portal-feed-item">
                    <span className="portal-feed-icon" title={item.appName} aria-hidden="true">
                      <Icon name={item.appIcon} />
                    </span>
                    <span className="portal-feed-body">
                      <strong className="code-text">{item.title}</strong>
                      <small>{item.meta}</small>
                    </span>
                    <time className="portal-feed-time tabular-nums" dateTime={item.at}>
                      {formatDate(item.at)} WIB
                    </time>
                  </a>
                ))
              ) : (
                <p className="muted portal-feed-empty">Belum ada aktivitas tercatat.</p>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
