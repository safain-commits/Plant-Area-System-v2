'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button, Input, Select, Textarea, Overlay, useConfirmation } from '@plant/ui';
import {
  canConsume,
  formatDate,
  formatQuantity,
  localDecimal,
  decimalUnits,
  decimalString,
  type Identity,
  type Material,
  type InventoryItem,
  type StockLocation,
  type Movement,
} from '@plant/contracts';
type AuditItem = { id: string; action: string; actorName: string; createdAt: string; details: string };
type ListItem = Material | InventoryItem | Movement | AuditItem;
const api = '/consumables/api';
const labels = { opening: 'Saldo awal', receipt: 'Penerimaan', issue: 'Pemakaian', adjustment: 'Koreksi' };
async function get(path: string, signal?: AbortSignal) {
  const r = await fetch(api + path, { cache: 'no-store', signal }),
    d = await r.json();
  if (!r.ok) throw Error(d.error || 'Gagal memuat data.');
  return d;
}
async function send(path: string, body: unknown, method = 'POST', key?: string) {
  const r = await fetch(api + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
      body: JSON.stringify(body),
    }),
    d = await r.json();
  if (!r.ok) throw Error(d.error || 'Gagal menyimpan.');
  return d;
}
const quantity = (n: string) => formatQuantity(n);
export function ConsumablesWorkspace({ identity, view }: { identity: Identity; view: string }) {
  const [query, setQuery] = useState(''),
    [location, setLocation] = useState(''),
    [availability, setAvailability] = useState(''),
    [category, setCategory] = useState(''),
    [type, setType] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [catalog, setCatalog] = useState(false),
    [showInactive, setShowInactive] = useState(false);
  const [locations, setLocations] = useState<StockLocation[]>([]),
    [items, setItems] = useState<ListItem[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [next, setNext] = useState<string | null>(null),
    [back, setBack] = useState<(string | null)[]>([]),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [refresh, setRefresh] = useState(0),
    [checked, setChecked] = useState('');
  const [detail, setDetail] = useState<{ material: Material; stocks: InventoryItem[] } | null>(null),
    [movement, setMovement] = useState<Movement | null>(null),
    [selected, setSelected] = useState<InventoryItem | null>(null),
    [editing, setEditing] = useState<Material | null>(null),
    [management, setManagement] = useState('materials');
  const admin = canConsume(identity, 'manage');
  const [categories, setCategories] = useState<string[]>([]);
  useEffect(() => {
    const c = new AbortController();
    get('/categories', c.signal)
      .then((d) => setCategories(d.items))
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => c.abort();
  }, [refresh]);
  useEffect(() => {
    get('/locations')
      .then((d) => setLocations(d.items))
      .catch((e) => setError(e.message));
  }, [refresh]);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const p = new URLSearchParams({ q: query });
      if (location) p.set('locationId', location);
      if (cursor) p.set('cursor', cursor);
      if (availability) p.set('availability', availability);
      if (category) p.set('category', category);
      if (type) p.set('type', type);
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      if (showInactive) p.set('active', 'all');
      const path =
        view === 'history'
          ? '/movements'
          : view === 'audit'
            ? '/audit'
            : catalog || (view === 'manage' && management === 'materials')
              ? '/materials'
              : '/inventory';
      return get(path + '?' + p, signal);
    },
    [
      view,
      query,
      location,
      cursor,
      availability,
      category,
      type,
      from,
      to,
      catalog,
      management,
      showInactive,
    ],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);
      setError('');
      load(controller.signal)
        .then((d) => {
          if (controller.signal.aborted) return;
          setItems(d.items);
          setNext(d.nextCursor);
          setChecked(new Date().toISOString());
          setReady(true);
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setError(e.message);
            setItems([]);
            setNext(null);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [load, refresh]);
  useEffect(() => {
    setCursor(null);
    setBack([]);
  }, [query, location, availability, category, type, from, to, catalog, management, showInactive]);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (['available', 'empty', 'uncounted', 'critical'].includes(p.get('availability') || ''))
      setAvailability(p.get('availability')!);
    if (p.get('location')) setLocation(p.get('location')!);
    if (p.get('movement'))
      get('/movements/' + encodeURIComponent(p.get('movement')!))
        .then((d) => setMovement(d.movement))
        .catch((e) => setError(e.message));
    if (p.get('material'))
      get('/materials/' + encodeURIComponent(p.get('material')!))
        .then((d) => {
          if (view === 'stock') setDetail(d);
          else if (view === 'history') setQuery(d.material.mmid);
          else setSelected(d.stocks.find((i: InventoryItem) => i.locationId === p.get('location')) || null);
        })
        .catch((e) => setError(e.message));
  }, [view]);
  async function openMaterial(id: string) {
    try {
      setDetail(await get('/materials/' + id));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function saved(message = 'Perubahan tersimpan.') {
    setNotice(message);
    setRefresh((v) => v + 1);
  }
  const filters = (
    <div className="stock-filters">
      <label>
        Cari material atau transaksi
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="MMID, nama, kategori, rak, WO…"
        />
      </label>
      {!catalog && (
        <label>
          Lokasi
          <Select
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setSelected(null);
            }}
          >
            <option value="">Semua lokasi Anda</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {!l.active ? ' · Nonaktif' : ''}
              </option>
            ))}
          </Select>
        </label>
      )}
      {view === 'history' ? (
        <>
          <label>
            Jenis
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Semua transaksi</option>
              {Object.entries(labels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
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
        </>
      ) : (
        view !== 'audit' && (
          <>
            <label>
              Kategori
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Semua kategori</option>
                {categories.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </label>
            {!catalog && (
              <label>
                Ketersediaan
                <Select value={availability} onChange={(e) => setAvailability(e.target.value)}>
                  <option value="">Semua kondisi</option>
                  <option value="available">Tersedia</option>
                  <option value="empty">Stok nol</option>
                  <option value="uncounted">Belum dihitung</option>
                  <option value="critical">Critical stok nol</option>
                </Select>
              </label>
            )}
          </>
        )
      )}
      {(view === 'stock' || view === 'manage') && (
        <label className="inline">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Sertakan nonaktif
        </label>
      )}
    </div>
  );
  const paging = (
    <div className="stock-pagination">
      <Button
        className="secondary small"
        disabled={!back.length || busy}
        onClick={() => {
          const p = [...back];
          setCursor(p.pop() ?? null);
          setBack(p);
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
  );
  return (
    <>
      {error && (
        <p className="notice error" role="alert">
          {error}{' '}
          <Button className="secondary small" onClick={() => setRefresh((v) => v + 1)}>
            Coba lagi
          </Button>
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {['receive', 'issue'].includes(view) ? (
        <div className="stock-transaction-layout">
          <section className="panel">
            <h2>Pilih stok</h2>
            {filters}
            <StockRows
              items={items as InventoryItem[]}
              busy={busy}
              ready={ready}
              selected={selected?.inventoryId}
              onSelect={setSelected}
            />
            {paging}
          </section>
          <section className="panel">
            <h2>{view === 'receive' ? 'Penerimaan' : 'Pemakaian'}</h2>
            {selected ? (
              <StockTransaction
                key={`${selected.inventoryId}-${selected.inventoryVersion}-${view}`}
                item={selected}
                kind={view === 'receive' ? 'receipt' : 'issue'}
                onSaved={(m) => {
                  saved(m);
                  get('/materials/' + selected.id)
                    .then((d) =>
                      setSelected(
                        d.stocks.find((s: InventoryItem) => s.inventoryId === selected.inventoryId) || null,
                      ),
                    )
                    .catch(() =>
                      setNotice(
                        'Transaksi tersimpan; pembaruan tampilan gagal. Tekan Coba lagi atau Perbarui.',
                      ),
                    );
                }}
              />
            ) : (
              <p className="empty">Pilih material dan lokasi dari daftar stok.</p>
            )}
          </section>
        </div>
      ) : view === 'manage' ? (
        <>
          <div className="stock-tabs" role="group" aria-label="Pengelolaan">
            {[
              ['materials', 'Master material'],
              ['locations', 'Lokasi'],
              ['inventory', 'Daftar stok & saldo awal'],
            ].map(([v, l]) => (
              <Button
                key={v}
                className={management === v ? 'primary small' : 'secondary small'}
                aria-pressed={management === v}
                onClick={() => {
                  setManagement(v);
                  setEditing(null);
                  setSelected(null);
                }}
              >
                {l}
              </Button>
            ))}
          </div>
          {management === 'locations' ? (
            <LocationManagement locations={locations} saved={saved} />
          ) : management === 'materials' ? (
            <>
              <section className="panel">
                <MaterialEditor
                  key={editing?.id || 'new'}
                  material={editing}
                  saved={() => {
                    setEditing(null);
                    saved();
                  }}
                />
              </section>
              <section className="panel">
                {filters}
                <MaterialRows
                  items={items as Material[]}
                  busy={busy}
                  ready={ready}
                  onSelect={(m) => setEditing(m)}
                />
                {paging}
              </section>
            </>
          ) : (
            <>
              <section className="panel">
                <Enrollment locations={locations} saved={saved} />
              </section>
              <section className="panel">
                {filters}
                <StockRows
                  items={items as InventoryItem[]}
                  busy={busy}
                  ready={ready}
                  onSelect={setSelected}
                  selected={selected?.inventoryId}
                />
                {paging}
              </section>
              {selected && (
                <section className="panel">
                  <h2>
                    {selected.initialized ? 'Koreksi saldo' : 'Konfirmasi saldo awal'} · {selected.mmid}
                  </h2>
                  <p className="muted">
                    {selected.description} · {selected.locationName}
                  </p>
                  <StockTransaction
                    key={`${selected.inventoryId}-${selected.inventoryVersion}`}
                    item={selected}
                    kind={selected.initialized ? 'adjustment' : 'opening'}
                    onSaved={(m) => {
                      setSelected(null);
                      saved(m);
                    }}
                  />
                  <InventoryEditor
                    key={`${selected.inventoryId}-${selected.inventoryVersion}`}
                    item={selected}
                    saved={() => {
                      setSelected(null);
                      saved();
                    }}
                  />
                </section>
              )}
            </>
          )}
        </>
      ) : (
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>
                {view === 'history'
                  ? 'Pergerakan stok'
                  : view === 'audit'
                    ? 'Audit aplikasi'
                    : 'Ketersediaan material'}
              </h2>
              <small>{checked ? `Diperbarui ${formatDate(checked)} WIB` : ''}</small>
            </div>
            <Button className="secondary small" busy={busy} onClick={() => setRefresh((v) => v + 1)}>
              Perbarui
            </Button>
          </div>
          {view === 'stock' && (
            <div className="stock-tabs">
              <Button
                className={!catalog ? 'primary small' : 'secondary small'}
                aria-pressed={!catalog}
                onClick={() => setCatalog(false)}
              >
                Stok lokasi
              </Button>
              <Button
                className={catalog ? 'primary small' : 'secondary small'}
                aria-pressed={catalog}
                onClick={() => setCatalog(true)}
              >
                Katalog master
              </Button>
            </div>
          )}
          {view !== 'audit' && filters}
          {view === 'history' ? (
            <MovementRows items={items as Movement[]} busy={busy} ready={ready} onSelect={setMovement} />
          ) : view === 'audit' ? (
            <div className="stock-audit-list" aria-busy={busy} role="list">
              {(items as AuditItem[]).map((v) => (
                <article className="stock-audit-row" key={v.id} role="listitem">
                  <div>
                    <strong>
                      {(
                        {
                          'stock.opening': 'Saldo awal',
                          'stock.receipt': 'Penerimaan',
                          'stock.issue': 'Pemakaian',
                          'stock.adjustment': 'Koreksi',
                          'material.saved': 'Master material diperbarui',
                          'location.saved': 'Lokasi diperbarui',
                          'inventory.saved': 'Daftar stok diperbarui',
                          'catalog.imported': 'Impor katalog',
                        } as Record<string, string>
                      )[v.action] || v.action}
                    </strong>
                    <small>
                      {formatDate(v.createdAt)} WIB · {v.actorName}
                    </small>
                  </div>
                  <details>
                    <summary>Detail audit</summary>
                    <pre className="stock-audit-details">
                      {JSON.stringify(JSON.parse(v.details), null, 2)}
                    </pre>
                  </details>
                </article>
              ))}
              {!items.length && <p className="empty">{ready ? 'Belum ada audit.' : 'Memuat audit?'}</p>}
            </div>
          ) : catalog ? (
            <MaterialRows
              items={items as Material[]}
              busy={busy}
              ready={ready}
              onSelect={(m) => void openMaterial(m.id)}
            />
          ) : (
            <StockRows
              items={items as InventoryItem[]}
              busy={busy}
              ready={ready}
              onSelect={(m) => void openMaterial(m.id)}
            />
          )}
          {paging}
          {view === 'stock' && (
            <p className="fine">
              Pengecekan tidak mencadangkan barang. Saldo diperiksa kembali ketika transaksi disimpan.
            </p>
          )}
        </section>
      )}
      <Overlay
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.material.mmid} · Detail material` : 'Detail material'}
        kind="dialog"
      >
        {detail && (
          <>
            <h2>{detail.material.description}</h2>
            <dl className="stock-detail-grid">
              {[
                ['Nama umum', detail.material.commonName || '—'],
                ['Satuan', detail.material.unit],
                ['Kategori', detail.material.category],
                ['MRP Type', detail.material.mrpType || '—'],
                ['Critical part', detail.material.critical ? 'Ya' : 'Tidak'],
                [
                  'Isi per pack',
                  detail.material.packSize
                    ? `${quantity(detail.material.packSize)} ${detail.material.unit}`
                    : 'Belum diatur',
                ],
                ['Status', detail.material.active ? 'Aktif' : 'Nonaktif'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <h3>Stok pada lokasi Anda</h3>
            {!detail.stocks.length ? (
              <p className="empty">Belum terdaftar pada lokasi Anda.</p>
            ) : (
              detail.stocks.map((i) => (
                <article className="stock-detail-location" key={i.inventoryId}>
                  <strong>
                    {i.locationName} ·{' '}
                    {i.initialized ? quantity(i.quantity) + ' ' + i.unit : 'Belum dihitung'}
                  </strong>
                  <small>Rak: {i.rack || 'Belum diatur'}</small>
                  <div className="inline">
                    {canConsume(identity, 'issue', i.locationId) &&
                      i.initialized &&
                      decimalUnits(i.quantity) > 0n && (
                        <a
                          className="button primary small"
                          href={`/consumables/issue?material=${i.id}&location=${i.locationId}`}
                        >
                          Catat pemakaian
                        </a>
                      )}
                    {canConsume(identity, 'receive', i.locationId) && i.initialized && (
                      <a
                        className="button secondary small"
                        href={`/consumables/receive?material=${i.id}&location=${i.locationId}`}
                      >
                        Penerimaan
                      </a>
                    )}
                    <a href={`/consumables/history?material=${i.id}&location=${i.locationId}`}>Riwayat</a>
                  </div>
                </article>
              ))
            )}
            {admin && <a href="/consumables/manage">Kelola material dan lokasi ↗</a>}
          </>
        )}
      </Overlay>
      <Overlay open={!!movement} onClose={() => setMovement(null)} title="Detail transaksi" kind="dialog">
        {movement && (
          <>
            <span className="badge neutral">{labels[movement.type]}</span>
            <h2>
              {movement.mmid} · {movement.description}
            </h2>
            <dl className="stock-detail-grid">
              {[
                ['Lokasi', movement.locationName],
                ['Perubahan stok', quantity(movement.quantity) + ' ' + movement.unit],
                ['Saldo sesudah pencatatan', quantity(movement.balanceAfter) + ' ' + movement.unit],
                [
                  'Kemasan',
                  movement.packs
                    ? `${movement.packs} pack × ${quantity(movement.packSize!)} ${movement.unit}`
                    : 'Satuan dasar',
                ],
                ['Referensi', movement.reference || '—'],
                ['Pekerjaan', movement.job || '—'],
                ['WO', movement.wo || '—'],
                ['Alasan', movement.reason || '—'],
                ['Pencatat', movement.actorName],
                ['Waktu WIB', formatDate(movement.createdAt)],
                ['ID transaksi', movement.id],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </Overlay>
    </>
  );
}
function StockRows({
  items,
  busy,
  ready,
  onSelect,
  selected,
}: {
  items: InventoryItem[];
  busy: boolean;
  ready: boolean;
  onSelect: (m: InventoryItem) => void;
  selected?: string;
}) {
  return (
    <div className="stock-table" aria-busy={busy}>
      <div className="stock-table-head">
        <span>Material</span>
        <span>Lokasi / rak</span>
        <span>Saldo</span>
      </div>
      {items.map((m) => (
        <button
          type="button"
          className={`stock-table-row${selected === m.inventoryId ? ' selected' : ''}`}
          key={m.inventoryId}
          onClick={() => onSelect(m)}
        >
          <span>
            <strong>{m.mmid}</strong>
            {m.description}
            <small>
              {m.commonName}
              {m.critical ? ' · Critical' : ''}
              {!m.active || !m.inventoryActive || !m.locationActive ? ' · Nonaktif' : ''}
            </small>
          </span>
          <span>
            {m.locationName}
            <small>{m.rack || 'Rak belum diatur'}</small>
          </span>
          <span>
            <strong>{m.initialized ? quantity(m.quantity) : 'Belum dihitung'}</strong>
            <small>{m.initialized ? m.unit : 'Konfirmasi saldo awal'}</small>
          </span>
        </button>
      ))}
      {!items.length && (
        <p className="empty">{ready ? 'Tidak ada material sesuai filter.' : 'Memuat stok…'}</p>
      )}
    </div>
  );
}
function MaterialRows({
  items,
  busy,
  ready,
  onSelect,
}: {
  items: Material[];
  busy: boolean;
  ready: boolean;
  onSelect: (m: Material) => void;
}) {
  return (
    <div className="stock-table" aria-busy={busy}>
      <div className="stock-table-head">
        <span>SAP/MMID</span>
        <span>Nama material</span>
        <span>Satuan</span>
      </div>
      {items.map((m) => (
        <button type="button" className="stock-table-row" key={m.id} onClick={() => onSelect(m)}>
          <strong>{m.mmid}</strong>
          <span>
            {m.description}
            <small>
              {m.commonName} · {m.category}
              {!m.active ? ' · Nonaktif' : ''}
            </small>
          </span>
          <span>{m.unit}</span>
        </button>
      ))}
      {!items.length && <p className="empty">{ready ? 'Material tidak ditemukan.' : 'Memuat katalog…'}</p>}
    </div>
  );
}
function MovementRows({
  items,
  busy,
  ready,
  onSelect,
}: {
  items: Movement[];
  busy: boolean;
  ready: boolean;
  onSelect: (m: Movement) => void;
}) {
  return (
    <div className="stock-table" aria-busy={busy}>
      <div className="stock-table-head">
        <span>Material / lokasi</span>
        <span>Transaksi</span>
        <span>Jumlah</span>
      </div>
      {items.map((m) => (
        <button type="button" className="stock-table-row" key={m.id} onClick={() => onSelect(m)}>
          <span>
            <strong>
              {m.mmid} · {m.description}
            </strong>
            <small>
              {m.locationName} · {m.reference || m.job || m.reason}
            </small>
          </span>
          <span>
            {labels[m.type]}
            <small>
              {formatDate(m.createdAt)} · {m.actorName}
            </small>
          </span>
          <strong>
            {quantity(m.quantity)} {m.unit}
          </strong>
        </button>
      ))}
      {!items.length && (
        <p className="empty">{ready ? 'Belum ada transaksi sesuai filter.' : 'Memuat riwayat…'}</p>
      )}
    </div>
  );
}
function StockTransaction({
  item,
  kind,
  onSaved,
}: {
  item: InventoryItem;
  kind: keyof typeof labels;
  onSaved: (m: string) => void;
}) {
  const [amount, setAmount] = useState(''),
    [mode, setMode] = useState('base'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [pending, setPending] = useState<{ fingerprint: string; key: string } | null>(null),
    [success, setSuccess] = useState(false);
  const confirm = useConfirmation();
  const adjustment = kind === 'opening' || kind === 'adjustment';
  let after: string | null = null;
  try {
    if (mode === 'pack' && kind === 'receipt' && !/^\d+$/.test(amount)) throw Error();
    const q = decimalUnits(localDecimal(amount));
    const delta =
      mode === 'pack' && kind === 'receipt' ? (q / 1000000n) * decimalUnits(item.packSize || '0') : q;
    after = decimalString(adjustment ? q : decimalUnits(item.quantity) + (kind === 'issue' ? -delta : delta));
  } catch {}
  return (
    <>
      <p className="muted">
        <strong>
          {item.mmid} · {item.description}
        </strong>
        <br />
        {item.locationName} · Saldo:{' '}
        {item.initialized ? quantity(item.quantity) + ' ' + item.unit : 'Belum dihitung'}
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!adjustment && !item.initialized ? (
        <p className="notice">Admin perlu mengonfirmasi saldo awal terlebih dahulu.</p>
      ) : (
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || success) return;
            const f = new FormData(e.currentTarget);
            const body: Record<string, unknown> = { materialId: item.id, locationId: item.locationId };
            if (adjustment) {
              body.quantity = localDecimal(amount);
              body.reason = f.get('reason');
              body.expectedVersion = item.inventoryVersion;
            } else if (kind === 'issue') {
              body.quantity = localDecimal(amount);
              body.job = f.get('job');
              body.wo = f.get('wo');
              body.reference = f.get('reference');
            } else {
              body.mode = mode;
              body.reference = f.get('reference');
              if (mode === 'pack') {
                if (!/^\d+$/.test(amount)) {
                  setError('Jumlah pack harus bilangan bulat.');
                  return;
                }
                body.packs = Number(amount);
                body.materialVersion = item.version;
              } else body.quantity = localDecimal(amount);
            }
            if (
              adjustment &&
              !(await confirm(
                `${labels[kind]} ${item.mmid} di ${item.locationName}: jumlah fisik ${amount} ${item.unit}?`,
              ))
            )
              return;
            const fingerprint = JSON.stringify(body),
              key = pending?.fingerprint === fingerprint ? pending.key : crypto.randomUUID();
            setPending({ fingerprint, key });
            setBusy(true);
            setError('');
            try {
              const result = await send(
                '/' +
                  {
                    opening: 'opening-balances',
                    receipt: 'receipts',
                    issue: 'issues',
                    adjustment: 'adjustments',
                  }[kind],
                body,
                'POST',
                key,
              );
              setSuccess(true);
              onSaved(`${labels[kind]} tersimpan. ID ${result.movement.id}.`);
            } catch (err) {
              setError(
                (err as Error).message +
                  ' Jika koneksi terputus, coba simpan kembali; key permintaan tetap digunakan.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {kind === 'receipt' && (
            <label>
              Mode penerimaan
              <Select
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  setAmount('');
                }}
              >
                <option value="base">Satuan dasar ({item.unit})</option>
                <option value="pack" disabled={!item.packSize}>
                  Pack{item.packSize ? ` · ${quantity(item.packSize)} ${item.unit}` : ' · belum diatur'}
                </option>
              </Select>
            </label>
          )}
          <label>
            {adjustment
              ? 'Jumlah fisik'
              : kind === 'receipt' && mode === 'pack'
                ? 'Jumlah pack'
                : `Jumlah (${item.unit})`}
            <Input
              required
              inputMode={mode === 'pack' ? 'numeric' : 'decimal'}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={adjustment ? '0 atau hasil hitung fisik' : 'Jumlah positif'}
            />
          </label>
          {adjustment ? (
            <label>
              Alasan / keterangan hitung fisik
              <Textarea name="reason" required maxLength={500} />
            </label>
          ) : (
            <>
              <label>
                Referensi {kind === 'receipt' ? 'penerimaan' : 'tambahan (opsional)'}
                <Input name="reference" required={kind === 'receipt'} maxLength={200} />
              </label>
              {kind === 'issue' && (
                <>
                  <label>
                    Pekerjaan / equipment
                    <Textarea name="job" required maxLength={500} />
                  </label>
                  <label>
                    WO Number (opsional)
                    <Input name="wo" maxLength={100} />
                  </label>
                </>
              )}
            </>
          )}
          <div className="stock-preview">
            <span>{adjustment ? 'Saldo sesuai hitung fisik' : 'Perkiraan saldo setelah transaksi'}</span>
            <strong>{after !== null ? quantity(after) + ' ' + item.unit : '—'}</strong>
            <small>Saldo diperiksa kembali oleh server saat menyimpan.</small>
          </div>
          <Button
            className="primary"
            busy={busy}
            disabled={success || after === null || (after !== null && decimalUnits(after, true) < 0n)}
          >
            Simpan {labels[kind].toLowerCase()}
          </Button>
        </form>
      )}
    </>
  );
}
function MaterialPicker({
  selected,
  onSelect,
}: {
  selected: Material | null;
  onSelect: (m: Material) => void;
}) {
  const [q, setQ] = useState(''),
    [items, setItems] = useState<Material[]>([]),
    [error, setError] = useState(''),
    [index, setIndex] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    const t = setTimeout(() => {
      fetch(api + '/materials?limit=8&q=' + encodeURIComponent(q), { cache: 'no-store', signal: c.signal })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          setItems(d.items);
          setError('');
          setIndex(0);
        })
        .catch((e) => {
          if (e.name !== 'AbortError') setError(e.message);
        });
    }, 200);
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [q]);
  return (
    <div>
      <label>
        Cari master material
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-controls="material-options"
          role="combobox"
          aria-expanded={items.length > 0}
          aria-autocomplete="list"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((v) => Math.min(items.length - 1, v + 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((v) => Math.max(0, v - 1));
            }
            if (e.key === 'Enter' && items[index]) {
              e.preventDefault();
              onSelect(items[index]);
            }
            if (e.key === 'Escape') setItems([]);
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="stock-picker" id="material-options" role="listbox">
        {items.map((m, i) => (
          <button
            className={i === index ? 'highlight' : ''}
            type="button"
            role="option"
            aria-selected={selected?.id === m.id}
            key={m.id}
            onClick={() => onSelect(m)}
          >
            {m.mmid} · {m.description}
          </button>
        ))}
      </div>
      {selected && (
        <p className="notice">
          Dipilih: {selected.mmid} · {selected.description}
        </p>
      )}
    </div>
  );
}
function MaterialEditor({ material, saved }: { material: Material | null; saved: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const f = new FormData(e.currentTarget);
        const form = e.currentTarget;
        const body = {
          mmid: material?.mmid || f.get('mmid'),
          description: f.get('description'),
          commonName: f.get('commonName'),
          unit: f.get('unit'),
          category: f.get('category'),
          mrpType: f.get('mrpType'),
          critical: f.has('critical'),
          active: f.has('active'),
          packSize: f.get('packSize') ? localDecimal(String(f.get('packSize'))) : null,
          ...(material ? { version: material.version } : {}),
        };
        try {
          await send('/materials' + (material ? '/' + material.id : ''), body, material ? 'PATCH' : 'POST');
          form.reset();
          saved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{material ? 'Edit master material' : 'Tambah master material'}</h2>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="form-grid">
        <label>
          SAP/MMID
          <Input name="mmid" required maxLength={80} defaultValue={material?.mmid} disabled={!!material} />
        </label>
        <label>
          Nama asli / part description
          <Input name="description" required maxLength={160} defaultValue={material?.description} />
        </label>
        <label>
          Nama umum
          <Input name="commonName" maxLength={160} defaultValue={material?.commonName} />
        </label>
        <label>
          Satuan dasar
          <Input name="unit" required maxLength={30} defaultValue={material?.unit} />
        </label>
        <label>
          Kategori
          <Input name="category" required maxLength={100} defaultValue={material?.category} />
        </label>
        <label>
          MRP Type
          <Input name="mrpType" maxLength={30} defaultValue={material?.mrpType} />
        </label>
        <label>
          Isi per pack (opsional)
          <Input
            name="packSize"
            inputMode="decimal"
            defaultValue={material?.packSize || ''}
            placeholder="Belum diatur"
          />
        </label>
      </div>
      <div className="inline">
        <label>
          <input type="checkbox" name="critical" defaultChecked={material?.critical} />
          Critical part
        </label>
        <label>
          <input type="checkbox" name="active" defaultChecked={material?.active ?? true} />
          Aktif
        </label>
      </div>
      <Button className="primary" busy={busy}>
        Simpan master material
      </Button>
    </form>
  );
}
function LocationManagement({ locations, saved }: { locations: StockLocation[]; saved: () => void }) {
  return (
    <section className="panel">
      <h2>Lokasi penyimpanan</h2>
      <LocationEditor saved={saved} />
      <div className="stock-location-list">
        {locations.map((l) => (
          <LocationEditor key={`${l.id}-${l.version}`} location={l} saved={saved} />
        ))}
      </div>
    </section>
  );
}
function LocationEditor({ location, saved }: { location?: StockLocation; saved: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="form-stack stock-location-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const f = new FormData(e.currentTarget),
          form = e.currentTarget;
        try {
          await send(
            '/locations' + (location ? '/' + location.id : ''),
            {
              name: f.get('name'),
              active: f.has('active'),
              ...(location ? { version: location.version } : {}),
            },
            location ? 'PATCH' : 'POST',
          );
          if (!location) form.reset();
          saved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <label>
        {location ? 'Nama lokasi' : 'Nama lokasi baru'}
        <Input name="name" defaultValue={location?.name} required maxLength={100} />
      </label>
      <label className="inline">
        <input type="checkbox" name="active" defaultChecked={location?.active ?? true} />
        Lokasi aktif
      </label>
      <Button className="secondary small" busy={busy}>
        {location ? 'Simpan lokasi' : 'Tambah lokasi'}
      </Button>
    </form>
  );
}
function Enrollment({ locations, saved }: { locations: StockLocation[]; saved: () => void }) {
  const [m, setM] = useState<Material | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!m) {
          setError('Pilih master material.');
          return;
        }
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError('');
        try {
          await send('/inventory', {
            materialId: m.id,
            locationId: f.get('locationId'),
            rack: f.get('rack'),
            active: true,
          });
          saved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Daftarkan material ke lokasi</h2>
      <p className="fine">
        Sesudah didaftarkan, pilih material di bawah untuk mengonfirmasi saldo awal termasuk jika nol.
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <MaterialPicker selected={m} onSelect={setM} />
      <div className="form-grid">
        <label>
          Lokasi
          <Select name="locationId" required>
            <option value="">Pilih lokasi</option>
            {locations
              .filter((l) => l.active)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </Select>
        </label>
        <label>
          Lokasi rak (opsional)
          <Input name="rack" maxLength={100} />
        </label>
      </div>
      <Button className="primary" busy={busy} disabled={!locations.some((l) => l.active)}>
        Daftarkan stok lokasi
      </Button>
    </form>
  );
}
function InventoryEditor({ item, saved }: { item: InventoryItem; saved: () => void }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        try {
          await send(
            '/inventory/' + item.inventoryId,
            {
              materialId: item.id,
              locationId: item.locationId,
              rack: f.get('rack'),
              active: f.has('active'),
              version: item.inventoryVersion,
            },
            'PATCH',
          );
          saved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Rak dan status daftar stok</h3>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <label>
        Lokasi rak
        <Input name="rack" maxLength={100} defaultValue={item.rack} />
      </label>
      <label className="inline">
        <input type="checkbox" name="active" defaultChecked={item.inventoryActive} />
        Daftar stok aktif
      </label>
      <Button className="secondary" busy={busy}>
        Simpan rak / status
      </Button>
    </form>
  );
}
