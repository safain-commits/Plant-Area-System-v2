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
          <strong className="r22-document-number code-text">{d.number}</strong>
          <p>{formatDate(d.createdAt)} WIB</p>
        </header>
        <dl className="stock-detail-grid">
          {[
            ['HAC/SAC / Lokasi fungsional', d.hec || d.functionalLocation || '—', true],
            ['Nomor WO', d.wo || '—', true],
            ['Keterangan', d.note || '—', false],
            ['Peminta', d.requesterName + (d.requesterNik ? ' · ' + d.requesterNik : ''), false],
            ['Pencatat', d.actorName, false],
            ['Kanal', d.channel === 'cashier' ? 'R22 Cashier' : 'Mandiri', false],
            ...(d.sourceRef ? ([['Consume Order asal', d.sourceRef, true]] as const) : []),
            ...(d.type === 'picklist'
              ? ([
                  ['Nomor reservasi', d.reservationNo, true],
                  ['Nomor equipment', d.equipmentNo || '—', true],
                  ['Lokasi fungsional SAP', d.functionalLocation || '—', true],
                  ['Pusat biaya', d.costCenter || '—', true],
                  ['Tanggal kebutuhan', d.requiredDate || '—', false],
                ] as const)
              : []),
          ].map(([label, value, code]) => (
            <div key={String(label)}>
              <dt>{label}</dt>
              <dd className={code ? 'code-text' : undefined}>{value}</dd>
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
                      <span className="code-text">{l.mmid}</span> · {l.commonName || l.description}
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
