'use client';
import { Fragment, useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { OverviewMap } from './overview-map';
import { activeAgeSummary } from './age-summary';
import { BulkSelection } from './bulk-selection';
import { CoordinateHistory, type TimelineItem } from './coordinate-history';
import { BatchCancellationDialog, CancellationNotice, type BatchRecord } from './batch-cancellation';
import { compartmentOptions, groupSelection, initialSelection, selectionReducer } from './selection';
import {
  ageHours,
  ageStops,
  ageBucket,
  bagAgeScaleDays,
  bagColor,
  bagBrands,
  type BagBrand,
  type BatchCancellation,
  displayCompartment,
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
  updatedAt: string | null;
  yearlyReplacements: { year: number; total: number; previousYear: number; previousTotal: number };
};
type Batch = BatchRecord;
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
  cancellable,
  initialBatch = '',
}: {
  initial: Snapshot;
  writable: boolean;
  cancellable: boolean;
  initialBatch?: string;
}) {
  const [data, setData] = useState(initial),
    [now, setNow] = useState(() => Date.parse(initial.serverTime));
  const eq = data.equipment,
    letters = eq.columns,
    base = `/bag-filter/api/equipment/${eq.code}`;
  const [side, setSide] = useState<Position['side']>(eq.sides[0].name),
    [compartment, setCompartment] = useState(1),
    [focused, setFocused] = useState<Position | null>(null);
  const [selection, dispatchSelection] = useReducer(selectionReducer, initialSelection);
  const selected = selection.positions;
  const [bulkOpen, setBulkOpen] = useState(false);
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
    drag = useRef<{ x: number; y: number; active: boolean; base: Position[]; items: Position[] } | null>(
      null,
    ),
    suppressClick = useRef(false);
  const retry = useRef<{ key: string; payload: string } | null>(null);
  const recordButton = useRef<HTMLButtonElement>(null);
  const [cancelTarget, setCancelTarget] = useState<Batch | null>(null);
  const cancelTrigger = useRef<HTMLButtonElement>(null);
  const historyHeading = useRef<HTMLHeadingElement>(null);
  const inputMode = useRef('keyboard');
  const tooltipId = useId();
  const latest = useMemo(() => new Map(data.positions.map((p) => [positionKey(p), p])), [data.positions]);
  const ages = useMemo(() => activeAgeSummary(latest.values(), now), [latest, now]);
  const selectedKeys = useMemo(() => new Set(selected.map(positionKey)), [selected]);
  const selectedGroups = useMemo(() => groupSelection(eq, selected), [eq, selected]);
  const compartments = useMemo(() => compartmentOptions(eq), [eq]);
  const displayError = error || selection.error;
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
  function cancelled(batchId: string, cancellation: BatchCancellation) {
    setHistory((old) => ({
      ...old,
      items: old.items.map((item) =>
        item.id === batchId ? { ...item, status: 'cancelled', cancellation } : item,
      ),
    }));
    setTimeline((old) => ({
      ...old,
      items: old.items.map((item) =>
        item.batchId === batchId ? { ...item, status: 'cancelled', cancellation } : item,
      ),
    }));
    setCancelTarget(null);
    setNotice('Record sudah dibatalkan. Riwayat dan jejak audit tetap tersimpan.');
    setError('');
    requestAnimationFrame(() => historyHeading.current?.focus({ preventScroll: true }));
    void reload().catch(() => setError('Record sudah dibatalkan, tetapi tampilan belum diperbarui.'));
  }
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
  function addPositions(items: Position[]) {
    if (writable && !busy) dispatchSelection({ type: 'add', positions: items });
  }
  function undoSelection() {
    if (!writable || busy) return;
    dispatchSelection({ type: 'undo' });
    anchorSelection.current = null;
  }
  function clearSelection() {
    if (!writable || busy) return;
    dispatchSelection({ type: 'clear' });
    anchorSelection.current = null;
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
    setHovered(null);
    const r = el.getBoundingClientRect();
    const target = {
      position: p,
      x: Math.max(8, Math.min(innerWidth - 280, r.right + 8)),
      y: Math.max(8, Math.min(innerHeight - 140, r.top - 16)),
    };
    hoverTimer.current = setTimeout(() => setHovered(target), 400);
  }
  function pointerHover(p: Position, event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== 'mouse' || event.buttons !== 0) {
      leaveHover();
      return;
    }
    inputMode.current = 'mouse';
    hover(p, event.currentTarget);
  }
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    function dismiss() {
      clearTimeout(hoverTimer.current);
      setHovered(null);
    }
    function pointer(event: PointerEvent) {
      inputMode.current = event.pointerType;
      dismiss();
    }
    function keyboard(event: KeyboardEvent) {
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
      inputMode.current = 'keyboard';
      if (event.key === 'Escape') dismiss();
    }
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('keydown', keyboard, true);
    document.addEventListener('scroll', dismiss, true);
    window.addEventListener('blur', dismiss);
    return () => {
      clearTimeout(hoverTimer.current);
      document.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('keydown', keyboard, true);
      document.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('blur', dismiss);
    };
  }, []);
  function leaveHover() {
    clearTimeout(hoverTimer.current);
    setHovered(null);
  }
  function toggle(p: Position, event?: { shiftKey: boolean }) {
    if (busy || suppressClick.current) return;
    leaveHover();
    focus(p);
    if (!writable) return;
    if (event?.shiftKey) {
      addPositions(selectRange(p));
      return;
    }
    anchorSelection.current = p;
    dispatchSelection({ type: 'toggle', position: p });
  }
  function showComp(nextSide: Position['side'], nextComp: number) {
    setSide(nextSide);
    setCompartment(nextComp);
    setFocused(null);
    document.getElementById('bag-detail')?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    });
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
      dispatchSelection({ type: 'reset' });
      anchorSelection.current = null;
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
  const coordinateHistory = (
    <CoordinateHistory
      items={timeline.items}
      loading={timelineBusy}
      error={timelineError}
      hasPosition={!!focused}
      hasMore={!!timeline.nextCursor && !!focused}
      now={now}
      onRetry={() => setRevision((v) => v + 1)}
      onMore={async () => {
        if (!focused || !timeline.nextCursor) return;
        setTimelineBusy(true);
        setTimelineError('');
        try {
          const next = await read<Page<TimelineItem>>(timelineUrl(focused, timeline.nextCursor));
          setTimeline((old) => ({ items: [...old.items, ...next.items], nextCursor: next.nextCursor }));
        } catch (e) {
          setTimelineError((e as Error).message);
        } finally {
          setTimelineBusy(false);
        }
      }}
    />
  );
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
        <span
          className="badge"
          data-equipment-updated
          title={data.updatedAt ? `Pembaruan terakhir: ${formatDate(data.updatedAt)}` : undefined}
        >
          {data.updatedAt ? (
            <>
              Diperbarui{' '}
              <time dateTime={data.updatedAt}>
                {new Date(data.updatedAt).toLocaleDateString('id-ID', {
                  timeZone: 'Asia/Jakarta',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </time>
            </>
          ) : (
            'Belum ada pembaruan'
          )}
        </span>
      </Heading>
      {displayError && (
        <div className="notice error" role="alert">
          {displayError}{' '}
          {error && (
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
          )}
        </div>
      )}
      <Toast message={notice} onDismiss={() => setNotice('')} />
      <div className="stats equipment-stats">
        <article className="stat" data-kpi="capacity">
          <span>KOMPARTEMEN</span>
          <strong>{eq.compartments}</strong>
          <small className="equipment-stat-meta">
            <span>
              <b>{data.total.toLocaleString('id-ID')}</b> bag total
            </span>
            <span>
              <b>{eq.bagsPerCompartment.toLocaleString('id-ID')}</b> bag/kompartemen
            </span>
          </small>
        </article>
        <article className="stat" data-kpi="active-age">
          <span>UMUR BAG AKTIF</span>
          <strong data-age-range>
            {ages.min === null || ages.max === null ? (
              '—'
            ) : (
              <>
                {ages.min !== ages.max && <>{ages.min.toLocaleString('id-ID')}–</>}
                <span data-old={ages.max >= bagAgeScaleDays}>{ages.max.toLocaleString('id-ID')}</span>{' '}
                <small>hari</small>
              </>
            )}
          </strong>
          <small>
            {ages.recorded
              ? `Termuda–tertua · ${ages.old.toLocaleString('id-ID')} bag ≥${bagAgeScaleDays.toLocaleString('id-ID')} hari`
              : 'Belum ada pemasangan tercatat'}
          </small>
        </article>
        <article className="stat" data-kpi="replacements">
          <span>PENGGANTIAN BAG {data.yearlyReplacements.year}</span>
          <strong data-replacement-total>
            {data.yearlyReplacements.total.toLocaleString('id-ID')} <small>bag</small>
          </strong>
          <small className="equipment-stat-meta" data-previous-replacements>
            <span>
              {data.yearlyReplacements.previousYear}:{' '}
              <b>{data.yearlyReplacements.previousTotal.toLocaleString('id-ID')}</b> bag
            </span>
            <span>Jan–Des</span>
          </small>
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
                aria-label={
                  i === ageStops.length - 1
                    ? `≥ ${stop.days} hari`
                    : `${stop.days}–${ageStops[i + 1].days - 1} hari`
                }
                onClick={() => setBucket((v) => (v === i ? null : i))}
              >
                <i style={{ background: stop.color }} />
                <span className="age-range-label">
                  {i === ageStops.length - 1
                    ? `≥ ${stop.days} hari`
                    : `${stop.days}–${ageStops[i + 1].days - 1}`}
                </span>
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
        <OverviewMap equipmentCode={eq.code} perSide={eq.perSide} onScroll={leaveHover}>
          {eq.sides.map(({ name: band }, index) => (
            <div className="overview-band" aria-label={`Sisi ${band}`} key={band}>
              {Array.from({ length: eq.perSide }, (_, i) => {
                const local = i + 1,
                  display = displayCompartment({ side: band, compartment: local }, eq);
                return (
                  <div
                    className="overview-compartment"
                    key={local}
                    data-active={side === band && compartment === local}
                  >
                    {index === 1 && (
                      <button
                        className="overview-title"
                        aria-current={side === band && compartment === local ? 'true' : undefined}
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
                                  className={`overview-cell${age !== null && age >= bagAgeScaleDays * 24 ? ' is-old' : ''}`}
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
                                  onPointerEnter={(e) => pointerHover(p, e)}
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
                        aria-current={side === band && compartment === local ? 'true' : undefined}
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
        </OverviewMap>
        {/* {eq.rowDividerAfter !== null && (
          <p className="fine">
            Jeda visual antara baris {eq.rowDividerAfter} dan {eq.rowDividerAfter + 1}.
          </p>
        )} */}
        <p className="fine">
          Pilih nomor kompartemen untuk membuka detail. Pilihan lintas kompartemen tersimpan dalam satu
          pekerjaan.
        </p>
      </section>
      <div className="equipment-workspace">
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
              <label className="full">
                Kompartemen
                <Select
                  searchable={false}
                  aria-label="Kompartemen"
                  value={`${side}:${compartment}`}
                  onChange={(e) => {
                    const next = compartments.find((c) => c.value === e.target.value);
                    if (!next) return;
                    setSide(next.side);
                    setCompartment(next.compartment);
                    setFocused(null);
                  }}
                >
                  {compartments.map((c) => (
                    <option key={c.value} value={c.value}>
                      Comp. {c.label}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            {writable && (
              <div className="bulk-selection-tools">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    leaveHover();
                    setBulkOpen(true);
                  }}
                >
                  <Icon name="grid" /> Pilih banyak
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={busy || selection.previous === null}
                  onClick={undoSelection}
                >
                  Urungkan pilihan terakhir
                </button>
              </div>
            )}
            <div className="bag-grid-scroll">
              <div
                className="bag-grid"
                role="group"
                aria-label={`Detail kompartemen ${currentComp}`}
                onPointerDown={(e) => {
                  if (writable && !busy && e.pointerType === 'mouse' && e.button === 0)
                    drag.current = { x: e.clientX, y: e.clientY, active: false, base: selected, items: [] };
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
                    const cells = Array.from(
                      e.currentTarget.querySelectorAll<HTMLButtonElement>('.bag-cell'),
                    );
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
                    d.items = picked;
                    dispatchSelection({ type: 'preview', positions: picked, base: d.base });
                  }
                }}
                onPointerUp={(e) => {
                  if (drag.current?.active) {
                    dispatchSelection({
                      type: 'add',
                      positions: drag.current.items,
                      base: drag.current.base,
                    });
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
                  if (drag.current?.active)
                    dispatchSelection({ type: 'cancel-drag', base: drag.current.base });
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
                            className={`bag-cell${age === null ? ' is-empty' : age >= bagAgeScaleDays * 24 ? ' is-old' : ''}`}
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
                            onFocus={(e) => {
                              if (inputMode.current === 'keyboard') hover(p, e.currentTarget);
                            }}
                            onPointerEnter={(e) => pointerHover(p, e)}
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
                                (bucket === 'empty'
                                  ? age === null
                                  : age !== null && ageBucket(age) === bucket)
                                  ? 1
                                  : 0.25,
                            }}
                            aria-pressed={picked}
                            aria-describedby={
                              hovered && positionKey(hovered.position) === key ? tooltipId : undefined
                            }
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
              Arahkan mouse untuk info cepat; tap bag untuk memperbarui Riwayat koordinat.{' '}
              {writable
                ? 'Gunakan Pilih banyak untuk kompartemen/area, atau klik ulang bag untuk menghapus pilihan. Desktop juga mendukung Shift+klik dan seret mouse.'
                : 'Klik posisi untuk membaca riwayat.'}
            </p>
          </section>
          {writable && (
            <BulkSelection
              open={bulkOpen}
              equipment={eq}
              side={side}
              compartment={compartment}
              selected={selected}
              busy={busy}
              onClose={() => setBulkOpen(false)}
              onAdd={(positions) => {
                addPositions(positions);
                anchorSelection.current = null;
              }}
            />
          )}
          <div className="bag-context">
            <Overlay
              open={sheetOpen}
              onClose={() => {
                if (!busy) setSheetOpen(false);
              }}
              title="Pencatatan penggantian"
              kind="sheet"
              anchor={recordButton}
            >
              {' '}
              <section className="installation-form">
                {displayError && (
                  <p className="notice error" role="alert">
                    {displayError}
                  </p>
                )}
                <p className="eyebrow">PENCATATAN PENGGANTIAN</p>
                <h2>{writable ? `${selected.length} posisi dipilih` : 'Akses baca'}</h2>
                {writable ? (
                  <>
                    <div className="selection-summary">
                      <div className="selection-summary-head">
                        <p className="fine">
                          {selectedGroups.length} kompartemen · {selected.length} bag
                        </p>
                        <div>
                          <button
                            type="button"
                            className="ghost small"
                            disabled={busy || selection.previous === null}
                            onClick={undoSelection}
                          >
                            Urungkan pilihan terakhir
                          </button>
                          {selected.length > 0 && (
                            <button
                              type="button"
                              className="ghost small"
                              disabled={busy}
                              onClick={clearSelection}
                            >
                              Bersihkan semua
                            </button>
                          )}
                        </div>
                      </div>
                      {selectedGroups.map((group) => (
                        <details className="selection-group" key={`${group.side}-${group.compartment}`}>
                          <summary>
                            <span>Comp. {displayCompartment(group, eq)}</span>
                            <strong>{group.positions.length} bag</strong>
                            <Icon name="chevron" />
                          </summary>
                          <div className="selected-list">
                            {group.positions.map((p) => (
                              <button
                                key={positionKey(p)}
                                type="button"
                                disabled={busy}
                                onClick={() => dispatchSelection({ type: 'toggle', position: p })}
                                aria-label={`Hapus ${positionLabel(p, eq)}`}
                              >
                                {letters[p.column - 1]}
                                {p.row} ×
                              </button>
                            ))}
                          </div>
                        </details>
                      ))}
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
                          searchable={false}
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
                    Anda dapat membaca status dan history equipment. Hak pencatatan diberikan oleh admin
                    portal.
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
              {coordinateHistory}
            </section>
            <section className="panel" id="work-history">
              <div className="section-head">
                <div>
                  <p className="eyebrow">RECORD PENGGANTIAN</p>
                  <h2 ref={historyHeading} tabIndex={-1}>
                    Riwayat pekerjaan
                  </h2>
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
                  {search
                    ? 'Tidak ada pekerjaan sesuai pencarian.'
                    : 'Belum ada pemasangan atau penggantian.'}
                </p>
              ) : (
                <div
                  className="history-list"
                  role="region"
                  aria-label="Daftar riwayat pekerjaan"
                  tabIndex={0}
                >
                  {history.items.map((batch) => (
                    <article className="history-item" key={batch.id} data-batch-id={batch.id}>
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
                        {batch.cancellation && <CancellationNotice cancellation={batch.cancellation} />}
                        {cancellable && batch.status === 'active' && (
                          <button
                            type="button"
                            className="ghost small cancel-record-action"
                            disabled={busy}
                            onClick={(event) => {
                              cancelTrigger.current = event.currentTarget;
                              leaveHover();
                              setCancelTarget(batch);
                            }}
                          >
                            Batalkan record
                          </button>
                        )}
                        <div className="coordinate-links">
                          {batch.positions.slice(0, 12).map((p) => (
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
                      setHistory((old) => ({
                        items: [...old.items, ...next.items],
                        nextCursor: next.nextCursor,
                      }));
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
          </div>
        </div>
      </div>
      {writable && selected.length > 0 && <div className="selection-spacer" aria-hidden="true" />}
      <BatchCancellationDialog
        batch={cancelTarget}
        equipment={eq}
        anchor={cancelTrigger}
        onClose={() => setCancelTarget(null)}
        onCancelled={cancelled}
        onConflict={() => {
          void reload().catch(() => setError('Riwayat belum dapat diperbarui. Muat ulang data.'));
        }}
      />
      {writable && selected.length > 0 && (
        <div
          className="selection-bar"
          role="region"
          aria-label="Pilihan bag"
          hidden={sheetOpen || bulkOpen || !!cancelTarget}
        >
          <strong>{selected.length} posisi dipilih</strong>
          <button type="button" className="ghost" disabled={busy} onClick={clearSelection}>
            Bersihkan semua
          </button>
          <button
            type="button"
            data-sheet-trigger
            ref={recordButton}
            disabled={busy}
            onClick={() => {
              leaveHover();
              setSheetOpen(true);
            }}
          >
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
        !sheetOpen &&
        !bulkOpen &&
        !cancelTarget &&
        (() => {
          const installed = latest.get(positionKey(hovered.position)),
            hours = ageHours(installed?.installedAt || null, now);
          return (
            <div
              id={tooltipId}
              className="bag-tooltip"
              role="tooltip"
              style={{ left: hovered.x, top: hovered.y }}
            >
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
