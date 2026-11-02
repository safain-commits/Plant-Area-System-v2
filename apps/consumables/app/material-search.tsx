'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Input, Icon } from '@plant/ui';
import { formatQuantity, type MaterialSearchResult } from '@plant/contracts';
import { stockApi } from './r22-api';
export function MaterialSearch({
  catalog = false,
  onSelect,
}: {
  catalog?: boolean;
  onSelect: (m: MaterialSearchResult) => void;
}) {
  const [query, setQuery] = useState(''),
    [items, setItems] = useState<MaterialSearchResult[]>([]),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [active, setActive] = useState(0);
  const id = useId(),
    container = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    chooseRef = useRef(onSelect);
  chooseRef.current = onSelect;
  const choose = (m: MaterialSearchResult) => {
    setOpen(false);
    setQuery('');
    setItems([]);
    chooseRef.current(m);
  };
  useEffect(() => {
    const dismiss = (e: PointerEvent) => {
      if (!container.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  useEffect(() => {
    const c = new AbortController();
    if (!query.trim()) {
      setItems([]);
      setBusy(false);
      return;
    }
    const timer = setTimeout(() => {
      setBusy(true);
      setError('');
      stockApi(`/${catalog ? 'catalog-search' : 'search'}?` + new URLSearchParams({ q: query }), {
        signal: c.signal,
      })
        .then((d) => {
          if (c.signal.aborted) return;
          setItems(d.items);
          setActive(0);
          setOpen(true);
          const exact = d.items.find(
            (m: MaterialSearchResult) => m.mmid.toLowerCase() === query.trim().toLowerCase(),
          );
          if (exact) {
            setOpen(false);
            setQuery('');
            setItems([]);
            chooseRef.current(exact);
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
  }, [query, catalog]);
  return (
    <div className="r22-search" ref={container}>
      <label htmlFor={id}>
        Cari material<small>MMID, nama umum, alias, atau deskripsi SAP</small>
      </label>
      <div className="r22-search-field">
        <Icon name="search" />
        <input
          id={id}
          ref={input}
          type="search"
          value={query}
          placeholder="Contoh: baut M16 atau MMID"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={id + '-options'}
          aria-activedescendant={open && items.length ? `${id}-${active}` : undefined}
          onFocus={() => {
            if (items.length) setOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              e.preventDefault();
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setOpen(true);
              setActive((v) =>
                items.length ? (v + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length : 0,
              );
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              if (open && items[active]) choose(items[active]);
            }
          }}
        />
      </div>
      {busy && <small role="status">Mencari material…</small>}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {open && query.trim() && (
        <div
          id={id + '-options'}
          role="listbox"
          aria-label="Hasil pencarian material"
          className="r22-search-options"
        >
          {!busy && !items.length ? (
            <p className="empty">Material tidak ditemukan pada {catalog ? 'master' : 'stok R22'}.</p>
          ) : (
            items.map((m, i) => (
              <div
                role="option"
                id={`${id}-${i}`}
                tabIndex={-1}
                aria-selected={i === active}
                className={i === active ? 'highlight' : ''}
                key={m.id}
                onPointerMove={() => setActive(i)}
                onPointerDown={(e) => {
                  e.preventDefault();
                  choose(m);
                }}
              >
                <strong>
                  {m.mmid} · {m.commonName || m.description}
                </strong>
                <small>{m.description}</small>
                <span>
                  {m.inventoryId
                    ? m.initialized
                      ? `Stok: ${formatQuantity(m.quantity)} ${m.unit}`
                      : 'Belum dihitung'
                    : 'Baru di stok R22'}
                  {m.rack ? ` · Rak ${m.rack}` : ''}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
