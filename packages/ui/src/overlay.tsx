'use client';
import { useEffect, useRef, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icon';

export function Overlay({
  open,
  onClose,
  title,
  children,
  kind = 'dialog',
  anchor,
  hideTitle = false,
  placement = 'bottom',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  kind?: 'dialog' | 'menu' | 'sheet' | 'command' | 'drawer';
  anchor?: React.RefObject<HTMLElement | null>;
  hideTitle?: boolean;
  placement?: 'bottom' | 'right';
}) {
  const ref = useRef<HTMLDialogElement>(null),
    last = useRef<HTMLElement | null>(null),
    id = useId();
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const backdropPress = useRef(false);
  useEffect(() => setContainer(document.body), []);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      last.current = anchor?.current ?? (document.activeElement as HTMLElement);
      if (kind === 'menu' && anchor?.current && innerWidth >= 640) {
        const rect = anchor.current.getBoundingClientRect();
        dialog.style.setProperty(
          '--anchor-top',
          `${Math.max(8, Math.min(innerHeight - 340, placement === 'right' ? rect.top : rect.bottom + 8))}px`,
        );
        dialog.style.setProperty(
          '--anchor-left',
          `${Math.max(8, Math.min(innerWidth - 340, placement === 'right' ? rect.right + 8 : rect.left))}px`,
        );
      }
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
      (last.current?.isConnected
        ? last.current
        : document.querySelector<HTMLElement>('[data-sheet-trigger]')
      )?.focus({ preventScroll: true });
    }
  }, [open, kind, anchor, placement, container]);
  // Keep modal content outside enclosing labels/forms. Portals still bubble through
  // the React tree, so pointer/click events also stop at the dialog boundary.
  if (!container) return null;
  return createPortal(
    <dialog
      ref={ref}
      className={`overlay overlay-${kind}`}
      aria-labelledby={id}
      onPointerDown={(e) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        backdropPress.current =
          e.button === 0 &&
          e.target === e.currentTarget &&
          (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
      }}
      onPointerCancel={() => {
        backdropPress.current = false;
      }}
      onKeyDown={(e) => {
        if (
          kind !== 'menu' ||
          e.defaultPrevented ||
          !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
          (e.target as HTMLElement).matches('input,textarea')
        )
          return;
        const items = Array.from(
          ref.current!.querySelectorAll<HTMLElement>('.menu-item:not(:disabled), .activity-row'),
        );
        if (!items.length) return;
        e.preventDefault();
        e.stopPropagation();
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next =
          e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? items.length - 1
              : (i + (e.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
        items[next]?.focus();
      }}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (backdropPress.current && e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
            e.preventDefault();
            onClose();
          }
        }
        backdropPress.current = false;
      }}
    >
      <div
        className="overlay-content"
        style={drag || dragX ? { transform: `translate(${dragX}px, ${drag}px)` } : undefined}
        onPointerDown={(e) => {
          if (kind === 'drawer' && e.pointerType === 'touch') swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (swipe.current && Math.abs(e.clientY - swipe.current.y) < 60)
            setDragX(Math.min(0, e.clientX - swipe.current.x));
        }}
        onPointerUp={() => {
          if (dragX < -80) onClose();
          swipe.current = null;
          setDragX(0);
        }}
        onPointerCancel={() => {
          swipe.current = null;
          setDragX(0);
        }}
      >
        {(kind === 'sheet' || kind === 'menu') && (
          <div
            className="sheet-grab"
            onPointerDown={(e) => {
              if (innerWidth >= 640) return;
              start.current = e.clientY;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (start.current !== null) setDrag(Math.max(0, e.clientY - start.current));
            }}
            onPointerUp={() => {
              if (drag > 100) onClose();
              setDrag(0);
              start.current = null;
            }}
            aria-hidden="true"
          >
            <span />
          </div>
        )}
        <div className={hideTitle ? 'sr-only' : 'overlay-heading'}>
          <h2 id={id}>{title}</h2>
          {!hideTitle && (
            <button
              type="button"
              className="icon-button ghost"
              aria-label={`Tutup ${title}`}
              onClick={onClose}
            >
              <Icon name="x" />
            </button>
          )}
        </div>
        {children}
      </div>
    </dialog>,
    container,
  );
}

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const dismiss = useRef(onDismiss),
    remaining = useRef(5000);
  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    remaining.current = 5000;
    setPaused(false);
  }, [message]);
  useEffect(() => {
    if (!message || paused) return;
    const started = Date.now();
    const id = setTimeout(() => dismiss.current(), remaining.current);
    return () => {
      clearTimeout(id);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [message, paused]);
  if (!message) return null;
  return (
    <div
      className="toast"
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="toast-icon">
        <Icon name="check" />
      </span>
      <p>{message}</p>
      <button
        type="button"
        className="icon-button ghost"
        aria-label="Tutup pemberitahuan"
        onClick={onDismiss}
      >
        <Icon name="x" />
      </button>
    </div>
  );
}
