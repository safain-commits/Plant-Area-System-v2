import { notFound } from 'next/navigation';
import { pageIdentity } from '@plant/server';
import { AppError, formatDate, formatQuantity, type StockDocumentType } from '@plant/contracts';
import { documentDetail } from '@plant/consumables-core';
import { Shell, Heading } from '@plant/ui';
import { PrintButton } from './print-button';
export const dynamic = 'force-dynamic';
const titles: Record<StockDocumentType, string> = {
  consume: 'R22 Consume Receipt',
  return: 'R22 Return Receipt',
  picklist: 'Bukti Penerimaan Picklist',
};
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    identity = await pageIdentity('/consumables/documents/' + id);
  let result;
  try {
    result = await documentDetail(identity, id);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  const { document: d, lines } = result;
  return (
    <Shell identity={identity} active="consumables" activePath="/consumables/history">
      <div className="r22-print-actions">
        <Heading
          eyebrow="R22 · Bukti transaksi"
          title={titles[d.type]}
          description="Dokumen final · jumlah dan identitas sesuai saat pencatatan"
        />
        <div className="form-actions">
          <a href={`/consumables/history?document=${d.id}`} className="button secondary">
            Kembali ke riwayat
          </a>
          <PrintButton />
        </div>
      </div>
      <article className="panel r22-receipt">
        <header>
          <p className="fine">TQ-CMMS / Consumable Room</p>
          <h1>{titles[d.type]}</h1>
          <strong className="r22-document-number">{d.number}</strong>
          <p>{formatDate(d.createdAt)} WIB</p>
        </header>
        <dl className="stock-detail-grid">
          {[
            ['HAC/SAC / Lokasi fungsional', d.hec || d.functionalLocation || '—'],
            ['Nomor WO', d.wo || '—'],
            ['Keterangan', d.note || '—'],
            ['Peminta', d.requesterName + (d.requesterNik ? ' · ' + d.requesterNik : '')],
            ['Pencatat', d.actorName],
            ['Kanal', d.channel === 'cashier' ? 'R22 Cashier' : 'Mandiri'],
            ...(d.sourceRef ? [['Consume Order asal', d.sourceRef]] : []),
            ...(d.type === 'picklist'
              ? [
                  ['Nomor reservasi', d.reservationNo],
                  ['Nomor equipment', d.equipmentNo || '—'],
                  ['Lokasi fungsional SAP', d.functionalLocation || '—'],
                  ['Pusat biaya', d.costCenter || '—'],
                  ['Tanggal kebutuhan', d.requiredDate || '—'],
                ]
              : []),
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="r22-receipt-table">
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>MMID / Material</th>
                {d.type === 'picklist' && <th>Jumlah SAP</th>}
                <th>Jumlah R22</th>
                <th>Satuan</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.lineNo}</td>
                  <td>
                    <strong>
                      {l.mmid} · {l.commonName || l.description}
                    </strong>
                    <small>{l.description}</small>
                  </td>
                  {d.type === 'picklist' && (
                    <td>{l.sapQuantity ? `${formatQuantity(l.sapQuantity)} ${l.sapUnit}` : 'Input R22'}</td>
                  )}
                  <td>{formatQuantity(l.quantity.replace('-', ''))}</td>
                  <td>{l.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fine">{lines.length} item tercatat pada dokumen ini.</p>
        <div className="r22-signatures">
          <div>
            Peminta<span>{d.requesterName}</span>
          </div>
          <div>
            R22 Cashier / Pencatat<span>{d.actorName}</span>
          </div>
        </div>
      </article>
    </Shell>
  );
}
