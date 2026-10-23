'use client';
import { countScale } from './chart-scale';
export type ChartSeries = { key: string; label: string; color: string; hatch?: boolean };
export type ChartQuarter = { quarter: number; values: number[] };
const number = (n: number) => n.toLocaleString('id-ID');
const ranges = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Okt–Des'];

export function QuarterlyChart({
  year,
  quarters,
  series,
  active,
  onSelect,
}: {
  year: number;
  quarters: ChartQuarter[];
  series: ChartSeries[];
  active: number;
  onSelect: (index: number) => void;
}) {
  const totals = quarters.map((q) => q.values.reduce((a, b) => a + b, 0));
  const scale = countScale(Math.max(0, ...totals));
  const selected = quarters[active] ?? quarters[0];
  return (
    <>
      <div className="chart-legend" aria-label="Jenis transaksi">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </div>
      <div className="quarter-count-label">Jumlah transaksi</div>
      <div className="quarter-chart" role="group" aria-label={`Jumlah transaksi tahun ${year} per kuartal`}>
        <div className="quarter-grid" aria-hidden="true">
          {scale.ticks.map((tick) => (
            <div key={tick} style={{ top: `${100 - (tick / scale.maximum) * 100}%` }}>
              <span>{number(tick)}</span>
            </div>
          ))}
        </div>
        <div className="quarter-plot">
          {quarters.map((q, i) => {
            let bottom = 0;
            return (
              <button
                key={q.quarter}
                type="button"
                className="quarter-slot"
                aria-pressed={active === i}
                aria-label={`Q${q.quarter} ${year}: ${number(totals[i])} transaksi`}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'mouse') onSelect(i);
                }}
                onFocus={() => onSelect(i)}
                onClick={() => onSelect(i)}
                onKeyDown={(e) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
                  e.preventDefault();
                  const next =
                    e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? quarters.length - 1
                        : (i + (e.key === 'ArrowLeft' ? -1 : 1) + quarters.length) % quarters.length;
                  (e.currentTarget.parentElement!.children[next] as HTMLButtonElement).focus();
                }}
              >
                <span className="quarter-stack" aria-hidden="true">
                  {q.values.map((value, j) => {
                    const start = bottom;
                    bottom += value;
                    return value === 0 ? null : (
                      <i
                        key={series[j].key}
                        className={active === i && series[j].hatch ? 'hatched' : undefined}
                        style={{
                          bottom: `${(start / scale.maximum) * 100}%`,
                          height: `${(value / scale.maximum) * 100}%`,
                          background: active === i ? series[j].color : 'var(--placeholder)',
                        }}
                      />
                    );
                  })}
                </span>
              </button>
            );
          })}
        </div>
        {!totals.some(Boolean) && <span className="quarter-empty">Belum ada transaksi pada tahun ini.</span>}
      </div>
      <div className="quarter-labels" aria-hidden="true">
        {quarters.map((q, i) => (
          <span key={q.quarter}>
            <strong>Q{q.quarter}</strong>
            <small>{number(totals[i])} transaksi</small>
          </span>
        ))}
      </div>
      <div className="chart-tooltip quarter-details" aria-live="polite" aria-atomic="true">
        <span>
          Q{selected.quarter} {year} · {ranges[selected.quarter - 1]}
        </span>
        <strong>{number(totals[active] ?? totals[0])} transaksi</strong>
        <div>
          {series.map((s, j) => (
            <small key={s.key}>
              {s.label}
              <b>{number(selected.values[j])}</b>
            </small>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Jumlah transaksi per kuartal tahun {year}</caption>
        <thead>
          <tr>
            <th>Kuartal</th>
            {series.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {quarters.map((q) => (
            <tr key={q.quarter}>
              <th>Q{q.quarter}</th>
              {q.values.map((v, i) => (
                <td key={series[i].key}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
