import { pageIdentity } from '@plant/server';
import { Shell, Heading, LogoutButton, ThemePreferenceControl } from '@plant/ui';
import { ProfileForm } from './profile-form';
export const dynamic = 'force-dynamic';
export default async function Profile() {
  const identity = await pageIdentity('/profile');
  return (
    <Shell identity={identity} active="profile">
      <Heading
        eyebrow="AKUN SAYA"
        title="Profil & keamanan"
        description="Informasi profil tidak mengubah hak akses aplikasi."
      />
      <section className="panel">
        <ProfileForm identity={identity} />
      </section>
      <section className="panel">
        <h2>Tampilan</h2>
        <ThemePreferenceControl />
      </section>
      <section className="panel">
        <h2>Keamanan akun</h2>
        <p className="muted">
          Ganti password secara berkala dan keluar saat selesai memakai perangkat bersama.
        </p>
        <div className="inline">
          <a className="badge" href="/auth/change-password">
            Ganti password ↗
          </a>
          <div>
            <LogoutButton />
          </div>
        </div>
      </section>
      <section className="panel">
        <h2>Akses aplikasi</h2>
        {identity.grants.map((g) => (
          <p key={g.appId}>
            <strong>
              {g.appId} · {g.role}
            </strong>
            <br />
            <span className="muted">{g.equipment.join(', ')}</span>
          </p>
        ))}
        {!identity.grants.length && <p className="muted">Belum ada akses aplikasi.</p>}
      </section>
    </Shell>
  );
}
