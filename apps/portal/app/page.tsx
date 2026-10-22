import { pageIdentity } from '@plant/server';
import { Shell, Heading } from '@plant/ui';
import { appCatalog } from '@plant/contracts';
export const dynamic = 'force-dynamic';
export default async function Portal() {
  const identity = await pageIdentity('/');
  const allowed = appCatalog
    .filter((a) => a.status === 'active')
    .filter((a) => identity.grants.some((g) => g.appId === a.id));
  const grant = identity.grants.find((g) => g.appId === 'bag-filter');
  return (
    <Shell identity={identity} active="portal">
      <Heading
        eyebrow="OPERATIONS HUB"
        title={`Selamat datang, ${identity.name.split(' ')[0]}.`}
        description="Akses aplikasi maintenance sesuai peran dan area kerja Anda."
      >
        <span className="badge">
          <i className="live-dot" />
          Akun aktif
        </span>
      </Heading>
      <section className="hero">
        <div>
          <p className="eyebrow">DARI WORKSHOP SAMPAI PLANT FLOOR</p>
          <h2>
            Setiap pekerjaan terhubung.
            <br />
            Setiap riwayat tercatat.
          </h2>
          <p>
            Pilih aplikasi untuk memulai pekerjaan. Satu akun membawa Anda ke area yang menjadi tanggung jawab
            Anda.
          </p>
        </div>
        <div className="hero-mark" aria-hidden="true">
          ▥
        </div>
      </section>
      <div className="stats">
        <article className="stat">
          <span>APLIKASI ANDA</span>
          <strong>
            {allowed.length} <small>aplikasi</small>
          </strong>
          <small>Akses telah diberikan</small>
        </article>
        <article className="stat">
          <span>CAKUPAN BAG FILTER</span>
          <strong>
            {grant?.equipment.length || 0} <small>equipment</small>
          </strong>
          <small>Sesuai tanggung jawab</small>
        </article>
        <article className="stat">
          <span>AKUN & AKSES</span>
          <strong style={{ fontSize: 20 }}>{identity.portalAdmin ? 'Admin portal' : 'Pengguna'}</strong>
          <small>{identity.position || 'Maintenance Tuban'}</small>
        </article>
      </div>
      <div className="section-title">
        <h2>Aplikasi Anda</h2>
        <small>Siap digunakan</small>
      </div>
      <div className="app-grid">
        {allowed.map((app) => (
          <a className="app-card" href={app.path} key={app.id}>
            <div className="card-top">
              <span className="app-icon">▦</span>
              <span className="badge">Aktif</span>
            </div>
            <h3>{app.name}</h3>
            <p>{app.description}</p>
            <div className="card-foot">
              <span>{grant?.role === 'viewer' ? 'Lihat data' : 'Buka aplikasi'}</span>
              <span>↗</span>
            </div>
          </a>
        ))}
      </div>
      {!allowed.length && (
        <div className="panel empty">
          Belum ada akses aplikasi. Hubungi admin portal untuk menentukan role dan equipment Anda.
        </div>
      )}
      <div className="section-title">
        <h2>Pengembangan berikutnya</h2>
        <small>Direncanakan</small>
      </div>
      <div className="app-grid">
        {appCatalog
          .filter((a) => a.status === 'planned')
          .map((app) => (
            <article className="app-card planned" key={app.id}>
              <div className="card-top">
                <span className="app-icon">□</span>
                <span className="badge neutral">Rencana</span>
              </div>
              <h3>{app.name}</h3>
              <p>{app.description}</p>
            </article>
          ))}
      </div>
    </Shell>
  );
}
