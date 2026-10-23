'use client';
import { useState } from 'react';
import { safeReturnTo } from '@plant/contracts';
export function LoginForm({ returnTo }: { returnTo: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const data = Object.fromEntries(new FormData(e.currentTarget));
        try {
          const response = await fetch('/auth/api/sign-in/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          const result = await response.json();
          if (!response.ok) throw Error(result.error || 'Login gagal.');
          window.location.assign(safeReturnTo(returnTo));
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Login gagal.');
          setBusy(false);
        }
      }}
    >
      <label>
        Email
        <input name="email" type="email" autoComplete="username" required maxLength={254} />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required maxLength={128} />
      </label>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy}>
        {busy ? 'Memeriksa akun…' : 'Masuk →'}
      </button>
    </form>
  );
}
export function PasswordForm({ temporary }: { temporary: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const data = Object.fromEntries(new FormData(e.currentTarget));
        if (data.newPassword !== data.confirmPassword) {
          setError('Konfirmasi password belum sama.');
          setBusy(false);
          return;
        }
        try {
          const response = await fetch('/auth/manage/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
          });
          const result = await response.json();
          if (!response.ok) throw Error(result.error);
          window.location.assign('/auth/login?changed=1');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Gagal mengubah password.');
          setBusy(false);
        }
      }}
    >
      <label>
        {temporary ? 'Password sementara' : 'Password saat ini'}
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </label>
      <label>
        Password baru
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
        />
        <small>12–128 karakter.</small>
      </label>
      <label>
        Ulangi password baru
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
        />
      </label>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy}>
        {busy ? 'Menyimpan…' : 'Ganti password'}
      </button>
      <p className="fine">Seluruh sesi akan diakhiri. Masuk kembali dengan password baru.</p>
    </form>
  );
}
