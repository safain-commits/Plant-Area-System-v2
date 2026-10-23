'use client';
import { Select, Input, Button, useConfirmation } from '@plant/ui';
import { useCallback, useEffect, useState } from 'react';
import { equipmentCodes, formatDate, type Grant } from '@plant/contracts';
type ManagedUser = {
  id: string;
  name: string;
  email: string;
  position: string;
  active: boolean;
  portalAdmin: boolean;
  mustChangePassword: boolean;
  grants: Grant[];
};
async function send(path: string, body: unknown) {
  const r = await fetch(`/api/admin/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || 'Gagal menyimpan.');
  return data;
}
export function AdminWorkspace() {
  const [users, setUsers] = useState<ManagedUser[]>([]),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [search, setSearch] = useState('');
  const [events, setEvents] = useState<
    { id: string; actorName: string; action: string; createdAt: string; targetId: string }[]
  >([]);
  const load = useCallback(async () => {
    const [u, a] = await Promise.all([
      fetch('/api/admin/users', { cache: 'no-store' }),
      fetch('/api/admin/audit', { cache: 'no-store' }),
    ]);
    const [ud, ad] = await Promise.all([u.json(), a.json()]);
    if (!u.ok || !a.ok) throw Error(ud.error || ad.error);
    setUsers(ud.users);
    setEvents(ad.items);
    setReady(true);
  }, []);
  useEffect(() => {
    void load().catch((e) => {
      setError(e.message);
      setReady(true);
    });
  }, [load]);
  async function act(path: string, body: unknown, success: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await send(path, body);
      await load();
      setMessage(success);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <p className="notice error" role="alert">
          {error}{' '}
          <Button
            className="small secondary"
            onClick={() =>
              void load()
                .then(() => setError(''))
                .catch((e) => setError(e.message))
            }
          >
            Coba lagi
          </Button>
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <details className="panel">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>+ Buat pengguna baru</summary>
        <form
          className="form-stack"
          style={{ marginTop: 22 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            if (
              await act(
                'users',
                Object.fromEntries(new FormData(form)),
                'Pengguna dibuat. Tetapkan akses aplikasinya di bawah.',
              )
            )
              form.reset();
          }}
        >
          <div className="form-grid">
            <label>
              Nama
              <Input name="name" required minLength={2} maxLength={100} />
            </label>
            <label>
              Email
              <Input name="email" type="email" required maxLength={254} />
            </label>
            <label>
              Jabatan
              <Input name="position" maxLength={100} />
            </label>
            <label>
              Password sementara
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
              <small>Pengguna wajib menggantinya saat pertama masuk.</small>
            </label>
          </div>
          <div>
            <Button className="primary" busy={busy}>
              Buat akun
            </Button>
          </div>
        </form>
      </details>
      <div className="section-title">
        <h2>{users.length} pengguna</h2>
        <small>Admin portal mengatur semua grant</small>
      </div>
      <label style={{ marginBottom: 18 }}>
        Cari pengguna
        <Input
          type="search"
          placeholder="Nama atau email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {!ready && <p className="loading-line">Memuat pengguna…</p>}
      <div className="user-list">
        {users
          .filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()))
          .map((u) => (
            <UserRow key={`${u.id}-${JSON.stringify(u)}`} user={u} busy={busy} act={act} />
          ))}
      </div>
      <section className="panel" style={{ marginTop: 26 }}>
        <h2>Aktivitas administrasi terbaru</h2>
        <div className="scroll-table">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Waktu WIB</th>
                <th>Pencatat</th>
                <th>Aktivitas</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{formatDate(event.createdAt)}</td>
                  <td>{event.actorName}</td>
                  <td>{event.action}</td>
                  <td>{users.find((u) => u.id === event.targetId)?.name || event.targetId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fine">Menampilkan 50 aktivitas terbaru.</p>
      </section>
    </>
  );
}
function UserRow({
  user: u,
  busy,
  act,
}: {
  user: ManagedUser;
  busy: boolean;
  act: (p: string, b: unknown, s: string) => Promise<boolean>;
}) {
  const confirm = useConfirmation();
  const grant = u.grants.find((g) => g.appId === 'bag-filter');
  return (
    <details className="user-row">
      <summary>
        <div>
          <strong>{u.name}</strong>
          <small>
            {u.email} · {u.position || 'Jabatan belum diisi'}
          </small>
        </div>
        <span className={`badge ${u.active ? 'success' : 'neutral'}`}>
          {u.active ? 'Aktif' : 'Nonaktif'}
          {u.portalAdmin ? ' · Admin' : ''}
        </span>
      </summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          void act(
            `users/${u.id}/access`,
            { active: data.has('active'), portalAdmin: data.has('portalAdmin') },
            'Status akun diperbarui.',
          );
        }}
      >
        <h3>Status akun</h3>
        <div className="inline">
          <label>
            <input type="checkbox" name="active" defaultChecked={u.active} />
            Akun aktif
          </label>
          <label>
            <input type="checkbox" name="portalAdmin" defaultChecked={u.portalAdmin} />
            Admin portal
          </label>
          <Button className="small secondary" busy={busy}>
            Simpan status
          </Button>
        </div>
      </form>
      <hr className="divider" />
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget),
            role = data.get('role');
          void act(
            `users/${u.id}/grant`,
            { grant: role ? { appId: 'bag-filter', role, equipment: data.getAll('equipment') } : null },
            'Akses Bag Filter diperbarui.',
          );
        }}
      >
        <h3>Akses Bag Filter</h3>
        <label>
          Role
          <Select aria-label="Role" name="role" defaultValue={grant?.role || ''}>
            <option value="">Tidak diberi akses</option>
            <option value="viewer">Viewer — baca data</option>
            <option value="operator">Operator — catat penggantian</option>
            <option value="admin">Admin aplikasi — catat & lihat audit</option>
          </Select>
        </label>
        <div className="check-grid">
          {equipmentCodes.map((code) => (
            <label key={code}>
              <input
                type="checkbox"
                name="equipment"
                value={code}
                defaultChecked={grant?.equipment.includes(code)}
              />
              {code}
            </label>
          ))}
        </div>
        <div>
          <Button className="primary" busy={busy}>
            Simpan akses aplikasi
          </Button>
        </div>
      </form>
      <hr className="divider" />
      <details>
        <summary style={{ cursor: 'pointer', fontSize: 13 }}>Reset password</summary>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            if (!(await confirm('Reset password pengguna? Seluruh sesi pengguna akan dicabut.'))) return;
            if (
              await act(
                `users/${u.id}/password`,
                { password: new FormData(form).get('password') },
                'Password direset. Semua sesi pengguna telah diakhiri.',
              )
            )
              form.reset();
          }}
        >
          <label>
            Password sementara baru
            <Input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
          <p className="fine">Seluruh sesi pengguna akan dicabut. Password wajib diganti setelah login.</p>
          <div>
            <Button className="danger" busy={busy}>
              Reset password pengguna
            </Button>
          </div>
        </form>
      </details>
    </details>
  );
}
