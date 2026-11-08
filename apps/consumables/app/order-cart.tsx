'use client';
import { useEffect, useRef, useState, useId } from 'react';
import {
  TableSkeleton,
  EmptyState,
  Button,
  Input,
  Textarea,
  Toast,
  useConfirmation,
  cartKey,
  readCart,
  writeCart,
  removeCart,
  emptyCart,
  type CartDraft,
} from '@plant/ui';
import {
  canConsume,
  normalizeHec,
  HEC_PATTERN,
  formatQuantity,
  decimalUnits,
  decimalString,
  localDecimal,
  validateStockQuantity,
  type Identity,
  type MaterialSearchResult,
  type StockLineConflict,
  type DocumentResult,
} from '@plant/contracts';
import { useCartFeedback } from './use-cart-feedback';
import { MaterialSearch } from './material-search';
import { QuantityDialog } from './quantity-dialog';
import { stockApi, StockApiError } from './r22-api';

export function OrderCart({ identity, type }: { identity: Identity; type: 'consume' | 'return' }) {
  const [draft, setDraft] = useState<CartDraft>(emptyCart),
    [loaded, setLoaded] = useState('');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [conflicts, setConflicts] = useState<StockLineConflict[]>([]),
    [success, setSuccess] = useState<DocumentResult | null>(null),
    [message, setMessage] = useState('');
  const [selected, setSelected] = useState<MaterialSearchResult | null>(null),
    [suggestions, setSuggestions] = useState<string[]>([]);
  const feedback = useCartFeedback(draft, setDraft, setMessage);
  const confirm = useConfirmation(),
    suggestionId = useId(),
    prefill = useRef('');
  const storageKey = cartKey(identity.id, type);
  useEffect(() => {
    if (!storageKey) {
      setLoaded('');
      return;
    }
    setDraft(readCart(storageKey));
    setLoaded(storageKey);
    setConflicts([]);
    setSuccess(null);
  }, [storageKey]);
  useEffect(() => {
    if (storageKey && loaded === storageKey && !success) writeCart(storageKey, draft);
  }, [storageKey, loaded, draft, success]);
  useEffect(() => {
    if (loaded !== storageKey || prefill.current === storageKey) return;
    const id = new URLSearchParams(window.location.search).get('material');
    if (!id) return;
    prefill.current = storageKey;
    stockApi('/materials/' + encodeURIComponent(id))
      .then((d) => {
        const stock = d.stock;
        if (stock) setSelected(stock);
        else setError('Material belum terdaftar di stok R22.');
      })
      .catch((e) => setError(e.message));
  }, [loaded, storageKey]);
  useEffect(() => {
    const c = new AbortController();
    const timer = setTimeout(() => {
      stockApi('/hec-suggestions?q=' + encodeURIComponent(draft.hec), { signal: c.signal })
        .then((d) => setSuggestions(d.items))
        .catch(() => setSuggestions([]));
    }, 200);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [draft.hec]);
  const update = (patch: Partial<CartDraft>) => {
    setDraft((v) => ({ ...v, ...patch }));
    setError('');
  };
  const add = (m: MaterialSearchResult, q: string) => {
    setDraft((v) => {
      const existing = v.lines.find((l) => l.material.id === m.id);
      return {
        ...v,
        lines: existing
          ? v.lines.map((l) =>
              l.material.id === m.id
                ? {
                    material: m,
                    quantity: decimalString(decimalUnits(localDecimal(l.quantity)) + decimalUnits(q)).replace(
                      /\.?0+$/,
                      '',
                    ),
                  }
                : l,
            )
          : [...v.lines, { material: m, quantity: q.replace(/\.?0+$/, '') }],
      };
    });
    feedback.added(m.id);
    setMessage(`${m.commonName || m.description} ditambahkan`);
  };
  const title = type === 'consume' ? 'Consume Order' : 'Return Order';
  const self = canConsume(identity, 'onbehalf') && draft.onbehalf ? draft.requesterName : identity.name;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || loaded !== storageKey) return;
    try {
      const hec = normalizeHec(draft.hec);
      if (!HEC_PATTERN.test(hec)) throw Error('HAC/SAC wajib dengan format XXX-XXX, contoh 452-BU1.');
      if (!draft.lines.length || draft.lines.length > 50)
        throw Error('Pilih 1–50 material unik dalam satu order.');
      const body = {
        hec,
        wo: draft.wo.trim(),
        note: draft.note.trim(),
        ...(type === 'return' ? { sourceRef: draft.sourceRef.trim() } : {}),
        ...(canConsume(identity, 'onbehalf') && draft.onbehalf
          ? { requester: { name: draft.requesterName.trim(), nik: draft.requesterNik.trim() } }
          : {}),
        lines: draft.lines.map((l) => ({
          materialId: l.material.id,
          quantity: validateStockQuantity(localDecimal(l.quantity), l.material.decimalAllowed),
        })),
      };
      if (canConsume(identity, 'onbehalf') && draft.onbehalf && !draft.requesterName.trim())
        throw Error('Nama peminta wajib diisi.');
      if (
        !(await confirm(
          `${title} · HAC/SAC ${hec} · WO ${draft.wo || '—'} · Peminta ${self} · ${body.lines.length} item. Finalisasi dan ${type === 'consume' ? 'kurangi' : 'tambahkan'} stok sekarang?`,
          {
            title: `Konfirmasi ${title}`,
            confirmLabel: `Finalisasi ${type === 'consume' ? 'Pemakaian' : 'Pengembalian'}`,
            variant: 'primary',
          },
        ))
      )
        return;
      const fingerprint = JSON.stringify(body),
        key = draft.pending?.fingerprint === fingerprint ? draft.pending.key : crypto.randomUUID();
      const next = { ...draft, hec, pending: { fingerprint, key } };
      setDraft(next);
      writeCart(storageKey, next);
      setBusy(true);
      setError('');
      setConflicts([]);
      const result = await stockApi(type === 'consume' ? '/consume-orders' : '/return-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(body),
      });
      feedback.clear();
      setSuccess(result);
      removeCart(storageKey);
      setDraft(emptyCart());
    } catch (e) {
      if (e instanceof StockApiError && e.lines.length) {
        setConflicts(e.lines);
        setDraft((v) => ({
          ...v,
          lines: v.lines.map((l) => {
            const c = (e as StockApiError).lines.find((c) => c.materialId === l.material.id);
            return c ? { ...l, material: { ...l.material, quantity: c.available } } : l;
          }),
        }));
      }
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (success)
    return (
      <section className="panel r22-success" role="status">
        <span className="badge">Dokumen final</span>
        <h2>{title} tersimpan</h2>
        <p className="display-lg">{success.document.number}</p>
        <p>
          {success.lines.length} item · HAC/SAC {success.document.hec} · {success.document.requesterName}
        </p>
        <div className="form-actions">
          <a className="button primary" href={`/consumables/documents/${success.document.id}`}>
            Lihat / Cetak bukti
          </a>
          <Button
            className="secondary"
            onClick={() => {
              setSuccess(null);
              setDraft(emptyCart());
              setError('');
            }}
          >
            Buat order baru
          </Button>
        </div>
      </section>
    );
  if (loaded !== storageKey)
    return (
      <section className="panel" role="status">
        <TableSkeleton rows={3} />
      </section>
    );
  return (
    <>
      {error && (
        <div className="notice error" role="alert">
          {error}{' '}
          <Button type="button" className="secondary small" onClick={() => window.location.reload()}>
            Perbarui data
          </Button>
        </div>
      )}
      <form
        onInvalid={(e) => e.currentTarget.classList.add('was-submitted')}
        onSubmit={submit}
        className="r22-order-layout"
      >
        <div className="r22-order-main">
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Informasi {title}</h2>
              </div>
              <span className="badge neutral">{type === 'consume' ? 'Stok keluar' : 'Stok masuk'}</span>
            </div>
            <fieldset disabled={busy || loaded !== storageKey} className="r22-fieldset">
              <div className="form-grid">
                <label>
                  <span>HAC/SAC / Lokasi fungsional </span>
                  <Input
                    required
                    maxLength={30}
                    value={draft.hec}
                    list={suggestionId}
                    onChange={(e) => update({ hec: e.target.value })}
                    onBlur={() => update({ hec: normalizeHec(draft.hec) })}
                    placeholder="452-BU1"
                  />
                  <small>Format XXX-XXX, contoh 452-BU1</small>
                  <datalist id={suggestionId}>
                    {suggestions.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </label>
                <label>
                  Nomor WO (opsional)
                  <Input value={draft.wo} maxLength={100} onChange={(e) => update({ wo: e.target.value })} />
                </label>
                {type === 'return' && (
                  <label>
                    No. Consume Order asal (opsional)
                    <Input
                      value={draft.sourceRef}
                      maxLength={100}
                      onChange={(e) => update({ sourceRef: e.target.value })}
                    />
                  </label>
                )}
                <label className="r22-span-all">
                  Keterangan / deskripsi pekerjaan (opsional)
                  <Textarea
                    value={draft.note}
                    maxLength={500}
                    onChange={(e) => update({ note: e.target.value })}
                  />
                </label>
              </div>
              {canConsume(identity, 'onbehalf') && (
                <label className="inline r22-onbehalf">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={draft.onbehalf}
                    onChange={(e) => update({ onbehalf: e.target.checked })}
                  />
                  Catat untuk pengguna lain
                </label>
              )}
              {canConsume(identity, 'onbehalf') && draft.onbehalf ? (
                <div className="form-grid">
                  <label>
                    <span>Nama peminta </span>
                    <Input
                      required
                      maxLength={100}
                      value={draft.requesterName}
                      onChange={(e) => update({ requesterName: e.target.value })}
                    />
                  </label>
                  <label>
                    NIK / Badge (opsional)
                    <Input
                      maxLength={30}
                      value={draft.requesterNik}
                      onChange={(e) => update({ requesterNik: e.target.value })}
                    />
                  </label>
                </div>
              ) : (
                <p className="fine">
                  Dicatat sebagai: <strong>{identity.name}</strong> · Mandiri
                </p>
              )}
            </fieldset>
          </section>
          <section className="panel">
            <MaterialSearch
              onSelect={(m) => {
                if (draft.lines.length >= 50 && !draft.lines.some((l) => l.material.id === m.id)) {
                  setError('Maksimal 50 material dalam satu order.');
                  return;
                }
                setSelected(m);
              }}
            />
            <div className="section-title r22-cart-title">
              <h2>
                Keranjang <span className="badge neutral">{draft.lines.length} item</span>
              </h2>
              {!!draft.lines.length && (
                <Button
                  type="button"
                  className="secondary small"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await confirm('Kosongkan seluruh item dalam keranjang ini?', {
                        title: 'Kosongkan keranjang',
                        confirmLabel: 'Kosongkan',
                        variant: 'danger',
                      })
                    ) {
                      feedback.clear();
                      update({ lines: [] });
                    }
                  }}
                >
                  Kosongkan
                </Button>
              )}
            </div>
            <div className="r22-cart-table" role="table" aria-label="Keranjang order">
              <div className="r22-cart-head" role="row">
                <span>No.</span>
                <span>Material</span>
                <span>Jumlah</span>
                <span>Satuan</span>
                <span>Aksi</span>
              </div>
              {!draft.lines.length ? (
                <EmptyState
                  title="Keranjang masih kosong"
                  description="Cari material, tentukan jumlah, lalu tambahkan ke order."
                />
              ) : (
                draft.lines.map((l, i) => {
                  const problem = conflicts.find((c) => c.materialId === l.material.id);
                  return (
                    <div
                      data-cart-material={l.material.id}
                      className={`r22-cart-row ${problem ? 'has-error' : ''} ${feedback.highlight === l.material.id ? 'is-new' : ''}`}
                      role="row"
                      key={l.material.id}
                    >
                      <span className="r22-line-no">{i + 1}</span>
                      <div>
                        <strong>{l.material.commonName || l.material.description}</strong>
                        <small>
                          <span className="code-text">{l.material.mmid}</span> · {l.material.description}
                        </small>
                        <small>
                          Stok: {formatQuantity(l.material.quantity)} {l.material.unit}
                          {l.material.rack ? ' · Rak ' + l.material.rack : ''}
                        </small>
                        {problem && (
                          <p className="error-text" role="alert">
                            {problem.error} Tersedia: {formatQuantity(problem.available)} {l.material.unit}
                          </p>
                        )}
                      </div>
                      <label className="r22-line-quantity">
                        <span className="sr-only">Jumlah {l.material.mmid}</span>
                        <Input
                          disabled={busy}
                          inputMode={l.material.decimalAllowed ? 'decimal' : 'numeric'}
                          value={l.quantity}
                          aria-invalid={!!problem}
                          onChange={(e) =>
                            setDraft((v) => ({
                              ...v,
                              lines: v.lines.map((row, j) =>
                                j === i ? { ...row, quantity: e.target.value } : row,
                              ),
                            }))
                          }
                        />
                      </label>
                      <span>{l.material.unit}</span>
                      <Button
                        type="button"
                        className="secondary small"
                        aria-label={`Hapus ${l.material.mmid}`}
                        disabled={busy}
                        onClick={() => feedback.remove(i)}
                      >
                        Hapus
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
        <aside className="panel r22-cart-summary">
          <p className="r22-sticky-context">
            <strong>{draft.lines.length} item</strong>
            {normalizeHec(draft.hec) || 'HAC/SAC belum diisi'}
          </p>
          <h2>{title}</h2>
          <dl>
            <dt>Jumlah item</dt>
            <dd>{draft.lines.length} item</dd>
            <dt>HAC/SAC</dt>
            <dd className="code-text">{normalizeHec(draft.hec) || 'Belum diisi'}</dd>
            <dt>Peminta</dt>
            <dd>{self || 'Belum diisi'}</dd>
          </dl>
          <p className="fine">
            Seluruh item disimpan bersama. Stok diperiksa kembali oleh server saat disimpan.
          </p>
          <Button className="primary" busy={busy} disabled={!draft.lines.length || loaded !== storageKey}>
            Simpan order
          </Button>
          <small>Order langsung final setelah konfirmasi. Tidak ada reservasi stok.</small>
        </aside>
      </form>
      <QuantityDialog
        material={selected}
        onClose={() => setSelected(null)}
        consume={type === 'consume'}
        already={selected ? draft.lines.find((l) => l.material.id === selected.id)?.quantity || '0' : '0'}
        onAdd={add}
      />
      <Toast message={message} onDismiss={feedback.dismiss} action={feedback.action} />
    </>
  );
}
