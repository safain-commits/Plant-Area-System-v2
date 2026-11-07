'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Button,
  Input,
  Select,
  Textarea,
  Overlay,
  useConfirmation,
  TableSkeleton,
  EmptyState,
  useDebouncedValue,
} from '@plant/ui';
import { AddToOrder } from './add-to-order';
import { AliasInput } from './alias-input';
import {
  canConsume,
  formatDate,
  formatQuantity,
  localDecimal,
  decimalUnits,
  decimalString,
  allowsDecimals,
  type Identity,
  type Material,
  type InventoryItem,
  type Movement,
} from '@plant/contracts';
type AuditItem = { id: string; action: string; actorName: string; createdAt: string; details: string };
type ListItem = Material | InventoryItem | Movement | AuditItem;
const api = '/consumables/api';
const labels = {
  opening: 'Saldo awal',
  receipt: 'Penerimaan',
  issue: 'Pemakaian',
  return: 'Return Order',
  adjustment: 'Koreksi',
};
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
export function ConsumablesWorkspace({
  identity,
  view,
  initialType = '',
}: {
  identity: Identity;
  view: string;
  initialType?: string;
}) {
  const [query, setQuery] = useState(''),
    [availability, setAvailability] = useState(''),
    [category, setCategory] = useState(''),
    [type, setType] = useState(initialType),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [catalog, setCatalog] = useState(false),
    [showInactive, setShowInactive] = useState(false);
  const [items, setItems] = useState<ListItem[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [next, setNext] = useState<string | null>(null),
    [back, setBack] = useState<(string | null)[]>([]),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [refresh, setRefresh] = useState(0),
    [checked, setChecked] = useState('');
  const [detail, setDetail] = useState<{ material: Material; stock: InventoryItem | null } | null>(null),
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
  const debouncedQuery = useDebouncedValue(query);
  const detailRequest = useRef<AbortController | null>(null);
  useEffect(() => () => detailRequest.current?.abort(), []);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const p = new URLSearchParams({ q: debouncedQuery });
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
    [view, debouncedQuery, cursor, availability, category, type, from, to, catalog, management, showInactive],
  );
  useEffect(() => {
    const controller = new AbortController();
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
          setReady(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => {
      controller.abort();
    };
  }, [load, refresh]);
  useEffect(() => {
    setCursor(null);
    setBack([]);
  }, [debouncedQuery, availability, category, type, from, to, catalog, management, showInactive]);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (['available', 'empty', 'uncounted', 'critical'].includes(p.get('availability') || ''))
      setAvailability(p.get('availability')!);
    if (p.get('movement'))
      get('/movements/' + encodeURIComponent(p.get('movement')!))
        .then((d) => setMovement(d.movement))
        .catch((e) => setError(e.message));
    if (p.get('material'))
      get('/materials/' + encodeURIComponent(p.get('material')!))
        .then((d) => {
          if (view === 'stock') setDetail(d);
          else if (view === 'history') setQuery(d.material.mmid);
          else setSelected(d.stock);
        })
        .catch((e) => setError(e.message));
  }, [view]);
  async function openMaterial(id: string) {
    try {
      detailRequest.current?.abort();
      const c = new AbortController();
      detailRequest.current = c;
      const value = await get('/materials/' + id, c.signal);
      if (!c.signal.aborted) setDetail(value);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
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
      {view === 'manage' ? (
        <>
          <div className="stock-tabs" role="group" aria-label="Pengelolaan">
            {[
              ['materials', 'Master material'],
              ['inventory', 'Stok, rak & saldo awal'],
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
          {management === 'materials' ? (
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
                <Enrollment saved={saved} />
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
                  <p className="muted">{selected.description}</p>
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
                Stok R22
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
            <MovementRows
              items={items as Movement[]}
              busy={busy}
              ready={ready}
              onSelect={setMovement}
              selected={movement?.id}
            />
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
              {!items.length && (
                <>
                  {!ready ? (
                    <TableSkeleton rows={5} />
                  ) : (
                    <EmptyState title="Belum ada audit." description="Coba kata kunci atau filter lain." />
                  )}
                </>
              )}
            </div>
          ) : catalog ? (
            <MaterialRows
              items={items as Material[]}
              busy={busy}
              ready={ready}
              onSelect={(m) => void openMaterial(m.id)}
              selected={catalog ? detail?.material.id : detail?.stock?.inventoryId}
            />
          ) : (
            <StockRows
              items={items as InventoryItem[]}
              busy={busy}
              ready={ready}
              onSelect={(m) => void openMaterial(m.id)}
              selected={catalog ? detail?.material.id : detail?.stock?.inventoryId}
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
        onClose={() => {
          detailRequest.current?.abort();
          setDetail(null);
        }}
        title={detail ? `${detail.material.mmid} · Detail material` : 'Detail material'}
        kind="sheet"
        onNavigate={(direction) => {
          const i = items.findIndex((m) => m.id === detail?.material.id);
          const next = items[i + direction];
          if (i >= 0 && next) void openMaterial(next.id);
        }}
      >
        {detail && (
          <>
            <h2>{detail.material.commonName || detail.material.description}</h2>
            <p className="muted">
              {detail.material.mmid} · {detail.material.description}
            </p>
            <dl className="stock-detail-grid">
              {[
                ['Nama umum', detail.material.commonName || '—'],
                ['Satuan', detail.material.unit],
                ['Kategori', detail.material.category],
                ['MRP Type', detail.material.mrpType || '—'],
                ['Material kritis', detail.material.critical ? 'Ya' : 'Tidak'],
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
            <h3>Stok R22</h3>
            {!detail.stock ? (
              <p className="empty">Belum terdaftar di stok R22.</p>
            ) : (
              [detail.stock].map((i) => (
                <article className="stock-detail-location" key={i.inventoryId}>
                  <strong>{i.initialized ? quantity(i.quantity) + ' ' + i.unit : 'Belum dihitung'}</strong>
                  <small>Rak: {i.rack || 'Belum diatur'}</small>
                  <AddToOrder identity={identity} item={i} />
                  <div className="inline">
                    {canConsume(identity, 'receive') && i.initialized && (
                      <a className="button secondary small" href={`/consumables/picklist?material=${i.id}`}>
                        Penerimaan Picklist
                      </a>
                    )}
                    <a href={`/consumables/history?material=${i.id}`}>Riwayat</a>
                  </div>
                </article>
              ))
            )}
            {admin && <a href="/consumables/manage">Kelola material dan stok</a>}
          </>
        )}
      </Overlay>
      <Overlay
        open={!!movement}
        onClose={() => setMovement(null)}
        title="Detail transaksi"
        kind="sheet"
        onNavigate={(direction) => {
          const i = items.findIndex((m) => m.id === movement?.id);
          if (i >= 0 && items[i + direction]) setMovement(items[i + direction] as Movement);
        }}
      >
        {movement && (
          <>
            <span className="badge neutral">{labels[movement.type]}</span>
            <h2>
              {movement.mmid} · {movement.description}
            </h2>
            <dl className="stock-detail-grid">
              {[
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
        <span>Rak</span>
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
            <strong>{m.commonName || m.description}</strong>
            {m.mmid} · {m.description}
            <small>
              {m.critical ? ' · Kritis' : ''}
              {!m.active || !m.inventoryActive ? ' · Nonaktif' : ''}
            </small>
          </span>
          <span>{m.rack || 'Belum diatur'}</span>
          <span>
            {m.initialized ? (
              <strong>
                {quantity(m.quantity)} <small>{m.unit}</small>
              </strong>
            ) : (
              <span className="badge neutral">Belum dihitung</span>
            )}
            {!m.initialized && <small>Konfirmasi saldo awal</small>}
          </span>
        </button>
      ))}
      {!items.length && (
        <>
          {!ready ? (
            <TableSkeleton rows={5} />
          ) : (
            <EmptyState
              title="Tidak ada material sesuai filter."
              description="Coba kata kunci atau filter lain."
            />
          )}
        </>
      )}
    </div>
  );
}
function MaterialRows({
  items,
  busy,
  ready,
  onSelect,
  selected,
}: {
  items: Material[];
  busy: boolean;
  ready: boolean;
  selected?: string;
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
        <button
          type="button"
          className={`stock-table-row${selected === m.id ? ' selected' : ''}`}
          key={m.id}
          onClick={() => onSelect(m)}
        >
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
      {!items.length && (
        <>
          {!ready ? (
            <TableSkeleton rows={5} />
          ) : (
            <EmptyState title="Material tidak ditemukan." description="Coba kata kunci atau filter lain." />
          )}
        </>
      )}
    </div>
  );
}
function MovementRows({
  items,
  busy,
  ready,
  onSelect,
  selected,
}: {
  items: Movement[];
  busy: boolean;
  ready: boolean;
  selected?: string;
  onSelect: (m: Movement) => void;
}) {
  return (
    <div className="stock-table" aria-busy={busy}>
      <div className="stock-table-head">
        <span>Material</span>
        <span>Transaksi</span>
        <span>Jumlah</span>
      </div>
      {items.map((m) => (
        <button
          type="button"
          className={`stock-table-row${selected === m.id ? ' selected' : ''}`}
          key={m.id}
          onClick={() => onSelect(m)}
        >
          <span>
            <strong>
              {m.mmid} · {m.description}
            </strong>
            <small>{m.reference || m.job || m.reason}</small>
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
        <>
          {!ready ? (
            <TableSkeleton rows={5} />
          ) : (
            <EmptyState
              title="Belum ada transaksi sesuai filter."
              description="Coba kata kunci atau filter lain."
            />
          )}
        </>
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
  kind: 'opening' | 'adjustment';
  onSaved: (message: string) => void;
}) {
  const [amount, setAmount] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(false),
    [pending, setPending] = useState<{ fingerprint: string; key: string } | null>(null);
  const confirm = useConfirmation();
  let after: string | null = null;
  try {
    after = decimalString(decimalUnits(localDecimal(amount)));
  } catch {}
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || success) return;
        const body = {
          materialId: item.id,
          quantity: localDecimal(amount),
          reason: new FormData(e.currentTarget).get('reason'),
          expectedVersion: item.inventoryVersion,
        };
        if (
          !(await confirm(`${labels[kind]} ${item.mmid} di R22: jumlah fisik ${amount} ${item.unit}?`, {
            title: `Konfirmasi ${labels[kind]}`,
            confirmLabel: `Simpan ${labels[kind]}`,
            variant: 'primary',
          }))
        )
          return;
        const fingerprint = JSON.stringify(body),
          key = pending?.fingerprint === fingerprint ? pending.key : crypto.randomUUID();
        setPending({ fingerprint, key });
        setBusy(true);
        setError('');
        try {
          const result = await send(
            kind === 'opening' ? '/opening-balances' : '/adjustments',
            body,
            'POST',
            key,
          );
          setSuccess(true);
          onSaved(`${labels[kind]} tersimpan. ID ${result.movement.id}.`);
        } catch (e) {
          setError(
            (e as Error).message + ' Jika koneksi terputus, key permintaan yang sama tetap digunakan.',
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="muted">
        {item.commonName || item.description} · Saldo:{' '}
        {item.initialized ? quantity(item.quantity) + ' ' + item.unit : 'Belum dihitung'}
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <label>
        <span>Jumlah fisik </span>
        <Input
          required
          inputMode={item.decimalAllowed ? 'decimal' : 'numeric'}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0 atau hasil hitung fisik"
        />
      </label>
      <label>
        <span>Alasan / keterangan hitung fisik </span>
        <Textarea name="reason" required maxLength={500} />
      </label>
      <div className="stock-preview">
        <span>Saldo sesuai hitung fisik</span>
        <strong>{after !== null ? quantity(after) + ' ' + item.unit : '—'}</strong>
        <small>Saldo dan versi diperiksa kembali oleh server.</small>
      </div>
      <Button className="primary" busy={busy} disabled={success || after === null}>
        Simpan {labels[kind].toLowerCase()}
      </Button>
    </form>
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
  const [unit, setUnit] = useState(material?.unit || ''),
    [sapUnit, setSapUnit] = useState(material?.sapUnit || ''),
    [decimalAllowed, setDecimalAllowed] = useState(material?.decimalAllowed ?? true),
    [reviewed, setReviewed] = useState(material?.conversionReviewed ?? true);
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
          sapUnit: f.get('sapUnit'),
          aliases: f.get('aliases'),
          decimalAllowed,
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
          <span>SAP/MMID </span>
          <Input name="mmid" required maxLength={80} defaultValue={material?.mmid} disabled={!!material} />
        </label>
        <label>
          <span>Nama asli / part description </span>
          <Input name="description" required maxLength={160} defaultValue={material?.description} />
        </label>
        <label>
          Nama umum
          <Input name="commonName" maxLength={160} defaultValue={material?.commonName} />
          <small>Nama yang dikenal di lapangan, mis. Baut M16.</small>
        </label>
        <AliasInput initial={material?.aliases || ''} />
        <label>
          <span>Satuan SAP </span>
          <Input
            name="sapUnit"
            required
            maxLength={30}
            value={sapUnit}
            onChange={(e) => setSapUnit(e.target.value)}
            placeholder="SET, EA, KG…"
          />
        </label>
        <label>
          <span>Satuan R22 (terkecil) </span>
          <Input
            name="unit"
            required
            maxLength={30}
            value={unit}
            readOnly={!!material?.unitLocked}
            onChange={(e) => {
              setUnit(e.target.value);
              if (!material) setDecimalAllowed(allowsDecimals(e.target.value));
            }}
          />
          <small>
            {material?.unitLocked ? 'Terkunci setelah transaksi pertama.' : 'Contoh: PCS atau KG.'}
          </small>
        </label>
        <label>
          <span>Kategori </span>
          <Input name="category" required maxLength={100} defaultValue={material?.category} />
        </label>
        <label>
          MRP Type
          <Input name="mrpType" maxLength={30} defaultValue={material?.mrpType} />
        </label>
        <label>
          Konversi SAP (opsional)
          <Input
            name="packSize"
            inputMode="decimal"
            defaultValue={material?.packSize || ''}
            placeholder="Belum diatur"
          />
          <small>
            1 {sapUnit || 'satuan SAP'} = N {unit || 'satuan R22'}. Kosong berarti 1 hanya jika kedua satuan
            sama.
          </small>
        </label>
      </div>
      <div className="inline">
        <label className="r22-onbehalf">
          <input
            type="checkbox"
            name="decimalAllowed"
            checked={decimalAllowed}
            onChange={(e) => setDecimalAllowed(e.target.checked)}
          />
          Izinkan desimal
        </label>
        <label>
          <input type="checkbox" name="critical" defaultChecked={material?.critical} />
          Material kritis
        </label>
        <label>
          <input type="checkbox" name="active" defaultChecked={material?.active ?? true} />
          Aktif
        </label>
      </div>
      {material && !material.conversionReviewed && (
        <label className="r22-onbehalf">
          <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
          Saya telah memeriksa satuan SAP dan faktor konversi lama.
        </label>
      )}
      <Button className="primary" busy={busy} disabled={!reviewed}>
        Simpan master material
      </Button>
    </form>
  );
}
function Enrollment({ saved }: { saved: () => void }) {
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
      <h2>Daftarkan material ke stok R22</h2>
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
          Rak (opsional)
          <Input name="rack" maxLength={100} />
        </label>
      </div>
      <Button className="primary" busy={busy}>
        Daftarkan material
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
        Rak (opsional)
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
