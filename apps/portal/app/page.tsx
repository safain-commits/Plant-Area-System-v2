import { pageIdentity } from '@plant/server';
import { Shell, Heading, Dashboard, StockSummary, PortalAttention } from '@plant/ui';
import { appCatalog } from '@plant/contracts';
export const dynamic = 'force-dynamic';
export default async function Portal() {
  const identity = await pageIdentity('/');
  const bag = identity.grants.find((g) => g.appId === 'bag-filter');
  const stock = identity.grants.find((g) => g.appId === 'consumables');
  const hour = new Date(Date.now() + 7 * 3600000).getUTCHours();
  const greeting =
    hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  return (
    <Shell identity={identity} active="portal">
      <div className="portal-hub">
        <Heading
          eyebrow="Portal"
          title={`${greeting}, ${identity.name.split(' ')[0]}.`}
          description="Ringkasan pekerjaan dan perhatian di area Anda."
        />
        <PortalAttention identity={identity} />
        <div className="portal-summaries">
          {bag && <Dashboard variant="compact" readOnly={bag.role === 'viewer'} />}
          {stock && <StockSummary identity={identity} variant="compact" />}
        </div>
        {!bag && !stock && (
          <div className="panel empty">
            Belum ada akses aplikasi. Hubungi admin portal untuk menentukan peran dan cakupan Anda.
          </div>
        )}
        <p className="fine portal-planned">
          Segera hadir:{' '}
          {appCatalog
            .filter((a) => a.status === 'planned')
            .map((a) => a.name)
            .join(', ')}
          .
        </p>
      </div>
    </Shell>
  );
}
