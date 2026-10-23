'use client';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ageHours,
  ageStops,
  ageBucket,
  bagColor,
  bagBrands,
  type BagBrand,
  displayCompartment,
  equipmentSideSummary,
  rowOrder,
  rowDividerBefore,
  formatDate,
  positionKey,
  positionLabel,
  wibInput,
  wibToIso,
  type Equipment,
  type Position,
} from '@plant/contracts';
import {
  Heading,
  dataTextTone,
  Overlay,
  Toast,
  Select,
  Input,
  Textarea,
  DateTimeField,
  Icon,
  Button,
} from '@plant/ui';
type Installed = Position & { id: string; batchId: string; installedAt: string; brand: string | null };
type Snapshot = {
  equipment: Equipment;
  positions: Installed[];
  recorded: number;
  total: number;
  serverTime: string;
};
type Batch = {
  brand: BagBrand | null;
  id: string;
  installedAt: string;
  createdAt: string;
  reason: string;
  wo: string;
  actorName: string;
  positionCount: number;
  positions: Position[];
};
type TimelineItem = {
  brand: BagBrand | null;
  id: string;
  installedAt: string;
  endedAt: string | null;
  createdAt: string;
  reason: string;
  wo: string;
  actorName: string;
};
type Page<T> = { items: T[]; nextCursor: string | null };
async function read<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { cache: 'no-store', signal });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || 'Data belum dapat dimuat.');
  return d;
}
export default function BagMonitor({
  initial,
  writable,
  initialBatch = '',
}: {
  initial: Snapshot;
  writable: boolean;
  initialBatch?: string;
}) {
  const [data, setData] = useState(initial),
    [now, setNow] = useState(() => Date.parse(initial.serverTime));
  const eq = data.equipment,
    letters = eq.columns,
    base = `/bag-filter/api/equipment/${eq.code}`;
  const [side, setSide] = useState<Position['side']>(eq.sides[0].name),
    [compartment, setCompartment] = useState(1),
    [selected, setSelected] = useState<Position[]>([]),
    [focused, setFocused] = useState<Position | null>(null);
  const [installedAt, setInstalledAt] = useState(() => wibInput(Date.parse(initial.serverTime))),
    [reason, setReason] = useState(''),
    [brand, setBrand] = useState<BagBrand | ''>(''),
    [wo, setWo] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [revision, setRevision] = useState(0);
  const [search, setSearch] = useState(initialBatch),
    [history, setHistory] = useState<Page<Batch>>({ items: [], nextCursor: null }),
    [historyBusy, setHistoryBusy] = useState(false),
    [historyError, setHistoryError] = useState('');
  const [timeline, setTimeline] = useState<Page<TimelineItem>>({ items: [], nextCursor: null }),
    [timelineBusy, setTimelineBusy] = useState(false),
    [timelineError, setTimelineError] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false),
    [bucket, setBucket] = useState<number | 'empty' | null>(null);
  const [hovered, setHovered] = useState<{ position: Position; x: number; y: number } | null>(null),
    [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const anchorSelection = useRef<Position | null>(null),
    drag = useRef<{ x: number; y: number; active: boolean; base: Position[] } | null>(null),
    suppressClick = useRef(false);
  const retry = useRef<{ key: string; payload: string } | null>(null);
  const latest = useMemo(() => new Map(data.positions.map((p) => [positionKey(p), p])), [data.positions]);
  const selectedKeys = useMemo(() => new Set(selected.map(positionKey)), [selected]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const reload = useCallback(async () => {
    const result = await read<Snapshot>(`${base}/state`);
    setData(result);
    setNow(Date.parse(result.serverTime));
    setRevision((r) => r + 1);
  }, [base]);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setHistoryBusy(true);
      setHistoryError('');
      void read<Page<Batch>>(`${base}/batches?q=${encodeURIComponent(search)}`, abort.signal)
        .then(setHistory)
        .catch((e) => {
          if (e.name !== 'AbortError') setHistoryError(e.message);
        })
        .finally(() => {
          if (!abort.signal.aborted) setHistoryBusy(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [base, search, revision]);
  const timelineUrl = useCallback(
    (p: Position, cursor?: string | null) =>
      `${base}/positions?${new URLSearchParams({ side: p.side, compartment: String(p.compartment), column: String(p.column), row: String(p.row), ...(cursor ? { cursor } : {}) })}`,
    [base],
  );
  useEffect(() => {
    if (!focused) {
      setTimeline({ items: [], nextCursor: null });
      return;
    }
    const abort = new AbortController();
    setTimelineBusy(true);
    setTimelineError('');
    setTimeline({ items: [], nextCursor: null });
    void read<Page<TimelineItem>>(timelineUrl(focused), abort.signal)
      .then(setTimeline)
      .catch((e) => {
        if (e.name !== 'AbortError') setTimelineError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setTimelineBusy(false);
      });
    return () => abort.abort();
  }, [focused, timelineUrl, revision]);
  function focus(p: Position) {
    setSide(p.side);
    setCompartment(p.compartment);
    setFocused(p);
  }
  function selectRange(p: Position) {
    const anchor = anchorSelection.current;
    if (!anchor || anchor.side !== p.side || anchor.compartment !== p.compartment) {
      anchorSelection.current = p;
      return [p];
    }
    const positions = rowOrder(eq, p.side).flatMap((row) =>
      Array.from({ length: 8 }, (_, c) => ({ ...p, column: c + 1, row })),
    );
    const a = positions.findIndex((v) => positionKey(v) === positionKey(anchor)),
      b = positions.findIndex((v) => positionKey(v) === positionKey(p));
    return positions.slice(Math.min(a, b), Math.max(a, b) + 1);
  }
  function addPositions(items: Position[], base = selected) {
    const merged = new Map([...base, ...items].map((p) => [positionKey(p), p]));
    if (merged.size > 500) {
      setError('Maksimal 500 posisi untuk satu penyimpanan.');
      return;
    }
    setSelected([...merged.values()]);
  }
  function cellKey(e: React.KeyboardEvent<HTMLButtonElement>, p: Position) {
    if ([' ', 'Enter'].includes(e.key)) {
      e.preventDefault();
      toggle(p, e);
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const rows = rowOrder(eq, p.side),
      index = rows.indexOf(p.row);
    const next = {
      ...p,
      column: Math.min(
        8,
        Math.max(1, p.column + (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0)),
      ),
      row: rows[
        Math.min(
          rows.length - 1,
          Math.max(0, index + (e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0)),
        )
      ],
    };
    if (e.shiftKey && writable && !busy) {
      if (!anchorSelection.current) anchorSelection.current = p;
      addPositions(selectRange(next));
    }
    focus(next);
    document
      .querySelector<HTMLButtonElement>('.bag-cell[data-position-key="' + positionKey(next) + '"]')
      ?.focus();
  }
  function hover(p: Position, el: HTMLElement) {
    clearTimeout(hoverTimer.current);
    const r = el.getBoundingClientRect();
    const target = {
      position: p,
      x: Math.max(8, Math.min(innerWidth - 280, r.right + 8)),
      y: Math.max(8, Math.min(innerHeight - 140, r.top - 16)),
    };
    if (Date.now() < hoverWarmUntil.current) setHovered(target);
    else hoverTimer.current = setTimeout(() => setHovered(target), 280);
  }
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    hoverWarmUntil = useRef(0);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  function leaveHover() {
    clearTimeout(hoverTimer.current);
    if (hovered) hoverWarmUntil.current = Date.now() + 600;
    setHovered(null);
  }
  function toggle(p: Position, event?: { shiftKey: boolean }) {
    if (busy || suppressClick.current) return;
    focus(p);
    if (!writable) return;
    if (event?.shiftKey) {
      addPositions(selectRange(p));
      return;
    }
    anchorSelection.current = p;
    const key = positionKey(p);
    setSelected((previous) => {
      if (previous.some((item) => positionKey(item) === key))
        return previous.filter((item) => positionKey(item) !== key);
      if (previous.length === 500) {
        setError('Maksimal 500 posisi untuk satu penyimpanan.');
        return previous;
      }
      return [...previous, p];
    });
  }
  function showComp(nextSide: Position['side'], nextComp: number) {
    setSide(nextSide);
    setCompartment(nextComp);
    setFocused(null);
    document.getElementById('bag-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selected.length) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = JSON.stringify({
        equipmentCode: eq.code,
        positions: [...selected].sort((a, b) => positionKey(a).localeCompare(positionKey(b))),
        installedAt: wibToIso(installedAt),
        reason,
        wo,
        brand,
      });
      if (retry.current?.payload !== payload) retry.current = { key: crypto.randomUUID(), payload };
      const response = await fetch(`${base}/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': retry.current.key },
        body: payload,
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Penggantian gagal disimpan.');
      setNotice(
        `${result.count} posisi tersimpan dalam satu batch${result.replayed ? ' (permintaan sebelumnya sudah tersimpan)' : ''}.`,
      );
      setSheetOpen(false);
      setSelected([]);
      setReason('');
      setBrand('');
      setWo('');
      setInstalledAt(wibInput());
      retry.current = null;
      try {
        await reload();
      } catch {
        setError('Penyimpanan berhasil, tetapi tampilan belum diperbarui. Muat ulang data.');
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Jaringan terputus. Coba simpan kembali dengan data yang sama.',
      );
    } finally {
      setBusy(false);
    }
  }
  const currentComp = displayCompartment({ side, compartment }, eq);
  return (
    <>
      <nav className="breadcrumbs">
        <a href="/">Portal</a>
        <span>/</span>
        <a href="/bag-filter">Bag Filter</a>
        <span>/</span>
        <strong>{eq.code}</strong>
      </nav>
      <Heading
        eyebrow="EQUIPMENT PROCESS / BAG FILTER"
        title={eq.code}
        description="Peta umur bag cloth, penggantian, dan riwayat per posisi."
      >
        <span className="badge">Data aktual</span>
      </Heading>
      {error && (
        <div className="notice error" role="alert">
          {error}{' '}
          <button
            className="small secondary"
            onClick={() =>
              void reload()
                .then(() => setError(''))
                .catch((e) => setError(e.message))
            }
          >
            Muat ulang data
          </button>
        </div>
      )}
      <Toast message={notice} onDismiss={() => setNotice('')} />
      <div className="stats">
        <article className="stat">
          <span>KOMPARTEMEN</span>
          <strong>{eq.compartments}</strong>
          <small>{equipmentSideSummary(eq)}</small>
        </article>
        <article className="stat">
          <span>SKALA UMUR BAG</span>
          <strong>
            0–900 <small>hari</small>
          </strong>
          <small>Berjalan 24 jam sehari</small>
        </article>
        <article className="stat">
          <span>POSISI TERCATAT</span>
          <strong>
            {data.recorded.toLocaleString('id-ID')} <small>/ {data.total.toLocaleString('id-ID')}</small>
          </strong>
          <small>Bag dengan data pemasangan</small>
        </article>
      </div>
      <section className="panel overview-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">{eq.code} / SELURUH EQUIPMENT</p>
            <h2>Peta kompartemen</h2>
          </div>
          <span className="badge">{eq.compartments} comp.</span>
        </div>
        <div className="age-legend" aria-label="Filter umur bag">
          <div className="age-gradient" />
          <div className="age-buckets">
            {ageStops.map((stop, i) => (
              <button
                type="button"
                key={stop.days}
                aria-pressed={bucket === i}
                onClick={() => setBucket((v) => (v === i ? null : i))}
              >
                <i style={{ background: stop.color }} />
                {stop.days}
                {i === 6 ? '+' : '–' + (ageStops[i + 1].days - 1)} hari
              </button>
            ))}
            <button
              type="button"
              aria-pressed={bucket === 'empty'}
              onClick={() => setBucket((v) => (v === 'empty' ? null : 'empty'))}
            >
              <i style={{ background: 'var(--empty-bag)' }} />
              Belum tercatat
            </button>
          </div>
        </div>
        {eq.sides.map(({ name: band }, index) => (
          <div
            className="overview-band"
            aria-label={`Sisi ${band}`}
            key={band}
            style={{ gridTemplateColumns: `repeat(${eq.perSide},minmax(0,1fr))` }}
          >
            {Array.from({ length: eq.perSide }, (_, i) => {
              const local = i + 1,
                display = displayCompartment({ side: band, compartment: local }, eq);
              return (
                <div className="overview-compartment" key={local}>
                  {index === 1 && (
                    <button
                      className="overview-title"
                      aria-label={`Buka detail kompartemen ${display}`}
                      onClick={() => showComp(band, local)}
                    >
                      <span className="overview-title-full">Comp. </span>
                      {display}
                    </button>
                  )}
                  {eq.centeredLabels && index === 1 && (
                    <div className="overview-labels">
                      <span />
                      {letters.split('').map((letter) => (
                        <span key={letter}>{letter}</span>
                      ))}
                    </div>
                  )}
                  <div className="overview-matrix">
                    {rowOrder(eq, band).map((row) => {
                      return (
                        <div
                          className={`overview-line${rowDividerBefore(eq, band, row) ? ' overview-stiffener' : ''}`}
                          key={row}
                        >
                          <span className="overview-row-number">{row}</span>
                          {Array.from({ length: 8 }, (_, c) => {
                            const p = { side: band, compartment: local, column: c + 1, row },
                              key = positionKey(p),
                              age = ageHours(latest.get(key)?.installedAt || null, now),
                              picked = selectedKeys.has(key);
                            return (
                              <button
                                key={c}
                                className={`overview-cell${age !== null && age >= 21600 ? ' is-old' : ''}`}
                                data-position-key={key}
                                tabIndex={-1}
                                style={{
                                  background: bagColor(age),
                                  opacity:
                                    bucket === null ||
                                    (bucket === 'empty'
                                      ? age === null
                                      : age !== null && ageBucket(age) === bucket)
                                      ? 1
                                      : 0.25,
                                }}
                                aria-label={`${display} ${letters[c]}${row}`}
                                onPointerEnter={(e) => hover(p, e.currentTarget)}
                                onPointerLeave={leaveHover}
                                aria-pressed={picked}
                                onClick={(event) => toggle(p, event)}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                  {(!eq.centeredLabels || index === 0) && (
                    <div className="overview-labels">
                      <span />
                      {letters.split('').map((letter) => (
                        <span key={letter}>{letter}</span>
                      ))}
                    </div>
                  )}
                  {index === 0 && (
                    <button
                      className="overview-title"
                      aria-label={`Buka detail kompartemen ${display}`}
                      onClick={() => showComp(band, local)}
                    >
                      <span className="overview-title-full">Comp. </span>
                      {display}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {eq.rowDividerAfter !== null && (
          <p className="fine">
            Jeda visual antara baris {eq.rowDividerAfter} dan {eq.rowDividerAfter + 1}.
          </p>
        )}
        <p className="fine">
          Pilih nomor kompartemen untuk membuka detail. Pilihan lintas kompartemen tersimpan dalam satu
          pekerjaan.
        </p>
      </section>
      <div className="bag-layout">
        <section className="panel" id="bag-detail">
          <div className="section-head">
            <div>
              <p className="eyebrow">PETA BAG CLOTH</p>
              <h2>Detail Comp. {currentComp}</h2>
            </div>
            <span className="badge">{side}</span>
          </div>
          <div className="form-grid">
            <label>
              Sisi
              <Select
                aria-label="Sisi"
                value={side}
                onChange={(e) => {
                  setSide(e.target.value as Position['side']);
                  setFocused(null);
                }}
              >
                {eq.sides.map((s) => (
                  <option key={s.name}>{s.name}</option>
                ))}
              </Select>
            </label>
            <label>
              Kompartemen
              <Select
                aria-label="Kompartemen"
                value={compartment}
                onChange={(e) => {
                  setCompartment(Number(e.target.value));
                  setFocused(null);
                }}
              >
                {Array.from({ length: eq.perSide }, (_, i) => (
                  <option key={i} value={i + 1}>
                    Comp. {displayCompartment({ side, compartment: i + 1 }, eq)}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <div className="bag-grid-scroll">
            <div
              className="bag-grid"
              role="group"
              aria-label={`Detail kompartemen ${currentComp}`}
              onPointerDown={(e) => {
                if (writable && !busy && e.pointerType === 'mouse' && e.button === 0)
                  drag.current = { x: e.clientX, y: e.clientY, active: false, base: selected };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d) return;
                if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) {
                  d.active = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const rect = {
                    x: Math.min(d.x, e.clientX),
                    y: Math.min(d.y, e.clientY),
                    width: Math.abs(e.clientX - d.x),
                    height: Math.abs(e.clientY - d.y),
                  };
                  setMarquee(rect);
                  const cells = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.bag-cell'));
                  const picked = cells
                    .filter((el) => {
                      const r = el.getBoundingClientRect();
                      return (
                        r.right >= rect.x &&
                        r.left <= rect.x + rect.width &&
                        r.bottom >= rect.y &&
                        r.top <= rect.y + rect.height
                      );
                    })
                    .map((el) => ({
                      side,
                      compartment,
                      column: Number(el.dataset.column),
                      row: Number(el.dataset.row),
                    }));
                  addPositions(picked, d.base);
                }
              }}
              onPointerUp={(e) => {
                if (drag.current?.active) {
                  suppressClick.current = true;
                  setTimeout(() => {
                    suppressClick.current = false;
                  }, 0);
                }
                drag.current = null;
                setMarquee(null);
                if (e.currentTarget.hasPointerCapture(e.pointerId))
                  e.currentTarget.releasePointerCapture(e.pointerId);
              }}
              onPointerCancel={() => {
                drag.current = null;
                setMarquee(null);
              }}
            >
              <span />
              {letters.split('').map((letter) => (
                <span
                  className={`grid-label${hovered?.position.column === letters.indexOf(letter) + 1 ? ' is-hovered' : ''}`}
                  key={letter}
                >
                  {letter}
                </span>
              ))}
              {rowOrder(eq, side).map((row) => {
                return (
                  <Fragment key={row}>
                    {rowDividerBefore(eq, side, row) && (
                      <div
                        className="bag-stiffener"
                        role="separator"
                        aria-label={`Jeda antara baris ${eq.rowDividerAfter} dan ${eq.rowDividerAfter! + 1}`}
                      />
                    )}
                    <span
                      className={`grid-label row-number${hovered?.position.row === row ? ' is-hovered' : ''}`}
                    >
                      {row}
                    </span>
                    {Array.from({ length: 8 }, (_, c) => {
                      const p = { side, compartment, column: c + 1, row },
                        key = positionKey(p),
                        age = ageHours(latest.get(key)?.installedAt || null, now),
                        picked = selectedKeys.has(key);
                      return (
                        <button
                          key={c}
                          type="button"
                          className={`bag-cell${age === null ? ' is-empty' : age >= 21600 ? ' is-old' : ''}`}
                          data-position-key={key}
                          data-column={c + 1}
                          data-row={row}
                          tabIndex={
                            focused
                              ? positionKey(focused) === key
                                ? 0
                                : -1
                              : row === rowOrder(eq, side)[0] && c === 0
                                ? 0
                                : -1
                          }
                          onKeyDown={(e) => cellKey(e, p)}
                          onFocus={(e) => hover(p, e.currentTarget)}
                          onPointerEnter={(e) => hover(p, e.currentTarget)}
                          onPointerLeave={leaveHover}
                          onBlur={leaveHover}
                          style={{
                            background: bagColor(age),
                            color:
                              age === null
                                ? 'var(--textSecondary)'
                                : `var(--data-${dataTextTone(bagColor(age))})`,
                            opacity:
                              bucket === null ||
                              (bucket === 'empty' ? age === null : age !== null && ageBucket(age) === bucket)
                                ? 1
                                : 0.25,
                          }}
                          aria-pressed={picked}
                          aria-label={`Kolom ${letters[c]}, baris ${row}: ${age === null ? 'belum tercatat' : `${Math.floor(age / 24)} hari`}`}
                          onClick={(event) => toggle(p, event)}
                        >
                          {letters[c]}
                          {row}
                        </button>
                      );
                    })}
                  </Fragment>
                );
              })}
            </div>
          </div>
          <p className="fine" style={{ marginTop: 18 }}>
            Koordinat bag. Umur tersedia saat diarahkan.{' '}
            {writable ? 'Klik ulang untuk menghapus pilihan.' : 'Klik posisi untuk membaca riwayat.'}
          </p>
        </section>
        <div>
          <section className="panel">
            <p className="eyebrow">PENCATATAN PENGGANTIAN</p>
            <h2>{selected.length} posisi dipilih</h2>
            <p className="fine">
              Pilih bag di peta atau detail kompartemen. Maksimal 500 posisi per penyimpanan.
            </p>
            {writable ? (
              <button type="button" data-sheet-trigger onClick={() => setSheetOpen(true)}>
                <Icon name="plus" /> Catat penggantian
              </button>
            ) : (
              <p className="read-only">
                Anda dapat membaca status dan history equipment. Hak pencatatan diberikan oleh admin portal.
              </p>
            )}
          </section>
          <Overlay
            open={sheetOpen}
            onClose={() => {
              if (!busy) setSheetOpen(false);
            }}
            title="Pencatatan penggantian"
            kind="sheet"
          >
            {' '}
            <section className="installation-form">
              {error && (
                <p className="notice error" role="alert">
                  {error}
                </p>
              )}
              <p className="eyebrow">PENCATATAN PENGGANTIAN</p>
              <h2>{writable ? `${selected.length} posisi dipilih` : 'Akses baca'}</h2>
              {writable ? (
                <>
                  <div className="selected-list">
                    {selected.map((p) => (
                      <button
                        key={positionKey(p)}
                        disabled={busy}
                        onClick={(event) => toggle(p, event)}
                        aria-label={`Hapus ${positionLabel(p, eq)}`}
                      >
                        {positionLabel(p, eq)} ×
                      </button>
                    ))}
                    {selected.length > 0 && (
                      <button disabled={busy} onClick={() => setSelected([])}>
                        Bersihkan semua
                      </button>
                    )}
                  </div>
                  {!selected.length && (
                    <p className="fine">
                      Pilih bag di peta atau detail kompartemen. Maksimal 500 posisi per penyimpanan.
                    </p>
                  )}
                  <form className="form-stack" onSubmit={save}>
                    <label>
                      Tanggal & jam pemasangan (WIB)
                      <DateTimeField
                        type="datetime-local"
                        value={installedAt}
                        onChange={(e) => setInstalledAt(e.target.value)}
                        required
                        min="2000-01-01T00:00"
                        max={wibInput(now + 60000)}
                        disabled={busy}
                      />
                    </label>
                    <label>
                      Brand/Pabrikan
                      <Select
                        aria-label="Brand/Pabrikan"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value as BagBrand | '')}
                        required
                        disabled={busy}
                      >
                        <option value="" disabled>
                          Pilih Brand/Pabrikan
                        </option>
                        {bagBrands.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label>
                      Alasan penggantian / pemasangan awal
                      <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required
                        maxLength={500}
                        rows={2}
                        disabled={busy}
                        placeholder="Contoh: bag bocor atau pemasangan awal"
                      />
                    </label>
                    <label>
                      WO Number (opsional)
                      <Input
                        value={wo}
                        onChange={(e) => setWo(e.target.value)}
                        maxLength={100}
                        disabled={busy}
                      />
                    </label>
                    <Button className="accent" busy={busy} disabled={!selected.length}>
                      {`Simpan ${selected.length} bag`}
                    </Button>
                  </form>
                  <p className="fine" style={{ marginTop: 15, marginBottom: 0 }}>
                    Satu tanggal, Brand/Pabrikan, alasan, dan WO berlaku untuk seluruh posisi. Catatan yang
                    disimpan tidak dapat diubah pada rilis ini.
                  </p>
                </>
              ) : (
                <p className="read-only">
                  Anda dapat membaca status dan history equipment. Hak pencatatan diberikan oleh admin portal.
                </p>
              )}
            </section>
            <div className="batch-capacity">
              <div>
                <span>Ukuran batch</span>
                <span>{selected.length} / 500</span>
              </div>
              <div className="capacity-track">
                <span
                  className="hatched"
                  style={{
                    transform: `scaleX(${selected.length / 500})`,
                    background: selected.length >= 450 ? 'var(--secondary-400)' : 'var(--primary-400)',
                  }}
                />
              </div>
            </div>
          </Overlay>
          <section className="panel" id="position-history">
            <p className="eyebrow">RIWAYAT KOORDINAT</p>
            <h2>{focused ? `Comp. ${positionLabel(focused, eq)}` : 'Pilih satu posisi'}</h2>
            {timelineError && (
              <p className="notice error" role="alert">
                {timelineError}{' '}
                <button className="small secondary" onClick={() => setRevision((v) => v + 1)}>
                  Coba lagi
                </button>
              </p>
            )}
            {timelineBusy && !timeline.items.length ? (
              <p className="loading-line">Memuat riwayat…</p>
            ) : !focused ? (
              <p className="empty">Pilih bag untuk melihat pemasangan dan masa pakainya.</p>
            ) : !timeline.items.length ? (
              <p className="empty">Belum ada catatan untuk posisi ini.</p>
            ) : (
              <div className="timeline">
                {timeline.items.map((item) => {
                  const hours = Math.max(
                    0,
                    Math.floor(
                      ((item.endedAt ? Date.parse(item.endedAt) : now) - Date.parse(item.installedAt)) /
                        3600000,
                    ),
                  );
                  return (
                    <article key={item.id}>
                      <strong>{item.endedAt ? 'Pernah terpasang' : 'Terpasang sekarang'}</strong>
                      <small>{formatDate(item.installedAt)} WIB</small>
                      <small>Brand/Pabrikan: {item.brand || 'Belum tercatat'}</small>
                      <strong className={!item.endedAt ? 'now' : ''}>
                        {Math.floor(hours / 24).toLocaleString('id-ID')} hari
                      </strong>
                      <small>
                        {item.wo || 'Tanpa WO'} · {item.reason}
                      </small>
                      <small>
                        {item.actorName} · dicatat {formatDate(item.createdAt)} WIB
                      </small>
                    </article>
                  );
                })}
              </div>
            )}
            {timeline.nextCursor && focused && (
              <button
                className="secondary small"
                disabled={timelineBusy}
                onClick={async () => {
                  setTimelineBusy(true);
                  try {
                    const next = await read<Page<TimelineItem>>(timelineUrl(focused, timeline.nextCursor));
                    setTimeline((old) => ({
                      items: [...old.items, ...next.items],
                      nextCursor: next.nextCursor,
                    }));
                  } catch (e) {
                    setTimelineError((e as Error).message);
                  } finally {
                    setTimelineBusy(false);
                  }
                }}
              >
                Riwayat sebelumnya
              </button>
            )}
          </section>
        </div>
      </div>
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">RECORD PENGGANTIAN</p>
            <h2>Riwayat pekerjaan</h2>
          </div>
          <span className="badge">{history.items.length} batch</span>
        </div>
        <label>
          Cari WO, alasan, tanggal, atau koordinat
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Contoh: WO-001, 2026-10-01, atau ${positionLabel({ side: eq.sides[0].name, compartment: 1, column: 1, row: eq.rows }, eq)}`}
            maxLength={200}
          />
        </label>
        {historyError && (
          <p className="notice error" role="alert">
            {historyError}{' '}
            <button className="small secondary" onClick={() => setRevision((v) => v + 1)}>
              Coba lagi
            </button>
          </p>
        )}
        {historyBusy && !history.items.length ? (
          <p className="loading-line">Memuat history…</p>
        ) : !history.items.length ? (
          <p className="empty">
            {search ? 'Tidak ada pekerjaan sesuai pencarian.' : 'Belum ada pemasangan atau penggantian.'}
          </p>
        ) : (
          <div className="history-list">
            {history.items.map((batch) => (
              <article className="history-item" key={batch.id}>
                <span className="history-count">{batch.positionCount}</span>
                <div>
                  <strong>
                    {batch.wo || 'Tanpa WO'} · {batch.positionCount} bag
                  </strong>
                  <small>
                    {batch.reason} · dipasang {formatDate(batch.installedAt)} WIB
                  </small>
                  <small>Brand/Pabrikan: {batch.brand || 'Belum tercatat'}</small>
                  <small>
                    {batch.actorName} · dicatat {formatDate(batch.createdAt)} WIB
                  </small>
                  <div className="coordinate-links">
                    {batch.positions.slice(0, 12).map((p) => (
                      <button
                        key={positionKey(p)}
                        onClick={() => {
                          focus(p);
                          document.getElementById('position-history')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        {positionLabel(p, eq)}
                      </button>
                    ))}
                    {batch.positions.length > 12 && (
                      <details>
                        <summary>{batch.positions.length - 12} koordinat lainnya</summary>
                        <div className="coordinate-links">
                          {batch.positions.slice(12).map((p) => (
                            <button
                              key={positionKey(p)}
                              onClick={() => {
                                focus(p);
                                document
                                  .getElementById('position-history')
                                  ?.scrollIntoView({ behavior: 'smooth' });
                              }}
                            >
                              {positionLabel(p, eq)}
                            </button>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {history.nextCursor && (
          <button
            className="secondary"
            disabled={historyBusy}
            onClick={async () => {
              setHistoryBusy(true);
              try {
                const next = await read<Page<Batch>>(
                  `${base}/batches?q=${encodeURIComponent(search)}&cursor=${history.nextCursor}`,
                );
                setHistory((old) => ({ items: [...old.items, ...next.items], nextCursor: next.nextCursor }));
              } catch (e) {
                setHistoryError((e as Error).message);
              } finally {
                setHistoryBusy(false);
              }
            }}
          >
            Muat 50 batch berikutnya
          </button>
        )}
      </section>
      {writable && selected.length > 0 && (
        <div className="selection-bar" role="region" aria-label="Pilihan bag">
          <strong>{selected.length} posisi dipilih</strong>
          <button type="button" className="ghost" disabled={busy} onClick={() => setSelected([])}>
            Bersihkan semua
          </button>
          <button type="button" disabled={busy} onClick={() => setSheetOpen(true)}>
            Catat penggantian
          </button>
        </div>
      )}
      {marquee && (
        <div
          className="selection-marquee"
          style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }}
        />
      )}
      {hovered &&
        (() => {
          const installed = latest.get(positionKey(hovered.position)),
            hours = ageHours(installed?.installedAt || null, now);
          return (
            <div className="bag-tooltip" role="tooltip" style={{ left: hovered.x, top: hovered.y }}>
              <strong>Comp. {positionLabel(hovered.position, eq)}</strong>
              <small>{hours === null ? 'Belum tercatat' : Math.floor(hours / 24) + ' hari'}</small>
              {installed && (
                <>
                  <small>{formatDate(installed.installedAt)} WIB</small>
                  <small>Brand/Pabrikan: {installed.brand || 'Belum tercatat'}</small>
                </>
              )}
            </div>
          );
        })()}
    </>
  );
}
