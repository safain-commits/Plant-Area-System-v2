'use client';
import { useEffect, useState, useRef } from 'react';
import { ageStops, bagBrands, formatDate } from '@plant/contracts';
import { Select } from './fields';
import { Icon } from './icon';
type Data = {
  serverTime: string;
  days: number;
  total: number;
  installed: number;
  neverInstalled: number;
  older900: number;
  distribution: number[];
  perEquipment: { code: string; total: number; installed: number; older900: number }[];
  series: { date: string; total: number; brands: Record<string, number> }[];
  periodTotal: number;
  previousTotal: number;
  recent: {
    id: string;
    equipmentCode: string;
    wo: string;
    reason: string;
    brand: string | null;
    actorName: string;
    positionCount: number;
    createdAt: string;
  }[];
};
const n = (v: number) => v.toLocaleString('id-ID');
const brandColors = [
  'var(--primary-500)',
  'var(--highlight)',
  'var(--primary-200)',
  'var(--primary-700)',
  'var(--placeholder)',
];
export function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value),
    previous = useRef(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    const from = previous.current;
    previous.current = value;
    const start = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const f = Math.min(1, (time - start) / 600);
      setDisplay(Math.round(from + (value - from) * (1 - (1 - f) ** 3)));
      if (f < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <span className="animated-number" aria-label={n(value)}>
      {n(display)}
    </span>
  );
}
export function Dashboard() {
  const [days, setDays] = useState(7),
    [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(true),
    [active, setActive] = useState(-1);
  const [selectedEquipment, setSelectedEquipment] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setBusy(true);
    setError('');
    void fetch(`/bag-filter/api/dashboard?days=${days}`, { cache: 'no-store', signal: abort.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || 'Ringkasan belum dapat dimuat.');
        return d;
      })
      .then((d) => {
        setData(d);
        setActive(d.series.length - 1);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setError(e.message);
          setData(null);
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, [days, revision]);
  if (error)
    return (
      <section className="panel dashboard-error">
        <Icon name="info" />
        <h2>Ringkasan belum tersedia</h2>
        <p className="muted">{error}</p>
        <button className="secondary" onClick={() => setRevision((v) => v + 1)}>
          Coba lagi
        </button>
      </section>
    );
  if (!data)
    return (
      <div className="dashboard-skeleton" aria-label="Memuat ringkasan" role="status">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="panel skeleton" key={i} />
        ))}
      </div>
    );
  const percent = data.total ? (data.installed / data.total) * 100 : 0,
    max = Math.max(4, Math.ceil(Math.max(...data.series.map((s) => s.total)) / 4) * 4),
    slot = data.series[Math.max(0, active)],
    featured = data.perEquipment[selectedEquipment % Math.max(1, data.perEquipment.length)];
  const brandNames = [...bagBrands, 'Belum tercatat'];
  return (
    <div className="dashboard-grid" aria-busy={busy}>
      <div className="dashboard-main">
        <section className="panel hero-chart-card">
          <div className="chart-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">PEMASANGAN BAG</p>
                <strong className="display-xl">
                  <AnimatedNumber value={data.periodTotal} />
                  <small> bag</small>
                </strong>
                <p className="muted">Berdasarkan tanggal pemasangan (WIB)</p>
              </div>
              <label className="sr-label">
                Periode grafik
                <Select
                  aria-label="Periode grafik"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                >
                  <option value="7">7 hari</option>
                  <option value="30">30 hari</option>
                </Select>
              </label>
            </div>
            <div className="chart-legend">
              {brandNames.map((name, i) => (
                <span key={name}>
                  <i style={{ background: brandColors[i] }} />
                  {name}
                </span>
              ))}
            </div>
            <div
              className="bar-chart"
              role="figure"
              aria-label={`Pemasangan ${days} hari: ${data.periodTotal} bag`}
            >
              <div className="chart-grid-lines">
                {[1, 0.75, 0.5, 0.25, 0].map((v) => (
                  <span key={v}>
                    <small>{n(Math.round(max * v))}</small>
                  </span>
                ))}
              </div>
              <div className="bar-slots">
                {data.series.map((day, i) => (
                  <button
                    type="button"
                    key={day.date}
                    className={`bar-slot${i === active ? ' is-active' : ''}`}
                    aria-label={`${day.date}: ${day.total} bag`}
                    aria-pressed={i === active}
                    onPointerEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onClick={() => setActive(i)}
                  >
                    <span className="bar-stack">
                      {day.total ? (
                        brandNames
                          .filter((name) => day.brands[name])
                          .map((name) => (
                            <i
                              key={name}
                              className={i === active ? 'hatched' : ''}
                              style={{
                                height: `${(day.brands[name] / max) * 100}%`,
                                background:
                                  i === active ? brandColors[brandNames.indexOf(name)] : 'var(--placeholder)',
                              }}
                            />
                          ))
                      ) : (
                        <i className="empty-bar" />
                      )}
                    </span>
                    <small>{days === 7 || i % 5 === 0 ? day.date.slice(8) : '·'}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="chart-tooltip" aria-live="polite">
              <span>{slot?.date}</span>
              <strong>{n(slot?.total || 0)} bag</strong>
              {slot &&
                Object.entries(slot.brands).map(([brand, count]) => (
                  <small key={brand}>
                    {brand} <b>{n(count)}</b>
                  </small>
                ))}
            </div>
            {!data.periodTotal && <p className="fine">Belum ada pemasangan pada periode ini.</p>}
            <p className="trend-row">
              {data.previousTotal ? (
                <>
                  <Icon name="arrow" />
                  <span
                    className={data.periodTotal >= data.previousTotal ? 'positive-text' : 'negative-text'}
                  >
                    {data.periodTotal >= data.previousTotal ? '↑' : '↓'}{' '}
                    {Math.abs(((data.periodTotal - data.previousTotal) / data.previousTotal) * 100).toFixed(
                      1,
                    )}
                    %
                  </span>{' '}
                  dari periode sebelumnya
                </>
              ) : (
                'Belum ada pembanding pada periode sebelumnya.'
              )}
            </p>
          </div>
          <div className="kpi-rail">
            {[
              ['Total posisi', data.total],
              ['Belum tercatat', data.neverInstalled],
              ['Umur ≥ 900 hari', data.older900],
            ].map(([label, value]) => (
              <article className="metric-block" key={label}>
                <span>{label}</span>
                <strong className={label === 'Umur ≥ 900 hari' ? 'negative-text' : ''}>
                  <AnimatedNumber value={Number(value)} />
                </strong>
                <small>Dalam cakupan Anda</small>
              </article>
            ))}
          </div>
        </section>
        <div className="dashboard-row two-columns">
          <section className="panel">
            <div className="section-head">
              <h2>Cakupan pemasangan</h2>
              <Icon name="grid" />
            </div>
            <strong className="display-lg">
              <AnimatedNumber value={data.installed} />
              <small> / {n(data.total)}</small>
            </strong>
            <div
              className="capacity-track"
              role="meter"
              aria-label="Posisi terpasang"
              aria-valuenow={data.installed}
              aria-valuemin={0}
              aria-valuemax={data.total || 1}
            >
              <span className="hatched" style={{ transform: `scaleX(${percent / 100})` }} />
            </div>
            <p className="fine">{percent.toFixed(1)}% posisi mempunyai catatan pemasangan aktif.</p>
          </section>
          <section className="panel tip-card">
            <div>
              <h2>Satu batch, banyak posisi</h2>
              <p>
                Pilih hingga 500 bag lintas kompartemen. Tanggal, pabrikan, alasan, dan WO berlaku untuk
                seluruh pilihan.
              </p>
              <a href={featured ? `/bag-filter/equipment/${featured.code.toLowerCase()}` : '/bag-filter'}>
                Buka peta <Icon name="chevron" />
              </a>
            </div>
            <div className="mosaic" aria-hidden="true">
              {Array.from({ length: 16 }, (_, i) => (
                <i key={i} className={i % 4 ? 'hatched' : ''} />
              ))}
            </div>
          </section>
        </div>
        <div className="dashboard-row three-columns">
          <section className="panel distribution-card">
            <h2>Distribusi umur</h2>
            <p className="fine">Bag terpasang saat ini</p>
            <div
              className="distribution-bar"
              role="img"
              aria-label={`Distribusi ${data.installed} bag terpasang`}
            >
              {data.installed ? (
                data.distribution.map((count, i) =>
                  count ? <span key={i} style={{ flex: count, background: ageStops[i].color }} /> : null,
                )
              ) : (
                <span className="placeholder" />
              )}
            </div>
            <div className="distribution-legend">
              {ageStops.map((stop, i) => (
                <div key={stop.days}>
                  <i style={{ background: stop.color }} />
                  <span>
                    {stop.days}
                    {i === 6 ? '+' : `–${ageStops[i + 1].days - 1}`} hari
                  </span>
                  <strong>{n(data.distribution[i])}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="panel gauge-card">
            <h2>Posisi terpasang</h2>
            <svg
              viewBox="0 0 240 150"
              role="img"
              aria-label={`${percent.toFixed(1)} persen posisi terpasang`}
            >
              <defs>
                <linearGradient id="coverage-gradient">
                  <stop stopColor="var(--highlight)" />
                  <stop offset=".45" stopColor="var(--primary-300)" />
                  <stop offset="1" stopColor="var(--primary-500)" />
                </linearGradient>
                <pattern
                  id="coverage-hatch"
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <path d="M0 0v6" stroke="white" strokeOpacity=".22" strokeWidth="1.5" />
                </pattern>
              </defs>
              <path
                d="M30 120a90 90 0 0 1 180 0"
                fill="none"
                stroke="var(--placeholder)"
                strokeWidth="30"
                pathLength="100"
                strokeDasharray="23.5 2"
              />
              <path
                d="M30 120a90 90 0 0 1 180 0"
                fill="none"
                stroke="url(#coverage-gradient)"
                strokeWidth="30"
                pathLength="100"
                strokeDasharray={`${percent} 100`}
              />
              <path
                d="M30 120a90 90 0 0 1 180 0"
                fill="none"
                stroke="url(#coverage-hatch)"
                strokeWidth="30"
                pathLength="100"
                strokeDasharray={`${percent} 100`}
              />
            </svg>
            <strong className="display-md">{percent.toFixed(1)}%</strong>
            <p className="fine">
              {n(data.installed)} dari {n(data.total)} posisi
            </p>
          </section>
          <section className="panel progress-card">
            <h2>Per equipment</h2>
            <div className="progress-list">
              {data.perEquipment.map((e) => (
                <a href={`/bag-filter/equipment/${e.code.toLowerCase()}`} key={e.code}>
                  <div>
                    <strong>{e.code}</strong>
                    <span>
                      {n(e.installed)} <small>/ {n(e.total)}</small>
                    </span>
                  </div>
                  <div className="progress-track">
                    <i className="hatched" style={{ transform: `scaleX(${e.installed / e.total})` }} />
                  </div>
                  <small>{((e.installed / e.total) * 100).toFixed(1)}% tercatat</small>
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
      <aside className="dashboard-rail">
        <section
          className="feature-widget"
          onPointerMove={(e) => {
            if (matchMedia('(prefers-reduced-motion: reduce)').matches || e.pointerType !== 'mouse') return;
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.transform = `perspective(800px) rotateY(${((e.clientX - r.left - r.width / 2) / r.width) * 4}deg) rotateX(${(-(e.clientY - r.top - r.height / 2) / r.height) * 4}deg)`;
          }}
          onPointerLeave={(e) => (e.currentTarget.style.transform = '')}
        >
          <p className="eyebrow">EQUIPMENT PROCESS</p>
          <div className="feature-contours" aria-hidden="true" />
          <h2>{featured?.code || 'Bag Filter'}</h2>
          <strong className="display-xl">{n(featured?.total || 0)}</strong>
          <p>posisi bag</p>
          <a href={featured ? `/bag-filter/equipment/${featured.code.toLowerCase()}` : '/bag-filter'}>
            Buka peta <Icon name="arrow" />
          </a>
          {data.perEquipment.length > 1 && (
            <button
              className="icon-button ghost"
              aria-label="Equipment berikutnya"
              onClick={() => setSelectedEquipment((v) => v + 1)}
            >
              <Icon name="chevron" />
            </button>
          )}
        </section>
        <section className="panel recent-card">
          <div className="section-head">
            <h2>Aktivitas terbaru</h2>
            <Icon name="clock" />
          </div>
          <div className="activity-scroll">
            {data.recent.length ? (
              data.recent.map((item) => (
                <a
                  key={item.id}
                  className="activity-row"
                  href={`/bag-filter/equipment/${item.equipmentCode.toLowerCase()}?batch=${item.id}`}
                >
                  <span className="app-icon">
                    <Icon name="grid" />
                  </span>
                  <span>
                    <strong>{item.wo || 'Tanpa WO'}</strong>
                    <small>
                      {item.equipmentCode} · {item.brand || 'Belum tercatat'}
                    </small>
                    <small>{item.actorName}</small>
                    <small>{formatDate(item.createdAt)} WIB</small>
                  </span>
                  <strong>
                    {n(item.positionCount)}
                    <small>bag</small>
                  </strong>
                </a>
              ))
            ) : (
              <div className="empty">
                <Icon name="clock" />
                <p>Belum ada aktivitas batch.</p>
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
