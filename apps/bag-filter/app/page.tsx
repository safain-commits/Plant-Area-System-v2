import { pageIdentity } from '@plant/server';
import { Shell, Heading } from '@plant/ui';
import { equipment, equipmentSideSummary } from '@plant/contracts';
export const dynamic = 'force-dynamic';
export default async function BagFilter() {
  const identity = await pageIdentity('/bag-filter'),
    grant = identity.grants.find((g) => g.appId === 'bag-filter');
  return (
    <Shell identity={identity} active="bag-filter">
      <Heading
        eyebrow="EQUIPMENT PROCESS / BAG FILTER"
        title="Bag Filter"
        description="Pantau umur bag dan telusuri penggantian di setiap koordinat."
      >
        <span className="badge">Data aktual</span>
      </Heading>
      <div className="equipment-grid">
        {equipment
          .filter((e) => grant?.equipment.includes(e.code))
          .map((e) => (
            <a key={e.code} href={`/bag-filter/equipment/${e.code.toLowerCase()}`} className="equipment-card">
              <div className="card-top">
                <div>
                  <p className="eyebrow">BAG FILTER</p>
                  <h2>{e.code}</h2>
                </div>
                <span>↗</span>
              </div>
              <span className="big-number">
                {(e.compartments * e.bagsPerCompartment).toLocaleString('id-ID')} <small>posisi bag</small>
              </span>
              <p>
                {e.compartments} kompartemen · {equipmentSideSummary(e)}
              </p>
              <div className="legend">
                <span>
                  <i style={{ background: 'var(--success-text)' }} />
                  Umur otomatis 24/7
                </span>
                <span>Skala 0–900 hari</span>
              </div>
            </a>
          ))}
      </div>
      {!grant && (
        <section className="panel">
          <h2>Akses belum diberikan</h2>
          <p>Hubungi admin portal untuk akses Bag Filter.</p>
        </section>
      )}
      {grant?.role === 'admin' && (
        <div className="section-title">
          <a className="badge" href="/bag-filter/audit">
            Lihat audit aplikasi ↗
          </a>
        </div>
      )}
    </Shell>
  );
}
