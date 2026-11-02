'use client';
import { useState } from 'react';
import { clearR22Carts } from './r22-cart';
export function LogoutButton() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <button
        className="secondary logout"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const r = await fetch('/auth/api/sign-out', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '{}',
            });
            if (!r.ok) throw Error();
            clearR22Carts();
            window.location.assign('/auth/login');
          } catch {
            setError('Logout gagal. Coba lagi.');
            setBusy(false);
          }
        }}
      >
        {busy ? 'Keluar…' : 'Keluar akun ↗'}
      </button>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </>
  );
}
