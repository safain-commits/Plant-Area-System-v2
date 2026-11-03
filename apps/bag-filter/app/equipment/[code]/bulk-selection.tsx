'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { displayCompartment, type Equipment, type Position } from '@plant/contracts';
import { Overlay, Select } from '@plant/ui';
import {
  areaPositions,
  compartmentOptions,
  compartmentPositions,
  selectionPreview,
  selectionLimit,
  compartmentChoices,
  toggleCompartment,
  type Compartment,
} from './selection';

type Props = {
  open: boolean;
  equipment: Equipment;
  side: Position['side'];
  compartment: number;
  selected: Position[];
  busy: boolean;
  onClose: () => void;
  onAdd: (positions: Position[]) => void;
};

export function BulkSelection(props: Props) {
  return (
    <Overlay
      open={props.open}
      onClose={props.onClose}
      title="Pilih banyak bag"
      kind="sheet"
      className="overlay-bulk"
      showHandle={false}
    >
      {props.open && <BulkSelectionForm {...props} />}
    </Overlay>
  );
}

function BulkSelectionForm({
  equipment: eq,
  side: initialSide,
  compartment: initialCompartment,
  selected,
  busy,
  onClose,
  onAdd,
}: Props) {
  const [mode, setMode] = useState<'compartments' | 'area'>('compartments');
  const [compartments, setCompartments] = useState<Compartment[]>([]);
  const [side, setSide] = useState(initialSide),
    [compartment, setCompartment] = useState(initialCompartment);
  const [columnFrom, setColumnFrom] = useState(1),
    [columnTo, setColumnTo] = useState(eq.columns.length);
  const [rowFrom, setRowFrom] = useState(1),
    [rowTo, setRowTo] = useState(eq.rows);
  const items = useMemo(
    () =>
      mode === 'compartments'
        ? compartmentPositions(eq, compartments)
        : areaPositions(eq, { side, compartment, columnFrom, columnTo, rowFrom, rowTo }),
    [mode, eq, compartments, side, compartment, columnFrom, columnTo, rowFrom, rowTo],
  );
  const preview = useMemo(() => selectionPreview(selected, items), [selected, items]);
  const choices = useMemo(() => compartmentChoices(eq, selected, compartments), [eq, selected, compartments]);
  const options = useMemo(() => compartmentOptions(eq), [eq]);
  const remaining = Math.max(0, selectionLimit - preview.total);
  const quotaId = useId();
  const scroll = useRef<HTMLDivElement>(null),
    content = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const updateEdges = useCallback(() => {
    const el = scroll.current;
    if (!el) return;
    const start = el.scrollTop > 1,
      end = el.scrollHeight - el.clientHeight - el.scrollTop > 1;
    setEdges((old) => (old.start === start && old.end === end ? old : { start, end }));
  }, []);
  useEffect(() => {
    if (!scroll.current || !content.current) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(scroll.current);
    observer.observe(content.current);
    updateEdges();
    return () => observer.disconnect();
  }, [updateEdges]);
  function changeMode(value: 'compartments' | 'area') {
    setMode(value);
    if (scroll.current) scroll.current.scrollTop = 0;
  }
  const columns = Array.from(eq.columns),
    rows = Array.from({ length: eq.rows }, (_, i) => i + 1);
  return (
    <div className="bulk-selection">
      <div className="bulk-header">
        <p className="bulk-capacity">
          <strong>1 kompartemen = {eq.bagsPerCompartment} bag</strong>
          <span>Maks. {selectionLimit} bag</span>
        </p>
        <div className="bulk-modes" role="group" aria-label="Cara memilih bag">
          <button
            type="button"
            className="secondary"
            aria-pressed={mode === 'compartments'}
            disabled={busy}
            onClick={() => changeMode('compartments')}
          >
            Kompartemen penuh
          </button>
          <button
            type="button"
            className="secondary"
            aria-pressed={mode === 'area'}
            disabled={busy}
            onClick={() => changeMode('area')}
          >
            Area bag
          </button>
        </div>
      </div>
      <div className="bulk-scroll-frame" data-scroll-start={edges.start} data-scroll-end={edges.end}>
        <div
          ref={scroll}
          className="bulk-scroll"
          role="region"
          aria-label={mode === 'compartments' ? 'Daftar kompartemen' : 'Pengaturan area bag'}
          tabIndex={0}
          onScroll={updateEdges}
        >
          <div ref={content} className="bulk-scroll-content">
            {mode === 'compartments' ? (
              <div className="bulk-compartment-groups">
                {eq.sides.map(({ name }) => (
                  <fieldset key={name} disabled={busy}>
                    <legend>Sisi {name}</legend>
                    <div className="bulk-compartments">
                      {choices
                        .filter((choice) => choice.side === name)
                        .map((choice) => {
                          const { label, checked, blocked, additional } = choice;
                          return (
                            <label
                              className="bulk-compartment-choice"
                              key={label}
                              data-blocked={blocked}
                              title={
                                blocked
                                  ? `Perlu ${additional} bag tambahan; sisa kuota ${remaining} bag.`
                                  : `${eq.bagsPerCompartment} bag; ${additional} bag tambahan.`
                              }
                            >
                              <input
                                type="checkbox"
                                aria-label={`Comp. ${label}`}
                                aria-describedby={blocked ? quotaId : undefined}
                                checked={checked}
                                disabled={busy || blocked}
                                onChange={() =>
                                  setCompartments((previous) =>
                                    toggleCompartment(eq, selected, previous, choice),
                                  )
                                }
                              />
                              <span>{label}</span>
                            </label>
                          );
                        })}
                    </div>
                  </fieldset>
                ))}
              </div>
            ) : (
              <>
                <div className="form-grid bulk-area">
                  <label className="full">
                    Kompartemen
                    <Select
                      searchable={false}
                      aria-label="Kompartemen area"
                      value={`${side}:${compartment}`}
                      disabled={busy}
                      onChange={(event) => {
                        const next = options.find((c) => c.value === event.target.value);
                        if (!next) return;
                        setSide(next.side);
                        setCompartment(next.compartment);
                      }}
                    >
                      {options.map((c) => (
                        <option key={c.value} value={c.value}>
                          Comp. {c.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    Kolom dari
                    <Select
                      searchable={false}
                      aria-label="Kolom dari"
                      value={columnFrom}
                      disabled={busy}
                      onChange={(event) => setColumnFrom(Number(event.target.value))}
                    >
                      {columns.map((letter, i) => (
                        <option key={letter} value={i + 1}>
                          {letter}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    Kolom sampai
                    <Select
                      searchable={false}
                      aria-label="Kolom sampai"
                      value={columnTo}
                      disabled={busy}
                      onChange={(event) => setColumnTo(Number(event.target.value))}
                    >
                      {columns.map((letter, i) => (
                        <option key={letter} value={i + 1}>
                          {letter}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    Baris dari
                    <Select
                      searchable={false}
                      aria-label="Baris dari"
                      value={rowFrom}
                      disabled={busy}
                      onChange={(event) => setRowFrom(Number(event.target.value))}
                    >
                      {rows.map((row) => (
                        <option key={row}>{row}</option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    Baris sampai
                    <Select
                      searchable={false}
                      aria-label="Baris sampai"
                      value={rowTo}
                      disabled={busy}
                      onChange={(event) => setRowTo(Number(event.target.value))}
                    >
                      {rows.map((row) => (
                        <option key={row}>{row}</option>
                      ))}
                    </Select>
                  </label>
                </div>
                <p className="fine">
                  Comp. {displayCompartment({ side, compartment }, eq)} · {eq.columns[columnFrom - 1]}–
                  {eq.columns[columnTo - 1]} · baris {rowFrom}–{rowTo} · {items.length} bag. Titik awal dan
                  akhir boleh terbalik.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="bulk-footer">
        <section
          className="bulk-preview"
          aria-label="Pratinjau pilihan"
          aria-live="polite"
          aria-atomic="true"
        >
          <div>
            <span>Sudah ada</span>
            <strong data-preview="current">{selected.length}</strong>
          </div>
          <div>
            <span>Tambahan</span>
            <strong data-preview="added">{preview.added}</strong>
          </div>
          <div>
            <span>
              Total <small>/ {selectionLimit}</small>
            </span>
            <strong data-preview="total" data-over-limit={preview.excess > 0}>
              {preview.total}
            </strong>
          </div>
        </section>
        <p
          id={quotaId}
          className="bulk-quota"
          role={preview.excess > 0 ? 'alert' : 'status'}
          data-over-limit={preview.excess > 0}
        >
          {preview.excess > 0 ? (
            `Lebih ${preview.excess} bag. Perkecil area.`
          ) : preview.overlap > 0 ? (
            <>
              <span data-preview="overlap">{preview.overlap}</span> bag sudah termasuk. Sisa {remaining} bag.
            </>
          ) : remaining === 0 ? (
            'Kuota 500 bag terpenuhi.'
          ) : mode === 'compartments' && remaining < eq.bagsPerCompartment ? (
            `${remaining} bag tersisa. Gunakan Area bag.`
          ) : (
            `${remaining} bag tersisa dari batas ${selectionLimit}.`
          )}
        </p>
        <div className="bulk-footer-actions">
          <button type="button" className="secondary" disabled={busy} onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            disabled={busy || preview.added === 0 || preview.excess > 0}
            onClick={() => {
              onAdd(items);
              onClose();
            }}
          >
            Tambahkan pilihan
          </button>
        </div>
      </div>
    </div>
  );
}
