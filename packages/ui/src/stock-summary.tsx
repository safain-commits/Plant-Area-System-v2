'use client';
import { useEffect, useState } from 'react';
import { canConsume, type Identity, type StockDashboard } from '@plant/contracts';
import { Select } from './fields';
import { Button } from './button';
import { Icon } from './icon';
import { ApplicationSummary } from './application-summary';
import { AnimatedNumber } from './dashboard';
import { QuarterlyChart, type ChartSeries } from './quarterly-chart';
import { StockActivity, movementLabels } from './stock-activity';
const kinds = ['opening', 'picklist', 'consume', 'return', 'adjustment'] as const;
const labels = {
  opening: 'Saldo awal',
  picklist: 'Penerimaan Picklist',
  consume: 'Consume Order',
  return: 'Return Order',
  adjustment: 'Koreksi',
};
const colors = kinds.map((_, i) => `var(--series-${i + 1})`);
const series: ChartSeries[] = kinds.map((key, i) => ({
  key,
  label: labels[key],
  direction: key === 'consume' ? 'out' : key === 'adjustment' ? 'mixed' : 'in',
  color: colors[i],
  hatch: key === 'opening' || key === 'adjustment' || key === 'picklist',
}));
const n = (value: number) => value.toLocaleString('id-ID');

export function StockSummary({
  identity,
  variant = 'full',
}: {
  identity?: Identity;
  variant?: 'full' | 'compact';
}) {
  const [year, setYear] = useState(new Date(Date.now() + 7 * 3600000).getUTCFullYear()),
    [data, setData] = useState<StockDashboard | null>(null),
    [error, setError] = useState(''),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState(true),
    [active, setActive] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setError('');
    setBusy(true);
    fetch(`/consumables/api/dashboard?year=${year}`, { cache: 'no-store', signal: c.signal })
      .then(async (r) => {
        if (!r.headers.get('content-type')?.includes('application/json'))
          throw Error('Ringkasan belum dapat dimuat. Silakan coba lagi.');
        const d = await r.json();
        if (!r.ok) throw Error(d.error || 'Ringkasan belum dapat dimuat.');
        if (c.signal.aborted) return;
        setData(d);
        setActive(
          d.year === d.currentYear ? Math.floor(new Date(Date.now() + 7 * 3600000).getUTCMonth() / 3) : 3,
        );
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
    return () => c.abort();
  }, [year, reload]);
  const compact = variant === 'compact';
  if (!data)
    return (
      <section
        className={`stock-summary ${compact ? 'is-compact' : ''}`}
        aria-label="Ringkasan Consumable Room"
      >
        {error ? (
          <div className="panel dashboard-error" role="alert">
            <Icon name="info" />
            <h2>Ringkasan belum tersedia</h2>
            <p>{error}</p>
            <Button className="secondary" onClick={() => setReload((v) => v + 1)}>
              Coba lagi
            </Button>
          </div>
        ) : (
          <div
            className={`stock-loading ${compact ? 'stock-portal-grid' : 'dashboard-grid'}`}
            role="status"
            aria-label="Memuat ringkasan Consumable Room"
          >
            {compact ? (
              <>
                <div className="panel skeleton" />
                <div className="panel skeleton" />
              </>
            ) : (
              <>
                <div className="dashboard-main">
                  <div className="panel skeleton stock-loading-hero" />
                  <div className="dashboard-row two-columns stock-loading-followups">
                    <div className="panel skeleton" />
                    <div className="panel skeleton" />
                  </div>
                </div>
                <div className="dashboard-rail stock-rail">
                  <div className="panel skeleton stock-loading-action" />
                  <div className="panel skeleton stock-loading-activity" />
                </div>
              </>
            )}
            <span className="sr-only">Memuat ringkasan Consumable Room…</span>
          </div>
        )}
      </section>
    );
  const total = data.series.reduce((sum, q) => sum + kinds.reduce((v, key) => v + q[key], 0), 0);
  const counted = data.operational - data.uncounted,
    percent = data.operational ? (counted / data.operational) * 100 : 0;
  const action =
    identity && canConsume(identity, 'receive')
      ? { label: 'Penerimaan Picklist', href: '/consumables/picklist', icon: 'receipt' as const }
      : identity && canConsume(identity, 'issue')
        ? { label: 'Consume Order', href: '/consumables/consume', icon: 'issue' as const }
        : { label: 'Cari material', href: '/consumables/stock', icon: 'box' as const };
  const metrics = [
    ['Material dikelola', data.operational],
    ['Tersedia', data.available],
    ['Stok nol', data.empty],
  ] as const;
  if (compact)
    return (
      <ApplicationSummary
        className="stock-summary is-compact"
        title="Consumable Room"
        icon="box"
        href="/consumables"
        metrics={metrics}
        readOnly={identity?.grants.find((g) => g.appId === 'consumables')?.role === 'viewer'}
      >
        <StockActivity items={data.recent} compact />
      </ApplicationSummary>
    );
  return (
    <section
      className={`stock-summary ${compact ? 'is-compact' : ''}`}
      aria-label="Ringkasan Consumable Room"
      aria-busy={busy}
    >
      {error && (
        <div className="notice error stock-refresh-error" role="alert">
          <span>{error}</span>
          <Button className="secondary" onClick={() => setReload((v) => v + 1)}>
            Coba lagi
          </Button>
        </div>
      )}
      <div className="dashboard-grid stock-dashboard">
        <div className="dashboard-main">
          <section className="panel hero-chart-card">
            <div className="chart-panel">
              <div className="section-head">
                <div>
                  <h2 className="stock-chart-title">
                    Aktivitas material{' '}
                    <span className="chart-info" tabIndex={0} aria-label="Cara menghitung transaksi">
                      <Icon name="info" />
                      <span role="tooltip">
                        Order dihitung per dokumen; saldo awal dan koreksi per pencatatan. Jumlah dengan
                        satuan berbeda tidak dijumlahkan. KPI stok menunjukkan kondisi saat ini.
                        {data.legacyMovementCount > 0
                          ? ` ${n(data.legacyMovementCount)} transaksi v1 tersedia di Pergerakan stok.`
                          : ''}
                      </span>
                    </span>
                  </h2>
                  <span className="display-xl">
                    <AnimatedNumber value={total} />
                    <small> transaksi</small>
                  </span>
                </div>
                <label className="sr-label">
                  Tahun
                  <Select
                    aria-label="Tahun transaksi stok"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  >
                    {Array.from({ length: data.currentYear - 1999 }, (_, i) => data.currentYear - i).map(
                      (y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ),
                    )}
                  </Select>
                </label>
              </div>
              <p className="muted">Per kuartal berdasarkan waktu pencatatan (WIB).</p>
              <QuarterlyChart
                year={data.year}
                quarters={data.series.map((q) => ({
                  quarter: q.quarter,
                  values: kinds.map((key) => q[key]),
                }))}
                series={series}
                active={active}
                onSelect={setActive}
              />
              <p className="fine">
                {busy
                  ? `Memuat tahun ${year}…`
                  : data.year === data.currentYear
                    ? 'Tahun berjalan: data sampai saat ini.'
                    : `Data tahun kalender ${data.year}.`}
              </p>
            </div>
            <div className="kpi-rail">
              <p className="fine">Kondisi saat ini</p>
              {metrics.map(([label, value]) => (
                <div className="metric-block" key={label}>
                  <span>{label}</span>
                  <strong>
                    <AnimatedNumber value={value} />
                  </strong>
                </div>
              ))}
            </div>
          </section>
          <div className="dashboard-row two-columns stock-followups">
            <section className="panel">
              <div className="section-head">
                <h2>Saldo awal belum dihitung</h2>
                <Icon name="box" />
              </div>
              <p className="stock-counted">
                <strong>{n(data.uncounted)}</strong>
                <span>material menunggu hitung fisik</span>
              </p>
              <div
                className="progress-track"
                role="progressbar"
                aria-label="Saldo awal telah dihitung"
                aria-valuenow={counted}
                aria-valuemin={0}
                aria-valuemax={data.operational || 1}
                aria-valuetext={
                  data.operational
                    ? `${n(counted)} dari ${n(data.operational)} material dikelola`
                    : 'Belum ada material operasional'
                }
              >
                <i style={{ transform: `scaleX(${percent / 100})` }} />
              </div>
              <p className="fine">
                {data.operational
                  ? `${percent.toLocaleString('id-ID', { maximumFractionDigits: 1 })}% material dikelola telah dikonfirmasi.`
                  : 'Daftarkan material ke stok R22 untuk mulai menghitung stok.'}
              </p>
              <a className="stock-inline-link" href="/consumables/stock?availability=uncounted">
                Lihat yang belum dihitung <Icon name="arrow" />
              </a>
            </section>
            <section className="panel">
              <div className="section-head">
                <h2>Perlu perhatian</h2>
                <Icon name="info" />
              </div>
              <div className="stock-attention">
                <a href="/consumables/stock?availability=critical">
                  <span>Kritis, stok nol</span>
                  <strong className={data.criticalEmpty ? 'stock-warning-value' : ''}>
                    {n(data.criticalEmpty)}
                  </strong>
                  <small>Saldo nol terkonfirmasi</small>
                </a>
              </div>
              {identity && canConsume(identity, 'manage') && (
                <a className="stock-inline-link" href="/consumables/manage">
                  Kelola daftar stok <Icon name="arrow" />
                </a>
              )}
            </section>
          </div>
        </div>
        <aside className="dashboard-rail stock-rail" aria-label="Aksi dan aktivitas material">
          <section className="panel stock-action-card">
            <h2>Aksi cepat</h2>
            <a className="button primary" href={action.href}>
              {action.label}
              <Icon name="arrow" />
            </a>
            {action.href !== '/consumables/stock' && (
              <a href="/consumables/stock">
                Cari material
                <Icon name="chevron" />
              </a>
            )}
            <a href="/consumables/history">
              Riwayat material
              <Icon name="chevron" />
            </a>
          </section>
          <StockActivity items={data.recent} />
        </aside>
      </div>
    </section>
  );
}
