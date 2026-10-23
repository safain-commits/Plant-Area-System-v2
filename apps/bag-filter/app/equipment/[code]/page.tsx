import { notFound } from 'next/navigation';
import { pageIdentity } from '@plant/server';
import { Shell } from '@plant/ui';
import { getEquipment, hasPermission } from '@plant/contracts';
import { snapshot } from '@plant/bag-core';
import BagMonitor from './monitor';
export const dynamic = 'force-dynamic';
export default async function EquipmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ batch?: string }>;
}) {
  const batch = (await searchParams).batch || '';
  const code = (await params).code.toUpperCase(),
    eq = getEquipment(code);
  if (!eq) notFound();
  const identity = await pageIdentity(`/bag-filter/equipment/${code.toLowerCase()}`);
  return (
    <Shell identity={identity} active="bag-filter" activeEquipment={code}>
      {hasPermission(identity, 'read', code) ? (
        <BagMonitor
          initialBatch={batch.slice(0, 200)}
          initial={await snapshot(code)}
          writable={hasPermission(identity, 'write', code)}
        />
      ) : (
        <section className="panel" style={{ marginTop: 30 }}>
          <h1>Akses belum diberikan</h1>
          <p>Equipment ini berada di luar cakupan akun Anda.</p>
          <a href="/bag-filter">Kembali ke Bag Filter</a>
        </section>
      )}
    </Shell>
  );
}
