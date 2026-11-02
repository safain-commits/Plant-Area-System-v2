import { notFound } from 'next/navigation';
import { pageIdentity } from '@plant/server';
import { Shell, Heading } from '@plant/ui';
import { canConsume } from '@plant/contracts';
import { ConsumablesWorkspace } from '../workspace';
import { OrderCart } from '../order-cart';
import { Picklist } from '../picklist';
import { StockHistory } from '../stock-history';
export const dynamic = 'force-dynamic';
const titles: Record<string, string> = {
  stock: 'Cari material',
  consume: 'Consume Order',
  return: 'Return Order',
  picklist: 'Penerimaan Picklist',
  history: 'Riwayat material',
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
          : section === 'picklist'
            ? 'receive'
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
        description="Satu stok R22 untuk seluruh pengguna sesuai hak tindakan Anda."
      />
      {canConsume(identity, action) ? (
        section === 'consume' || section === 'return' ? (
          <OrderCart identity={identity} type={section} />
        ) : section === 'picklist' ? (
          <Picklist identity={identity} />
        ) : section === 'history' ? (
          <StockHistory identity={identity} />
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
