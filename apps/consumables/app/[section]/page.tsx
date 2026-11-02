import { notFound } from 'next/navigation';
import { pageIdentity } from '@plant/server';
import { Shell, Heading } from '@plant/ui';
import { canConsume } from '@plant/contracts';
import { ConsumablesWorkspace } from '../workspace';
import { OrderCart } from '../order-cart';
export const dynamic = 'force-dynamic';
const titles: Record<string, string> = {
  stock: 'Cari material',
  consume: 'Consume Order',
  return: 'Return Order',
  receive: 'Penerimaan material',
  issue: 'Pemakaian material',
  history: 'Riwayat pergerakan stok',
  manage: 'Pengelolaan material',
  audit: 'Audit Consumable Room',
};
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!titles[section]) notFound();
  const identity = await pageIdentity(`/consumables/${section}`),
    action =
      section === 'return'
        ? 'return'
        : section === 'consume'
          ? 'issue'
          : section === 'receive'
            ? 'receive'
            : section === 'issue'
              ? 'issue'
              : section === 'manage'
                ? 'manage'
                : section === 'audit'
                  ? 'audit'
                  : 'read';
  return (
    <Shell identity={identity} active="consumables" activePath={`/consumables/${section}`}>
      <Heading
        eyebrow="CONSUMABLE ROOM"
        title={titles[section]}
        description="Seluruh saldo dan transaksi mengikuti lokasi yang diberikan kepada Anda."
      />
      {canConsume(identity, action) ? (
        section === 'consume' || section === 'return' ? (
          <OrderCart identity={identity} type={section} />
        ) : (
          <ConsumablesWorkspace identity={identity} view={section} />
        )
      ) : (
        <p className="notice error" role="alert">
          Anda tidak memiliki akses untuk tindakan ini.
        </p>
      )}
    </Shell>
  );
}
