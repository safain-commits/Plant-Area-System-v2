'use client';
import { useEffect, useState } from 'react';
type Application = { id: string; name: string; status: string };
export function Applications() {
  const [items, setItems] = useState<Application[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  async function load() {
    const r = await fetch('/api/admin/applications', { cache: 'no-store' }),
      d = await r.json();
    if (!r.ok) throw Error(d.error);
    setItems(d.applications);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  return (
    <section className="panel">
      <h2>Katalog aplikasi</h2>
      <p className="fine">Menonaktifkan aplikasi menutup akses seluruh pengguna. Grant tetap tersimpan.</p>
      {error && (
        <p className="notice error" role="alert">
          {error}{' '}
          <button
            onClick={() =>
              void load()
                .then(() => setError(''))
                .catch((e) => setError(e.message))
            }
          >
            Coba lagi
          </button>
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="user-list">
        {items.map((app) => (
          <div
            className="user-row"
            key={app.id}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
          >
            <strong>{app.name}</strong>
            {app.id === 'bag-filter' ? (
              <button
                className={`small ${app.status === 'active' ? 'danger' : 'secondary'}`}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    const r = await fetch('/api/admin/applications/bag-filter', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: app.status === 'active' ? 'disabled' : 'active' }),
                    });
                    const d = await r.json();
                    if (!r.ok) throw Error(d.error);
                    await load();
                    setNotice('Status aplikasi diperbarui.');
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {app.status === 'active' ? 'Nonaktifkan Bag Filter' : 'Aktifkan Bag Filter'}
              </button>
            ) : (
              <span className="badge neutral">Rencana</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
