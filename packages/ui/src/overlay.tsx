'use client';
import { Fragment, useEffect, useRef, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icon';
import { record, velocity, rubberband, shouldDismiss, spring, type Sample } from './gesture';

export function Overlay({
  open,
  onClose,
  title,
  children,
  kind = 'dialog',
  anchor,
  hideTitle = false,
  placement = 'bottom',
  className = '',
  showHandle = true,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  kind?: 'dialog' | 'menu' | 'sheet' | 'command' | 'drawer';
  anchor?: React.RefObject<HTMLElement | null>;
  hideTitle?: boolean;
  placement?: 'bottom' | 'bottom-end' | 'right';
  className?: string;
  showHandle?: boolean;
  onNavigate?: (direction: -1 | 1) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    last = useRef<HTMLElement | null>(null),
    menuInput = useRef<'pointer' | 'keyboard'>('keyboard'),
    id = useId();
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [present, setPresent] = useState(open);
  const previousOpen = useRef(false),
    generation = useRef(0);
  if (open && !previousOpen.current) generation.current++;
  previousOpen.current = open;
  const backdropPress = useRef(false),
    closingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelSpring = useRef<(() => void) | null>(null),
    dragFrame = useRef(0),
    position = useRef(0);
  const retained = useRef(children),
    openRef = useRef(open),
    closeRef = useRef(onClose);
  const gesture = useRef<{
    x: number;
    y: number;
    origin: number;
    horizontal: boolean;
    sign: number;
    dimension: number;
    active: boolean;
    samples: Sample[];
  } | null>(null);
  const suppressClick = useRef(false);
  if (open) retained.current = children;
  openRef.current = open;
  closeRef.current = onClose;
  useEffect(() => setContainer(document.body), []);
  const finish = () => {
    const dialog = ref.current;
    if (!dialog || openRef.current || !dialog.open) return;
    if (closingTimer.current) {
      clearTimeout(closingTimer.current);
      closingTimer.current = null;
    }
    dialog.close();
    retained.current = null;
    setPresent(false);
    dialog.removeAttribute('data-closing');
    dialog.style.removeProperty('transform');
    position.current = 0;
    (last.current?.isConnected
      ? last.current
      : document.querySelector<HTMLElement>('[data-sheet-trigger]')
    )?.focus({ preventScroll: true });
  };
  useEffect(() => {
    const trigger = anchor?.current;
    if (kind !== 'menu' || !trigger) return;
    const pointer = () => {
        menuInput.current = 'pointer';
      },
      keyboard = () => {
        menuInput.current = 'keyboard';
      },
      click = (event: MouseEvent) => {
        // Virtual/assistive clicks need not produce a keydown or pointerdown.
        if (event.detail === 0) menuInput.current = 'keyboard';
      };
    trigger.addEventListener('pointerdown', pointer, true);
    trigger.addEventListener('keydown', keyboard, true);
    trigger.addEventListener('click', click, true);
    return () => {
      trigger.removeEventListener('pointerdown', pointer, true);
      trigger.removeEventListener('keydown', keyboard, true);
      trigger.removeEventListener('click', click, true);
    };
  }, [anchor, kind, container]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (closingTimer.current) clearTimeout(closingTimer.current);
    cancelSpring.current?.();
    if (open) {
      setPresent(true);
      if (kind === 'menu') dialog.dataset.focusInput = menuInput.current;
      const wasClosed = !dialog.open;
      if (wasClosed) {
        last.current = anchor?.current ?? (document.activeElement as HTMLElement);
        dialog.dataset.entering = '';
        dialog.showModal();
      }
      delete dialog.dataset.closing;
      dialog.style.removeProperty('transform');
      position.current = 0;
      const updatePosition = () => {
        const trigger = anchor?.current;
        if (!dialog.open || kind !== 'menu' || !trigger) return;
        if (innerWidth < 640) {
          dialog.style.removeProperty('--anchor-top');
          dialog.style.removeProperty('--anchor-left');
          dialog.style.removeProperty('--anchor-origin');
          dialog.style.removeProperty('--trigger-width');
          return;
        }
        const rect = trigger.getBoundingClientRect();
        const vw = document.documentElement.clientWidth || innerWidth;
        const vh = document.documentElement.clientHeight || innerHeight;
        dialog.style.setProperty('--trigger-width', `${rect.width}px`);
        const desiredTop = placement === 'right' ? rect.top : rect.bottom + 8;
        dialog.style.setProperty('--anchor-top', `${Math.max(8, desiredTop)}px`);
        const width = dialog.offsetWidth;
        const height = dialog.offsetHeight;
        const desiredLeft =
          placement === 'right'
            ? rect.right + 8
            : placement === 'bottom-end'
              ? rect.right - width
              : rect.left;
        const left = Math.max(8, Math.min(vw - width - 8, desiredLeft));
        const top = Math.max(8, Math.min(vh - height - 8, desiredTop));
        const origin =
          placement === 'right'
            ? `0px ${rect.top + rect.height / 2 - top}px`
            : `${rect.left + rect.width / 2 - left}px 0px`;
        dialog.style.setProperty('--anchor-top', `${top}px`);
        dialog.style.setProperty('--anchor-left', `${left}px`);
        dialog.style.setProperty('--anchor-origin', origin);
      };
      updatePosition();
      if (wasClosed) {
        // Force the entry presentation once after positioning; reopening an exit preserves its current transform.
        dialog.getBoundingClientRect();
        delete dialog.dataset.entering;
      }
      if (kind === 'menu' && anchor?.current) {
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updatePosition) : null;
        observer?.observe(dialog);
        window.addEventListener('resize', updatePosition);
        window.visualViewport?.addEventListener('resize', updatePosition);
        return () => {
          observer?.disconnect();
          window.removeEventListener('resize', updatePosition);
          window.visualViewport?.removeEventListener('resize', updatePosition);
          if (closingTimer.current) clearTimeout(closingTimer.current);
        };
      }
    } else if (dialog.open) {
      dialog.getBoundingClientRect();
      delete dialog.dataset.dragging;
      dialog.style.removeProperty('transform');
      dialog.dataset.closing = '';
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const duration =
        getComputedStyle(dialog).getPropertyValue(
          reduced ? '--duration-instant' : kind === 'menu' ? '--menu-duration' : '--duration-moderate',
        ) || (kind === 'menu' ? '100ms' : '280ms');
      const ms = parseFloat(duration) * (duration.trim().endsWith('ms') ? 1 : 1000);
      closingTimer.current = setTimeout(finish, ms + 32);
    }
    return () => {
      if (closingTimer.current) clearTimeout(closingTimer.current);
    };
  }, [open, kind, anchor, placement, container]);
  useEffect(
    () => () => {
      cancelSpring.current?.();
      cancelAnimationFrame(dragFrame.current);
    },
    [],
  );
  function start(e: React.PointerEvent<HTMLElement>, handle = false) {
    const dialog = ref.current;
    if (!dialog || e.button !== 0 || (kind !== 'drawer' && !handle)) return;
    const horizontal = kind === 'drawer' || innerWidth >= 640;
    if (!handle && e.pointerType !== 'touch') return;
    cancelSpring.current?.();
    const transform = new DOMMatrixReadOnly(getComputedStyle(dialog).transform);
    const sign = kind === 'drawer' ? -1 : 1;
    position.current = (horizontal ? transform.m41 : transform.m42) * sign;
    const dimension = horizontal ? dialog.offsetWidth : dialog.offsetHeight;
    gesture.current = {
      x: e.clientX,
      y: e.clientY,
      origin: position.current,
      horizontal,
      sign,
      dimension,
      active: Math.abs(position.current) > 0.25,
      samples: [],
    };
    if (gesture.current.active) e.currentTarget.setPointerCapture(e.pointerId);
    record(gesture.current.samples, position.current, e.timeStamp);
  }
  function move(e: React.PointerEvent<HTMLElement>) {
    const g = gesture.current,
      dialog = ref.current;
    if (!g || !dialog) return;
    const main = g.horizontal ? e.clientX - g.x : e.clientY - g.y;
    const cross = g.horizontal ? e.clientY - g.y : e.clientX - g.x;
    if (!g.active) {
      if (Math.max(Math.abs(main), Math.abs(cross)) < 10) return;
      if (Math.abs(cross) > Math.abs(main)) {
        gesture.current = null;
        return;
      }
      g.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      dialog.dataset.dragging = '';
    }
    const raw = g.origin + main * g.sign;
    position.current =
      raw < 0
        ? rubberband(raw, g.dimension)
        : raw > g.dimension
          ? g.dimension + rubberband(raw - g.dimension, g.dimension)
          : raw;
    record(g.samples, position.current, e.timeStamp);
    cancelAnimationFrame(dragFrame.current);
    dragFrame.current = requestAnimationFrame(() => {
      dialog.style.transform = g.horizontal
        ? `translate3d(${position.current * g.sign}px,0,0)`
        : `translate3d(0,${position.current}px,0)`;
    });
  }
  function release(e: React.PointerEvent<HTMLElement>, cancelled = false) {
    const g = gesture.current,
      dialog = ref.current;
    gesture.current = null;
    if (!g?.active || !dialog) return;
    cancelAnimationFrame(dragFrame.current);
    suppressClick.current = true;
    record(g.samples, position.current, e.timeStamp);
    const speed = velocity(g.samples);
    const dismiss = !cancelled && shouldDismiss(position.current, speed, g.dimension);
    const target = dismiss ? g.dimension : 0;
    const update = (v: number) => {
      position.current = v;
      dialog.style.transform = g.horizontal ? `translate3d(${v * g.sign}px,0,0)` : `translate3d(0,${v}px,0)`;
    };
    const complete = () => {
      delete dialog.dataset.dragging;
      if (dismiss) {
        closeRef.current();
        // A saving form may veto dismissal. Keep that dialog reachable.
        requestAnimationFrame(() => {
          if (!openRef.current || !dialog.open) return;
          const restore = () => {
            delete dialog.dataset.dragging;
            dialog.style.removeProperty('transform');
            position.current = 0;
          };
          if (matchMedia('(prefers-reduced-motion: reduce)').matches) restore();
          else {
            dialog.dataset.dragging = '';
            cancelSpring.current = spring({ from: position.current, to: 0, update, complete: restore });
          }
        });
      } else dialog.style.removeProperty('transform');
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      update(target);
      complete();
    } else
      cancelSpring.current = spring({
        from: position.current,
        to: target,
        velocity: speed,
        update,
        complete,
      });
  }
  if (!container) return null;
  return createPortal(
    <dialog
      ref={ref}
      className={`overlay overlay-${kind} ${className}`}
      aria-labelledby={id}
      onPointerDownCapture={(e) => {
        if (kind === 'menu') e.currentTarget.dataset.focusInput = menuInput.current = 'pointer';
      }}
      onKeyDownCapture={(e) => {
        if (kind === 'menu') e.currentTarget.dataset.focusInput = menuInput.current = 'keyboard';
      }}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && !openRef.current) finish();
      }}
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
          e.defaultPrevented ||
          (e.target as HTMLElement).matches('input,textarea,[role="combobox"],select')
        )
          return;
        if (kind === 'sheet' && onNavigate && ['ArrowUp', 'ArrowDown'].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
          onNavigate(e.key === 'ArrowUp' ? -1 : 1);
          return;
        }
        if (kind !== 'menu' || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
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
        if (suppressClick.current) {
          e.preventDefault();
          suppressClick.current = false;
          return;
        }
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
        onPointerDown={(e) => start(e)}
        onPointerMove={move}
        onPointerUp={(e) => release(e)}
        onPointerCancel={(e) => release(e, true)}
      >
        {showHandle && (kind === 'sheet' || kind === 'menu') && (
          <div
            className="sheet-grab"
            onPointerDown={(e) => {
              e.stopPropagation();
              start(e, true);
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
        <Fragment key={generation.current}>{open ? children : present ? retained.current : null}</Fragment>
      </div>
    </dialog>,
    container,
  );
}

export function Toast({
  message,
  onDismiss,
  action,
}: {
  message: string;
  onDismiss: () => void;
  action?: { label: string; onClick: () => void };
}) {
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
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="toast-icon">
        <Icon name="check" />
      </span>
      <p>{message}</p>
      {action && (
        <button type="button" className="secondary small" onClick={action.onClick}>
          {action.label}
        </button>
      )}
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
