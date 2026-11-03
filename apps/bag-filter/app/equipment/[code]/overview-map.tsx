'use client';

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '@plant/ui';

/** Both equipment sides share one scroll position, preserving their physical alignment. */
export function OverviewMap({
  equipmentCode,
  perSide,
  onScroll,
  children,
}: {
  equipmentCode: string;
  perSide: number;
  onScroll: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [edges, setEdges] = useState({ previous: false, next: false });
  const updateEdges = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const previous = el.scrollLeft > 1;
    const next = el.scrollWidth - el.clientWidth - el.scrollLeft > 1;
    setEdges((old) => (old.previous === previous && old.next === next ? old : { previous, next }));
  }, []);

  useEffect(() => {
    const el = viewport.current;
    const content = canvas.current;
    if (!el || !content) return;
    el.scrollLeft = 0;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    observer.observe(content);
    return () => observer.disconnect();
  }, [equipmentCode, updateEdges]);

  function scroll(direction: -1 | 1, end?: boolean) {
    const el = viewport.current;
    const band = canvas.current?.querySelector<HTMLElement>('.overview-band');
    const compartment = band?.firstElementChild;
    if (!el || !band || !compartment) return;
    const step = compartment.getBoundingClientRect().width + parseFloat(getComputedStyle(band).columnGap);
    el.scrollTo({
      left: end ? (direction === 1 ? el.scrollWidth : 0) : el.scrollLeft + direction * step,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }

  return (
    <div className="overview-map">
      <div className="overview-scroll-tools">
        <p id={`${id}-hint`}>Geser untuk melihat seluruh kompartemen</p>
        <div className="overview-scroll-actions">
          <button
            type="button"
            className="secondary overview-scroll-button"
            aria-label="Kompartemen sebelumnya"
            aria-controls={id}
            disabled={!edges.previous}
            onClick={() => scroll(-1)}
          >
            <Icon name="chevron" style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button
            type="button"
            className="secondary overview-scroll-button"
            aria-label="Kompartemen berikutnya"
            aria-controls={id}
            disabled={!edges.next}
            onClick={() => scroll(1)}
          >
            <Icon name="chevron" />
          </button>
        </div>
      </div>
      <div
        className="overview-scroll-frame"
        data-scroll-previous={edges.previous}
        data-scroll-next={edges.next}
      >
        <div
          id={id}
          ref={viewport}
          className="overview-viewport"
          role="region"
          aria-label={`Peta seluruh kompartemen ${equipmentCode}`}
          aria-describedby={`${id}-hint`}
          tabIndex={0}
          onScroll={() => {
            updateEdges();
            onScroll();
          }}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
              event.preventDefault();
              scroll(
                event.key === 'ArrowLeft' || event.key === 'Home' ? -1 : 1,
                event.key === 'Home' || event.key === 'End',
              );
            }
          }}
          onPointerDownCapture={(event) => {
            gesture.current =
              event.pointerType === 'mouse'
                ? null
                : {
                    x: event.clientX,
                    y: event.clientY,
                    moved: false,
                  };
          }}
          onPointerMoveCapture={(event) => {
            const start = gesture.current;
            if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) start.moved = true;
          }}
          onPointerCancelCapture={() => {
            if (gesture.current) gesture.current.moved = true;
          }}
          onClickCapture={(event) => {
            // Native touch scrolling remains in charge; a completed pan must never select a bag.
            if (event.detail > 0 && gesture.current?.moved) {
              event.preventDefault();
              event.stopPropagation();
            }
            gesture.current = null;
          }}
        >
          <div
            ref={canvas}
            className="overview-canvas"
            style={{ '--overview-compartments': perSide } as CSSProperties}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
