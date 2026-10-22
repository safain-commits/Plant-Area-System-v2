'use client';
import { useState } from 'react';
import type { Identity } from '@plant/contracts';
export function ProfileForm({ identity }: { identity: Identity }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        setMessage('');
        const body = Object.fromEntries(new FormData(e.currentTarget));
        try {
          const r = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          setMessage('Profil diperbarui.');
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Informasi pribadi</h2>
      <div className="form-grid">
        <label>
          Nama
          <input name="name" defaultValue={identity.name} minLength={2} maxLength={100} required />
        </label>
        <label>
          Jabatan
          <input name="position" defaultValue={identity.position} maxLength={100} />
        </label>
      </div>
      <p className="muted">Email akun: {identity.email}</p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div>
        <button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan profil'}</button>
      </div>
    </form>
  );
}
