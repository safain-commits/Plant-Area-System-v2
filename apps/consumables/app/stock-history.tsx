'use client';
import { useEffect, useState } from 'react';
import { Button, Input, Select, Overlay } from '@plant/ui';
import {
  formatDate,
  formatQuantity,
  stockDocumentLabels,
  type Identity,
  type StockDocument,
  type StockLocation,
  type DocumentResult,
} from '@plant/contracts';
import { stockApi } from './r22-api';
import { ConsumablesWorkspace } from './workspace';
export function StockHistory({ identity }: { identity: Identity }) {
  const [mode, setMode] = useState('documents'),
    [query, setQuery] = useState(''),
    [type, setType] = useState(''),
    [location, setLocation] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [ledgerType, setLedgerType] = useState('');
  const [locations, setLocations] = useState<StockLocation[]>([]),
    [items, setItems] = useState<StockDocument[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [back, setBack] = useState<(string | null)[]>([]),
    [next, setNext] = useState<string | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [reload, setReload] = useState(0),
    [detail, setDetail] = useState<DocumentResult | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const p = new URLSearchParams(window.location.search);
    if (p.get('movement') || p.get('material') || p.get('tab') === 'ledger') setMode('ledger');
    if (p.get('location')) setLocation(p.get('location')!);
    if (p.get('document'))
      stockApi('/documents/' + encodeURIComponent(p.get('document')!), { signal: controller.signal })
        .then((d) => {
          if (!controller.signal.aborted) setDetail(d);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    stockApi('/locations', { signal: controller.signal })
      .then((d) => setLocations(d.items))
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    setCursor(null);
    setBack([]);
  }, [query, type, location, from, to]);
  useEffect(() => {
    if (mode !== 'documents') return;
    const c = new AbortController(),
      timer = setTimeout(() => {
        setBusy(true);
        setError('');
        const p = new URLSearchParams({ q: query });
        if (type) p.set('type', type);
        if (location) p.set('locationId', location);
        if (from) p.set('from', from);
        if (to) p.set('to', to);
        if (cursor) p.set('cursor', cursor);
        stockApi('/documents?' + p, { signal: c.signal })
          .then((d) => {
            if (!c.signal.aborted) {
              setItems(d.items);
              setNext(d.nextCursor);
            }
          })
          .catch((e) => {
            if (!c.signal.aborted) setError(e.message);
          })
          .finally(() => {
            if (!c.signal.aborted) setBusy(false);
          });
      }, 200);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [mode, query, type, location, from, to, cursor, reload]);
  async function open(id: string) {
    try {
      setDetail(await stockApi('/documents/' + id));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="stock-tabs" role="group" aria-label="Jenis riwayat">
        <Button
          className={mode === 'documents' ? 'primary small' : 'secondary small'}
          aria-pressed={mode === 'documents'}
          onClick={() => setMode('documents')}
        >
          Dokumen
        </Button>
        <Button
          className={mode === 'ledger' ? 'primary small' : 'secondary small'}
          aria-pressed={mode === 'ledger'}
          onClick={() => setMode('ledger')}
        >
          Pergerakan stok
        </Button>
      </div>
      {mode === 'ledger' ? (
        <ConsumablesWorkspace key={ledgerType} identity={identity} view="history" initialType={ledgerType} />
      ) : (
        <section className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">DOKUMEN R22</p>
              <h2>Order dan penerimaan</h2>
            </div>
            <Button className="secondary small" busy={busy} onClick={() => setReload((v) => v + 1)}>
              Perbarui
            </Button>
          </div>
          <div className="stock-filters">
            <label>
              Cari dokumen
              <Input
                type="search"
                value={query}
                maxLength={200}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nomor, HEC, WO, reservasi, peminta…"
              />
            </label>
            <label>
              Jenis
              <Select
                value={type}
                onChange={(e) => {
                  const value = e.target.value;
                  if (['opening', 'adjustment'].includes(value)) {
                    setLedgerType(value);
                    setMode('ledger');
                  } else setType(value);
                }}
              >
                <option value="">Semua dokumen</option>
                {Object.entries(stockDocumentLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
                <option value="opening">Saldo awal · ledger</option>
                <option value="adjustment">Koreksi · ledger</option>
              </Select>
            </label>
            <label>
              Lokasi
              <Select value={location} onChange={(e) => setLocation(e.target.value)}>
                <option value="">Semua lokasi Anda</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Dari tanggal (WIB)
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              Sampai tanggal (WIB)
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          {error && (
            <p className="notice error" role="alert">
              {error}{' '}
              <Button className="secondary small" onClick={() => setReload((v) => v + 1)}>
                Coba lagi
              </Button>
            </p>
          )}
          <div className="stock-table r22-documents-list" aria-busy={busy}>
            <div className="stock-table-head">
              <span>Dokumen / peminta</span>
              <span>Konteks pekerjaan</span>
              <span>Item / waktu</span>
            </div>
            {items.map((d) => (
              <button type="button" key={d.id} className="stock-table-row" onClick={() => open(d.id)}>
                <span>
                  <strong>{d.number}</strong>
                  <small>
                    {stockDocumentLabels[d.type]} · {d.requesterName}
                  </small>
                </span>
                <span>
                  {d.hec || d.locationName}
                  <small>
                    WO {d.wo || '—'}
                    {d.reservationNo ? ' · Reservasi ' + d.reservationNo : ''}
                  </small>
                </span>
                <span>
                  <strong>{d.lineCount} item</strong>
                  <small>
                    {formatDate(d.createdAt)} WIB · {d.actorName}
                  </small>
                </span>
              </button>
            ))}
            {!items.length && (
              <p className="empty">
                {busy
                  ? 'Memuat dokumen…'
                  : 'Belum ada dokumen sesuai filter. Riwayat v1 tersedia pada tab Pergerakan stok.'}
              </p>
            )}
          </div>
          <div className="stock-pagination">
            <Button
              className="secondary small"
              disabled={!back.length || busy}
              onClick={() => {
                const value = [...back];
                setCursor(value.pop() || null);
                setBack(value);
              }}
            >
              Sebelumnya
            </Button>
            <span>
              {items.length} hasil · halaman {back.length + 1}
            </span>
            <Button
              className="secondary small"
              disabled={!next || busy}
              onClick={() => {
                setBack((v) => [...v, cursor]);
                setCursor(next);
              }}
            >
              Berikutnya
            </Button>
          </div>
        </section>
      )}
      <Overlay open={!!detail} onClose={() => setDetail(null)} title="Detail dokumen R22" kind="sheet">
        {detail && (
          <>
            <span className="badge neutral">{stockDocumentLabels[detail.document.type]}</span>
            <h2>{detail.document.number}</h2>
            <dl className="stock-detail-grid">
              {[
                ['Lokasi', detail.document.locationName],
                ['HEC', detail.document.hec || '—'],
                ['WO', detail.document.wo || '—'],
                ['Keterangan', detail.document.note || '—'],
                ['Peminta', detail.document.requesterName],
                ['NIK', detail.document.requesterNik || '—'],
                ['Pencatat', detail.document.actorName],
                ['Waktu WIB', formatDate(detail.document.createdAt)],
                ['Reservasi', detail.document.reservationNo || '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <h3>{detail.lines.length} item</h3>
            {detail.lines.map((l) => (
              <article key={l.id} className="stock-detail-location">
                <strong>
                  {l.lineNo}. {l.commonName || l.description}
                </strong>
                <small>
                  {l.mmid} · {l.description}
                </small>
                <span>
                  {formatQuantity(l.quantity.replace('-', ''))} {l.unit}
                </span>
                <small>
                  Saldo setelah pencatatan: {formatQuantity(l.balanceAfter)} {l.unit}
                </small>
              </article>
            ))}
            <a className="button primary" href={`/consumables/documents/${detail.document.id}`}>
              Lihat / Cetak bukti
            </a>
          </>
        )}
      </Overlay>
    </>
  );
}
