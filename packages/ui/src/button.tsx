'use client';
import type { ButtonHTMLAttributes } from 'react';

export function Button({
  busy = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button {...props} className={`busy-button ${className}`} disabled={disabled || busy} aria-busy={busy}>
      <span className="button-label" style={busy ? { visibility: 'hidden' } : undefined}>
        {children}
      </span>
      {busy && <span className="button-spinner" aria-hidden="true" />}
    </button>
  );
}
