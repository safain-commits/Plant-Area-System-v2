'use client';
import { useEffect, useRef, useState } from 'react';
import {
  TableSkeleton,
  EmptyState,
  Button,
  Input,
  Select,
  Textarea,
  useConfirmation,
  Toast,
  cartKey,
  emptyCart,
  readCart,
  writeCart,
  removeCart,
  type CartDraft,
} from '@plant/ui';
import {
  decimalUnits,
  decimalString,
  formatQuantity,
  localDecimal,
  sapToR22,
  validateStockQuantity,
  type Identity,
  type MaterialSearchResult,
  type StockDocument,
  type DocumentResult,
  type StockLineConflict,
} from '@plant/contracts';
import { useCartFeedback } from './use-cart-feedback';
import { MaterialSearch } from './material-search';
import { stockApi, StockApiError } from './r22-api';
export function Picklist({ identity }: { identity: Identity }) {
  const [draft, setDraft] = useState<CartDraft>(emptyCart),
    [loaded, setLoaded] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [previous, setPrevious] = useState<StockDocument[]>([]),
    [conflicts, setConflicts] = useState<StockLineConflict[]>([]),
    [success, setSuccess] = useState<DocumentResult | null>(null),
    [focus, setFocus] = useState('');
  const feedback = useCartFeedback(draft, setDraft, setMessage);
  const confirm = useConfirmation(),
    prefill = useRef(''),
    key = cartKey(identity.id, 'picklist');
  const update = (patch: Partial<CartDraft>) => setDraft((v) => ({ ...v, ...patch }));
  useEffect(() => {
    if (!key) return;
    setDraft(readCart(key));
    setLoaded(key);
    setSuccess(null);
    setConflicts([]);
  }, [key]);
  useEffect(() => {
    if (key && loaded === key && !success) writeCart(key, draft);
  }, [key, loaded, draft, success]);
  const add = (material: MaterialSearchResult) => {
    if (draft.lines.some((l) => l.material.id === material.id)) {
      setFocus(material.id);
      return;
    }
    if (draft.lines.length >= 100) {
      setError('Maksimal 100 material dalam satu picklist.');
      return;
    }
    const convertible =
      material.conversionReviewed &&
      (material.packSize || material.sapUnit.toUpperCase() === material.unit.toUpperCase());
    setDraft((v) => ({
      ...v,
      lines: [...v.lines, { material, quantity: '', mode: convertible ? 'sap' : 'base' }],
    }));
    setFocus(material.id);
    feedback.added(material.id);
    setMessage(`${material.commonName || material.description} ditambahkan`);
  };
  useEffect(() => {
    if (!focus) return;
    document.querySelector<HTMLInputElement>(`[data-r22-quantity="${focus}"]`)?.focus();
    setFocus('');
  }, [draft.lines.length, focus]);
  useEffect(() => {
    if (loaded !== key || prefill.current === key) return;
    const id = new URLSearchParams(window.location.search).get('material');
    if (!id) return;
    prefill.current = key;
    stockApi('/materials/' + encodeURIComponent(id))
      .then((d) => {
        const stock = d.stock;
        add(
          stock || {
            ...d.material,
            inventoryId: null,
            rack: '',
            quantity: '0.000000',
            initialized: false,
            inventoryActive: false,
          },
        );
      })
      .catch((e) => setError(e.message));
  }, [loaded, key]);
  useEffect(() => {
    const c = new AbortController();
    if (!draft.reservationNo.trim()) {
      setPrevious([]);
      return;
    }
    const timer = setTimeout(
      () =>
        stockApi(
          '/documents?' + new URLSearchParams({ reservationNo: draft.reservationNo, type: 'picklist' }),
          { signal: c.signal },
        )
          .then((d) => setPrevious(d.items))
          .catch(() => setPrevious([])),
      200,
    );
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [draft.reservationNo]);
  const preview = (line: CartDraft['lines'][number]) => {
    try {
      return line.mode === 'base'
        ? validateStockQuantity(localDecimal(line.quantity), line.material.decimalAllowed)
        : sapToR22(localDecimal(line.quantity), line.material);
    } catch {
      return null;
    }
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || loaded !== key) return;
    try {
      if (!draft.lines.length || draft.lines.length > 100) throw Error('Pilih 1–100 material unik.');
      if (!draft.reservationNo.trim() || !draft.wo.trim())
        throw Error('Nomor reservasi dan Nomor WO wajib diisi.');
      if (!draft.costCenter.trim()) throw Error('Pusat biaya wajib diisi.');
      const body = {
        reservationNo: draft.reservationNo.trim(),
        wo: draft.wo.trim(),
        woDescription: draft.note.trim(),
        equipmentNo: draft.equipmentNo.trim(),
        functionalLocation: draft.functionalLocation.trim(),
        costCenter: draft.costCenter.trim(),
        ...(draft.requiredDate ? { requiredDate: draft.requiredDate } : {}),
        lines: draft.lines.map((l, i) => {
          if (!preview(l)) throw Error(`Baris ${i + 1}: periksa jumlah dan konversi.`);
          if (l.material.inventoryId && (!l.material.initialized || !l.material.inventoryActive))
            throw Error(`Baris ${i + 1}: stok belum dihitung atau nonaktif. Hubungi admin.`);
          return {
            materialId: l.material.id,
            ...(l.mode === 'base'
              ? { quantity: validateStockQuantity(localDecimal(l.quantity), l.material.decimalAllowed) }
              : {
                  sapQuantity: decimalString(decimalUnits(localDecimal(l.quantity))),
                  materialVersion: l.material.version,
                }),
          };
        }),
      };
      if (
        !(await confirm(
          `Terima picklist ${body.reservationNo} · WO ${body.wo} · ${body.lines.length} item ke stok R22?`,
          {
            title: 'Konfirmasi Penerimaan Picklist',
            confirmLabel: 'Terima ke Stok R22',
            variant: 'primary',
          },
        ))
      )
        return;
      const fingerprint = JSON.stringify(body),
        id = draft.pending?.fingerprint === fingerprint ? draft.pending.key : crypto.randomUUID(),
        next = { ...draft, pending: { fingerprint, key: id } };
      setDraft(next);
      writeCart(key, next);
      setBusy(true);
      setError('');
      setConflicts([]);
      const result = await stockApi('/picklist-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': id },
        body: JSON.stringify(body),
      });
      feedback.clear();
      setSuccess(result);
      removeCart(key);
      setDraft(emptyCart());
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof StockApiError) setConflicts(e.lines);
    } finally {
      setBusy(false);
    }
  }
  if (success)
    return (
      <section className="panel r22-success" role="status">
        <span className="badge">Picklist diterima</span>
        <h2>Penerimaan Picklist tersimpan</h2>
        <p className="display-lg">{success.document.number}</p>
        <p>
          {success.lines.length} item · Reservasi {success.document.reservationNo}
        </p>
        {!!success.previousDocuments?.length && (
          <p className="notice">Reservasi ini juga mempunyai penerimaan sebelumnya.</p>
        )}
        <div className="form-actions">
          <a className="button primary" href={`/consumables/documents/${success.document.id}`}>
            Lihat / Cetak bukti
          </a>
          <Button
            className="secondary"
            onClick={() => {
              setSuccess(null);
              setDraft(emptyCart());
            }}
          >
            Terima picklist baru
          </Button>
        </div>
      </section>
    );
  if (loaded !== key)
    return (
      <section className="panel" role="status">
        <TableSkeleton rows={3} />
      </section>
    );
  return (
    <>
      <form
        onInvalid={(e) => e.currentTarget.classList.add('was-submitted')}
        onSubmit={submit}
        className="r22-picklist"
      >
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Informasi picklist</h2>
            </div>
            <span className="badge neutral">Stok masuk</span>
          </div>
          <fieldset className="r22-fieldset" disabled={busy || loaded !== key}>
            <div className="form-grid">
              <label>
                <span>Nomor reservasi </span>
                <Input
                  required
                  maxLength={30}
                  value={draft.reservationNo}
                  onChange={(e) => update({ reservationNo: e.target.value })}
                />
              </label>
              <label>
                <span>Nomor WO </span>
                <Input
                  required
                  maxLength={100}
                  value={draft.wo}
                  onChange={(e) => update({ wo: e.target.value })}
                />
              </label>
              <label>
                Nomor equipment (opsional)
                <Input
                  maxLength={100}
                  value={draft.equipmentNo}
                  onChange={(e) => update({ equipmentNo: e.target.value })}
                />
              </label>
              <label>
                Lokasi fungsional (opsional)
                <Input
                  maxLength={100}
                  value={draft.functionalLocation}
                  onChange={(e) => update({ functionalLocation: e.target.value })}
                  placeholder="TQ.452-BU1 - deskripsi equipment"
                />
              </label>
              <label>
                <span>Pusat biaya </span>
                <Input
                  required
                  maxLength={40}
                  value={draft.costCenter}
                  onChange={(e) => update({ costCenter: e.target.value })}
                />
              </label>
              <label>
                Tanggal kebutuhan (opsional)
                <Input
                  type="date"
                  value={draft.requiredDate}
                  onChange={(e) => update({ requiredDate: e.target.value })}
                />
              </label>
              <label className="r22-span-all">
                Keterangan pekerjaan (opsional)
                <Textarea
                  maxLength={500}
                  value={draft.note}
                  onChange={(e) => update({ note: e.target.value })}
                />
              </label>
            </div>
          </fieldset>
          {!!previous.length && (
            <div className="notice r22-reservation-warning" role="status">
              <strong>Reservasi ini pernah diterima.</strong>
              <span>Pengiriman parsial tetap dapat dicatat.</span>
              {previous.map((d) => (
                <a key={d.id} href={`/consumables/history?document=${d.id}`}>
                  {d.number}
                </a>
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <MaterialSearch catalog onSelect={add} />
          <div className="section-title r22-cart-title">
            <h2>
              Material picklist <span className="badge neutral">{draft.lines.length} item</span>
            </h2>
            <small>Jumlah SAP dikonversi ke satuan terkecil R22</small>
          </div>
          <div className="r22-picklist-table" role="table" aria-label="Material penerimaan picklist">
            <div className="r22-cart-head" role="row">
              <span role="columnheader">No.</span>
              <span role="columnheader">Material</span>
              <span role="columnheader">Jumlah diminta</span>
              <span role="columnheader">Satuan input</span>
              <span role="columnheader">Jumlah R22</span>
              <span role="columnheader">Aksi</span>
            </div>
            {!draft.lines.length && (
              <EmptyState
                title="Picklist masih kosong"
                description="Cari master material untuk menambahkan baris penerimaan."
              />
            )}
            {draft.lines.map((l, i) => {
              const result = preview(l),
                m = l.material,
                problem = conflicts.find((c) => c.materialId === m.id);
              return (
                <div
                  data-cart-material={m.id}
                  className={`r22-cart-row ${problem ? 'has-error' : ''} ${feedback.highlight === m.id ? 'is-new' : ''}`}
                  role="row"
                  key={m.id}
                >
                  <span className="r22-line-no" role="cell">
                    {i + 1}
                  </span>
                  <div className="r22-picklist-material" role="cell">
                    <strong>{m.commonName || m.description}</strong>
                    <small className="r22-picklist-description">
                      <span className="code-text">{m.mmid}</span> · {m.description}
                    </small>
                    <div className="r22-picklist-meta">
                      <small>
                        {m.packSize
                          ? `1 ${m.sapUnit} = ${formatQuantity(m.packSize)} ${m.unit}`
                          : m.sapUnit.toUpperCase() === m.unit.toUpperCase()
                            ? `1 ${m.sapUnit} = 1 ${m.unit}`
                            : 'Konversi belum diatur'}
                      </small>
                      {!m.inventoryId ? (
                        <span className="badge neutral">Akan didaftarkan ke stok R22</span>
                      ) : !m.initialized ? (
                        <span className="error-text">Belum dihitung, hubungi admin</span>
                      ) : (
                        <small>
                          Stok R22: {formatQuantity(m.quantity)} {m.unit}
                        </small>
                      )}
                    </div>
                    {problem && (
                      <p className="error-text" role="alert">
                        {problem.error}
                      </p>
                    )}
                  </div>
                  <div className="r22-picklist-quantity" role="cell">
                    <label className="r22-line-quantity">
                      <span className="r22-picklist-field-label" aria-hidden="true">
                        Jumlah diminta
                      </span>
                      <span className="sr-only">Jumlah diminta {m.mmid}</span>
                      <span className="r22-picklist-quantity-control">
                        <Input
                          required
                          data-r22-quantity={m.id}
                          value={l.quantity}
                          disabled={busy}
                          inputMode={l.mode === 'base' && !m.decimalAllowed ? 'numeric' : 'decimal'}
                          onChange={(e) =>
                            update({
                              lines: draft.lines.map((v, j) =>
                                i === j ? { ...v, quantity: e.target.value } : v,
                              ),
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              document.querySelector<HTMLInputElement>('.r22-search input')?.focus();
                            }
                          }}
                        />
                        <span className="r22-picklist-quantity-unit">
                          {l.mode === 'base' ? m.unit : m.sapUnit}
                        </span>
                      </span>
                    </label>
                  </div>
                  <div className="r22-picklist-unit" role="cell">
                    <label>
                      <span className="r22-picklist-field-label" aria-hidden="true">
                        Satuan input
                      </span>
                      <span className="sr-only">Mode input {m.mmid}</span>
                      <Select
                        searchable={false}
                        value={l.mode || 'sap'}
                        disabled={busy}
                        onChange={(e) =>
                          update({
                            lines: draft.lines.map((v, j) =>
                              i === j ? { ...v, mode: e.target.value as 'base' | 'sap', quantity: '' } : v,
                            ),
                          })
                        }
                      >
                        <option value="sap">SAP · {m.sapUnit}</option>
                        <option value="base">R22 · {m.unit}</option>
                      </Select>
                    </label>
                  </div>
                  <div className="r22-conversion-output" role="cell">
                    <span className="r22-picklist-field-label">Jumlah R22</span>
                    <span className="r22-picklist-result">
                      <strong>{result ? formatQuantity(result) : '—'}</strong>
                      {result && <span>{m.unit}</span>}
                    </span>
                    {l.quantity && !result && <small className="error-text">Periksa jumlah / konversi</small>}
                  </div>
                  <div className="r22-picklist-action" role="cell">
                    <Button
                      type="button"
                      className="secondary small"
                      aria-label={`Hapus ${m.mmid}`}
                      disabled={busy}
                      onClick={() => feedback.remove(i)}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel r22-picklist-submit">
          <div>
            <strong>{draft.lines.length} item siap ditinjau</strong>
            <p className="fine">
              Seluruh baris diterima dalam satu transaksi. Kuantitas berbeda satuan tidak dijumlahkan.
            </p>
          </div>
          <Button className="primary" busy={busy} disabled={!draft.lines.length || loaded !== key}>
            Terima Picklist
          </Button>
        </section>
      </form>
      <Toast message={message} onDismiss={feedback.dismiss} action={feedback.action} />
    </>
  );
}
