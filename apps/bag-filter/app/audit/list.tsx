'use client';
import { useEffect, useState } from 'react';
import { formatDate } from '@plant/contracts';
type Event = {
  id: string;
  batchId: string;
  equipmentCode: string;
  actorName: string;
  createdAt: string;
  details: { count: number; wo: string; brand?: string };
};
export default function AuditList() {
  const [items, setItems] = useState<Event[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function load(after?: string) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/bag-filter/api/audit${after ? `?cursor=${after}` : ''}`, { cache: 'no-store' }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      setItems((old) => (after ? [...old, ...d.items] : d.items));
      setCursor(d.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="panel">
      {error && (
        <p className="notice error" role="alert">
          {error}{' '}
          <button className="small secondary" onClick={() => void load()}>
            Coba lagi
          </button>
        </p>
      )}
      <div className="scroll-table">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Waktu WIB</th>
              <th>Equipment</th>
              <th>Pencatat</th>
              <th>Bag</th>
              <th>WO</th>
              <th>Brand/Pabrikan</th>
              <th>Batch</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id}>
                <td>{formatDate(e.createdAt)}</td>
                <td>{e.equipmentCode}</td>
                <td>{e.actorName}</td>
                <td>{e.details.count}</td>
                <td>{e.details.wo || 'Tanpa WO'}</td>
                <td>{e.details.brand || 'Belum tercatat'}</td>
                <td>{e.batchId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!items.length && <p className="empty">{busy ? 'Memuat audit…' : 'Belum ada aktivitas pencatatan.'}</p>}
      {cursor && (
        <button className="secondary" disabled={busy} onClick={() => void load(cursor)}>
          Muat aktivitas berikutnya
        </button>
      )}
    </section>
  );
}
