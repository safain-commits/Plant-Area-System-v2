'use client';
import {
  Children,
  isValidElement,
  useId,
  useRef,
  useState,
  useEffect,
  type SelectHTMLAttributes,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon } from './icon';
import { Overlay } from './overlay';
import { wibInput } from '@plant/contracts';

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const ref = useRef<HTMLSelectElement>(null),
    button = useRef<HTMLButtonElement>(null),
    id = useId();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(''),
    [index, setIndex] = useState(0),
    [internal, setInternal] = useState(String(props.defaultValue ?? ''));
  const value = String(props.value ?? internal);
  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const p = child.props as { value: string | number; children: React.ReactNode; disabled?: boolean };
      return {
        value: String(p.value ?? Children.toArray(p.children).join('')),
        label: Children.toArray(p.children).join(''),
        disabled: !!p.disabled,
      };
    });
  const filtered = options.filter((o) => !o.disabled && o.label.toLowerCase().includes(query.toLowerCase()));
  const choose = (v: string) => {
    if (!ref.current) return;
    ref.current.value = v;
    ref.current.dispatchEvent(new Event('change', { bubbles: true }));
    setOpen(false);
    setQuery('');
  };
  useEffect(() => {
    const label = button.current?.closest('label');
    if (label) label.htmlFor = id + '-trigger';
  }, [id]);

  return (
    <span className="select-control">
      <select
        {...props}
        id={id + '-native'}
        aria-label={undefined}
        ref={ref}
        className="sr-only native-select"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          setInternal(e.target.value);
          props.onChange?.(e);
        }}
        onInvalid={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </select>
      <button
        id={id + '-trigger'}
        ref={button}
        type="button"
        role="combobox"
        className="select-trigger"
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        aria-expanded={open}
        aria-controls={id}
        disabled={props.disabled}
        value={value}
        aria-required={props.required}
        onClick={() => {
          setOpen(true);
          setQuery('');
          setIndex(
            Math.max(
              0,
              filtered.findIndex((o) => o.value === value),
            ),
          );
        }}
      >
        <span>{options.find((o) => o.value === value)?.label || 'Pilih'}</span>
        <Icon name="chevron" className={open ? 'chevron open' : 'chevron'} />
      </button>
      <Overlay
        open={open}
        onClose={() => setOpen(false)}
        title={props['aria-label'] || 'Pilih opsi'}
        kind="menu"
        anchor={button}
        hideTitle
      >
        <div className="select-search">
          <Icon name="search" />
          <input
            autoFocus
            aria-label="Cari opsi"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            placeholder="Cari…"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex(
                  (i) =>
                    (i + (e.key === 'ArrowDown' ? 1 : -1) + filtered.length) % Math.max(1, filtered.length),
                );
              }
              if (e.key === 'Enter' && filtered[index]) {
                e.preventDefault();
                choose(filtered[index].value);
              }
            }}
          />
        </div>
        <div
          id={id}
          role="listbox"
          className="menu-list scroll-fade"
          aria-label={props['aria-label'] || 'Opsi'}
        >
          {!!filtered.length && (
            <span
              className="menu-highlight"
              style={{ transform: `translateY(calc(${index} * var(--menu-row, 36px)))` }}
            />
          )}
          {filtered.map((o, i) => (
            <button
              type="button"
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className="menu-item"
              onPointerMove={() => setIndex(i)}
              onClick={() => choose(o.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const next = (i + (e.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length;
                  setIndex(next);
                  e.currentTarget.parentElement
                    ?.querySelectorAll<HTMLButtonElement>('[role=option]')
                    [next]?.focus();
                }
              }}
            >
              <span>
                {query && o.label.toLowerCase().includes(query.toLowerCase())
                  ? highlight(o.label, query)
                  : o.label}
              </span>
              {o.value === value && <Icon name="check" />}
            </button>
          ))}
          {!filtered.length && <p className="empty">Tidak ada hasil.</p>}
        </div>
      </Overlay>
    </span>
  );
}
function highlight(label: string, query: string) {
  const i = label.toLowerCase().indexOf(query.toLowerCase());
  return (
    <>
      {label.slice(0, i)}
      <mark>{label.slice(i, i + query.length)}</mark>
      {label.slice(i + query.length)}
    </>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null),
    [value, setValue] = useState(String(props.defaultValue ?? ''));
  const actual = String(props.value ?? value);
  if (['checkbox', 'radio', 'hidden', 'datetime-local', 'time'].includes(props.type || ''))
    return <input {...props} />;
  return (
    <span className="input-wrap">
      <input
        {...props}
        ref={ref}
        onChange={(e) => {
          setValue(e.target.value);
          props.onChange?.(e);
        }}
      />
      {actual && !props.disabled && !props.readOnly && props.type !== 'password' && (
        <button
          type="button"
          className="input-clear"
          aria-label="Kosongkan isian"
          tabIndex={-1}
          onClick={() => {
            const el = ref.current!;
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, '');
            el.dispatchEvent(new Event('input', { bubbles: true }));
            setValue('');
            el.focus();
          }}
        >
          <Icon name="x" />
        </button>
      )}
    </span>
  );
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null),
    [count, setCount] = useState(String(props.value ?? props.defaultValue ?? '').length);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(200, Math.max(80, el.scrollHeight))}px`;
    }
    setCount(String(props.value ?? ref.current?.value ?? '').length);
  }, [props.value]);
  return (
    <span className="textarea-wrap">
      <textarea
        {...props}
        ref={ref}
        rows={3}
        onChange={(e) => {
          setCount(e.target.value.length);
          e.target.style.height = 'auto';
          e.target.style.height = `${Math.min(200, Math.max(80, e.target.scrollHeight))}px`;
          props.onChange?.(e);
        }}
      />
      {props.maxLength && (
        <small
          className={`field-counter${count >= props.maxLength ? ' limit' : count >= props.maxLength * 0.9 ? ' warning' : ''}`}
        >
          {count} / {props.maxLength}
        </small>
      )}
    </span>
  );
}

function TimeColumn({
  label,
  value,
  count,
  onChange,
}: {
  label: string;
  value: number;
  count: number;
  onChange: (value: number) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const selected = list.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (selected && list.current) list.current.scrollTop = selected.offsetTop - list.current.offsetTop - 44;
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <div className="time-column" role="listbox" aria-label={label} ref={list}>
      {Array.from({ length: count }, (_, i) => (
        <button
          type="button"
          role="option"
          key={i}
          aria-selected={value === i}
          tabIndex={value === i ? 0 : -1}
          onClick={() => onChange(i)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const next = (i + (e.key === 'ArrowUp' ? -1 : 1) + count) % count;
              onChange(next);
              list.current
                ?.querySelectorAll<HTMLButtonElement>('button')
                [next]?.focus({ preventScroll: true });
            }
          }}
        >
          {String(i).padStart(2, '0')}
        </button>
      ))}
    </div>
  );
}

export function DateTimeField(props: InputHTMLAttributes<HTMLInputElement>) {
  const [open, setOpen] = useState(false),
    button = useRef<HTMLButtonElement>(null),
    ref = useRef<HTMLInputElement>(null);
  const value = String(props.value || wibInput()),
    [month, setMonth] = useState(value.slice(0, 7));
  const change = (v: string) => {
    if (ref.current) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(ref.current, v);
      ref.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };
  const first = new Date(`${month}-01T00:00:00Z`),
    offset = (first.getUTCDay() + 6) % 7,
    total = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const move = (n: number) =>
    setMonth(
      new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + n, 1)).toISOString().slice(0, 7),
    );
  return (
    <span className="date-field">
      <input {...props} ref={ref} type="datetime-local" />
      <span className="unit-chip">WIB</span>
      <button
        ref={button}
        type="button"
        className="icon-button ghost"
        aria-label="Buka kalender pemasangan"
        onClick={() => {
          setMonth(value.slice(0, 7));
          setOpen(true);
        }}
      >
        <Icon name="calendar" />
      </button>
      <Overlay
        open={open}
        onClose={() => setOpen(false)}
        title="Tanggal & jam pemasangan (WIB)"
        kind="menu"
        anchor={button}
      >
        <div className="calendar-head">
          <button
            type="button"
            className="icon-button ghost"
            aria-label="Bulan sebelumnya"
            onClick={() => move(-1)}
          >
            <Icon name="chevron" style={{ transform: 'rotate(180deg)' }} />
          </button>
          <strong>
            {first.toLocaleDateString('id-ID', { timeZone: 'UTC', month: 'long', year: 'numeric' })}
          </strong>
          <button
            type="button"
            className="icon-button ghost"
            aria-label="Bulan berikutnya"
            onClick={() => move(1)}
          >
            <Icon name="chevron" />
          </button>
        </div>
        <div className="calendar-grid">
          {['S', 'S', 'R', 'K', 'J', 'S', 'M'].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span key={`blank${i}`} />
          ))}
          {Array.from({ length: total }, (_, i) => {
            const day = `${month}-${String(i + 1).padStart(2, '0')}`;
            return (
              <button
                type="button"
                key={day}
                aria-pressed={value.startsWith(day)}
                className={day === wibInput().slice(0, 10) ? 'today' : ''}
                onClick={() => change(`${day}T${value.slice(11) || '00:00'}`)}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <label className="calendar-time">
          Jam (WIB)
          <input
            type="time"
            value={value.slice(11)}
            onChange={(e) => change(`${value.slice(0, 10)}T${e.target.value}`)}
          />
        </label>
        {open && (
          <div className="time-columns">
            <TimeColumn
              label="Pilih jam"
              count={24}
              value={Number(value.slice(11, 13))}
              onChange={(hour) =>
                change(`${value.slice(0, 11)}${String(hour).padStart(2, '0')}:${value.slice(14, 16) || '00'}`)
              }
            />
            <span aria-hidden="true">:</span>
            <TimeColumn
              label="Pilih menit"
              count={60}
              value={Number(value.slice(14, 16))}
              onChange={(minute) => change(`${value.slice(0, 14)}${String(minute).padStart(2, '0')}`)}
            />
          </div>
        )}
        <div className="inline">
          <button
            type="button"
            className="secondary"
            onClick={() => {
              change(wibInput());
              setMonth(wibInput().slice(0, 7));
            }}
          >
            Sekarang
          </button>
          <button type="button" onClick={() => setOpen(false)}>
            Selesai
          </button>
        </div>
      </Overlay>
    </span>
  );
}
