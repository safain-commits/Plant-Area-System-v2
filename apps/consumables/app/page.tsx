import { pageIdentity } from '@plant/server';
import { canConsume } from '@plant/contracts';
import { Shell, Heading, StockSummary } from '@plant/ui';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const identity = await pageIdentity('/consumables');
  return (
    <Shell identity={identity} active="consumables">
      <Heading
        eyebrow="MATERIAL CONTROL"
        title="Consumable Room"
        description="Stok, penerimaan, dan pemakaian material sesuai lokasi kerja Anda."
      />
      {canConsume(identity, 'read') ? (
        <StockSummary identity={identity} />
      ) : (
        <p className="notice error">Akses aplikasi belum diberikan.</p>
      )}
    </Shell>
  );
}
