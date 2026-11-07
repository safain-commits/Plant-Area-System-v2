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
const descriptions: Record<string, string> = {
  stock: 'Cari material, periksa saldo R22, lalu tambahkan ke order.',
  consume: 'Ambil material dari R22 untuk satu HAC/SAC. Semua item disimpan sebagai satu dokumen.',
  return: 'Kembalikan material ke R22 dan catat HAC/SAC asalnya.',
  picklist: 'Terima material dari Picklist SAP ke satuan terkecil R22.',
  history: 'Telusuri dokumen dan pergerakan stok R22.',
  manage: 'Kelola master material, rak, dan konfirmasi saldo awal R22.',
  audit: 'Telusuri perubahan material dan stok beserta pencatatnya.',
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
      <Heading eyebrow="Ruang stok R22" title={titles[section]} description={descriptions[section]}>
        {section === 'history' && canConsume(identity, 'receive') && (
          <a className="button primary" href="/consumables/picklist">
            Penerimaan baru
          </a>
        )}
      </Heading>
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
