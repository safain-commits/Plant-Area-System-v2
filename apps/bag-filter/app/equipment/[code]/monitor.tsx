'use client';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ageHours,
  bagColor,
  displayCompartment,
  formatDate,
  positionKey,
  positionLabel,
  wibInput,
  wibToIso,
  type Equipment,
  type Position,
} from '@plant/contracts';
import { Heading } from '@plant/ui';
type Installed = Position & { id: string; batchId: string; installedAt: string };
type Snapshot = {
  equipment: Equipment;
  positions: Installed[];
  recorded: number;
  total: number;
  serverTime: string;
};
type Batch = {
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
const letters = 'HGFEDCBA';
export default function BagMonitor({ initial, writable }: { initial: Snapshot; writable: boolean }) {
  const [data, setData] = useState(initial),
    [now, setNow] = useState(() => Date.parse(initial.serverTime));
  const eq = data.equipment,
    base = `/bag-filter/api/equipment/${eq.code}`;
  const [side, setSide] = useState<Position['side']>('Utara'),
    [compartment, setCompartment] = useState(1),
    [selected, setSelected] = useState<Position[]>([]),
    [focused, setFocused] = useState<Position | null>(null);
  const [installedAt, setInstalledAt] = useState(() => wibInput(Date.parse(initial.serverTime))),
    [reason, setReason] = useState(''),
    [wo, setWo] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [revision, setRevision] = useState(0);
  const [search, setSearch] = useState(''),
    [history, setHistory] = useState<Page<Batch>>({ items: [], nextCursor: null }),
    [historyBusy, setHistoryBusy] = useState(false),
    [historyError, setHistoryError] = useState('');
  const [timeline, setTimeline] = useState<Page<TimelineItem>>({ items: [], nextCursor: null }),
    [timelineBusy, setTimelineBusy] = useState(false),
    [timelineError, setTimelineError] = useState('');
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
  function toggle(p: Position) {
    if (busy) return;
    focus(p);
    if (!writable) return;
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
      setSelected([]);
      setReason('');
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
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="stats">
        <article className="stat">
          <span>KOMPARTEMEN</span>
          <strong>{eq.compartments}</strong>
          <small>
            {eq.perSide} Utara / {eq.perSide} Selatan
          </small>
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
        {(['Utara', 'Selatan'] as const).map((band, index) => (
          <div
            className="overview-band"
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
                  <div className="overview-matrix">
                    {Array.from({ length: 17 }, (_, r) => {
                      const row = band === 'Utara' ? 17 - r : r + 1;
                      return (
                        <div className="overview-line" key={row}>
                          {Array.from({ length: 8 }, (_, c) => {
                            const p = { side: band, compartment: local, column: c + 1, row },
                              key = positionKey(p),
                              age = ageHours(latest.get(key)?.installedAt || null, now),
                              picked = selectedKeys.has(key);
                            return (
                              <button
                                key={c}
                                className="overview-cell"
                                tabIndex={-1}
                                style={{ background: picked ? '#ed9b36' : bagColor(age) }}
                                aria-label={`${display} ${letters[c]}${row}`}
                                aria-pressed={picked}
                                title={`Comp. ${display} · ${letters[c]}${row} · ${age === null ? 'belum tercatat' : `${Math.floor(age / 24)} hari`}`}
                                onClick={() => toggle(p)}
                              />
                            );
                          })}
                          <span className="overview-row-number">{row}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="overview-labels">
                    {letters.split('').map((letter) => (
                      <span key={letter}>{letter}</span>
                    ))}
                  </div>
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
        <div className="legend">
          <span>
            <i style={{ background: '#ed9b36' }} />
            Dipilih
          </span>
          <span>
            <i style={{ background: bagColor(null) }} />
            Belum tercatat
          </span>
          {[0, 450, 900].map((days) => (
            <span key={days}>
              <i style={{ background: bagColor(days * 24) }} />
              {days === 900 ? '≥' : ''}
              {days} hari
            </span>
          ))}
        </div>
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
              <select
                value={side}
                onChange={(e) => {
                  setSide(e.target.value as Position['side']);
                  setFocused(null);
                }}
              >
                <option>Utara</option>
                <option>Selatan</option>
              </select>
            </label>
            <label>
              Kompartemen
              <select
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
              </select>
            </label>
          </div>
          <div className="bag-grid" role="group" aria-label={`Detail kompartemen ${currentComp}`}>
            {letters.split('').map((letter) => (
              <span className="grid-label" key={letter}>
                {letter}
              </span>
            ))}
            <span />
            {Array.from({ length: 17 }, (_, r) => {
              const row = side === 'Utara' ? 17 - r : r + 1;
              return (
                <Fragment key={row}>
                  {Array.from({ length: 8 }, (_, c) => {
                    const p = { side, compartment, column: c + 1, row },
                      key = positionKey(p),
                      age = ageHours(latest.get(key)?.installedAt || null, now),
                      picked = selectedKeys.has(key);
                    return (
                      <button
                        key={c}
                        type="button"
                        className="bag-cell"
                        style={{
                          background: picked ? '#ed9b36' : bagColor(age),
                          color: !picked && age !== null && age >= 450 * 24 ? '#fff' : '#153d39',
                        }}
                        aria-pressed={picked}
                        aria-label={`Kolom ${letters[c]}, baris ${row}: ${age === null ? 'belum tercatat' : `${Math.floor(age / 24)} hari`}`}
                        onClick={() => toggle(p)}
                      >
                        {age === null ? '·' : Math.floor(age / 24)}
                      </button>
                    );
                  })}
                  <span className="grid-label">{row}</span>
                </Fragment>
              );
            })}
          </div>
          <p className="fine" style={{ marginTop: 18 }}>
            Angka dalam hari.{' '}
            {writable ? 'Klik ulang untuk menghapus pilihan.' : 'Klik posisi untuk membaca riwayat.'}
          </p>
        </section>
        <div>
          <section className="panel">
            <p className="eyebrow">PENCATATAN PENGGANTIAN</p>
            <h2>{writable ? `${selected.length} posisi dipilih` : 'Akses baca'}</h2>
            {writable ? (
              <>
                <div className="selected-list">
                  {selected.map((p) => (
                    <button
                      key={positionKey(p)}
                      disabled={busy}
                      onClick={() => toggle(p)}
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
                    <input
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
                    Alasan penggantian / pemasangan awal
                    <textarea
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
                    <input
                      value={wo}
                      onChange={(e) => setWo(e.target.value)}
                      maxLength={100}
                      disabled={busy}
                    />
                  </label>
                  <button disabled={busy || !selected.length}>
                    {busy ? 'Menyimpan…' : `Simpan ${selected.length} bag`}
                  </button>
                </form>
                <p className="fine" style={{ marginTop: 15, marginBottom: 0 }}>
                  Satu tanggal, alasan, dan WO berlaku untuk seluruh posisi. Catatan yang disimpan tidak dapat
                  diubah pada rilis ini.
                </p>
              </>
            ) : (
              <p className="read-only">
                Anda dapat membaca status dan history equipment. Hak pencatatan diberikan oleh admin portal.
              </p>
            )}
          </section>
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
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Contoh: WO-001, 2026-10-01, atau 18 B1"
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
    </>
  );
}
