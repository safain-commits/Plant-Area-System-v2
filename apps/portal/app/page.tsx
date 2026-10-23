import { pageIdentity } from '@plant/server';
import { Shell, Heading, Dashboard, StockSummary } from '@plant/ui';
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
        <span className="badge success">
          <i className="live-dot" />
          Akun aktif
        </span>
      </Heading>
      {grant && <Dashboard />}
      {identity.grants.some((g) => g.appId === 'consumables') && (
        <StockSummary identity={identity} variant="compact" />
      )}
      <div className="section-title">
        <h2>Aplikasi Anda</h2>
        <small>Siap digunakan</small>
      </div>
      <div className="app-grid">
        {allowed.map((app) => (
          <a className="app-card" href={app.path} key={app.id}>
            <div className="card-top">
              <span className="app-icon">▦</span>
              <span className="badge success">Aktif</span>
            </div>
            <h3>{app.name}</h3>
            <p>{app.description}</p>
            <div className="card-foot">
              <span>
                {identity.grants.find((g) => g.appId === app.id)?.role === 'viewer'
                  ? 'Lihat data'
                  : 'Buka aplikasi'}
              </span>
              <span>↗</span>
            </div>
          </a>
        ))}
      </div>
      {!allowed.length && (
        <div className="panel empty">
          Belum ada akses aplikasi. Hubungi admin portal untuk menentukan role dan cakupan Anda.
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
