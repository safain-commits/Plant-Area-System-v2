import { pageIdentity } from '@plant/server';
import { Shell, Heading } from '@plant/ui';
import { AdminWorkspace } from './workspace';
import { Applications } from './applications';
export const dynamic = 'force-dynamic';
export default async function Admin() {
  const identity = await pageIdentity('/admin');
  return (
    <Shell identity={identity} active="admin">
      <Heading
        eyebrow="ADMINISTRASI"
        title="Pengguna & hak akses"
        description="Tentukan siapa yang dapat membuka aplikasi dan equipment."
      />
      {identity.portalAdmin ? (
        <>
          <Applications />
          <AdminWorkspace />
        </>
      ) : (
        <section className="panel">
          <h2>Akses belum diberikan</h2>
          <p>Halaman ini hanya tersedia untuk admin portal.</p>
        </section>
      )}
    </Shell>
  );
}
