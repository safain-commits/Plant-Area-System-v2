import { pageIdentity } from '@plant/server';
import { Shell, Heading } from '@plant/ui';
import { hasPermission } from '@plant/contracts';
import AuditList from './list';
export const dynamic = 'force-dynamic';
export default async function Audit() {
  const identity = await pageIdentity('/bag-filter/audit');
  return (
    <Shell identity={identity} active="bag-filter">
      <Heading
        eyebrow="BAG FILTER / AUDIT"
        title="Jejak pencatatan"
        description="Aktivitas penggantian sesuai cakupan equipment Anda."
      />
      {hasPermission(identity, 'audit') ? (
        <AuditList />
      ) : (
        <section className="panel">
          <h2>Akses belum diberikan</h2>
          <p>Audit aplikasi hanya tersedia untuk admin Bag Filter.</p>
        </section>
      )}
    </Shell>
  );
}
