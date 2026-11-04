import { formatDate } from '@plant/contracts';

export type TimelineItem = {
  brand: string | null;
  id: string;
  installedAt: string;
  endedAt: string | null;
  createdAt: string;
  reason: string;
  wo: string;
  actorName: string;
};

export function CoordinateHistory({
  items,
  loading,
  error,
  hasPosition,
  hasMore,
  now,
  onRetry,
  onMore,
}: {
  items: TimelineItem[];
  loading: boolean;
  error: string;
  hasPosition: boolean;
  hasMore: boolean;
  now: number;
  onRetry: () => void;
  onMore: () => void;
}) {
  return (
    <>
      {error && (
        <p className="notice error" role="alert">
          {error}{' '}
          <button className="small secondary" onClick={onRetry} disabled={loading}>
            Coba lagi
          </button>
        </p>
      )}
      {loading && !items.length ? (
        <p className="loading-line">Memuat riwayat…</p>
      ) : !hasPosition ? (
        <p className="empty">Pilih bag untuk melihat pemasangan dan masa pakainya.</p>
      ) : !items.length ? (
        <p className="empty">Belum ada catatan untuk posisi ini.</p>
      ) : (
        <div className="timeline" role="region" aria-label="Daftar riwayat koordinat" tabIndex={0}>
          {items.map((item) => {
            const hours = Math.max(
              0,
              Math.floor(
                ((item.endedAt ? Date.parse(item.endedAt) : now) - Date.parse(item.installedAt)) / 3600000,
              ),
            );
            return (
              <article key={item.id}>
                <strong>{item.endedAt ? 'Pernah terpasang' : 'Terpasang sekarang'}</strong>
                <small>{formatDate(item.installedAt)} WIB</small>
                <small>Brand/Pabrikan: {item.brand || 'Belum tercatat'}</small>
                <strong className={!item.endedAt ? 'now' : ''}>
                  {Math.floor(hours / 24).toLocaleString('id-ID')} hari
                </strong>
                <small>
                  {item.wo || 'Tanpa WO'} · {item.reason}
                </small>
                <small>
                  {item.actorName} · dicatat {formatDate(item.createdAt)} WIB
                </small>
              </article>
            );
          })}
        </div>
      )}
      {hasMore && (
        <button className="secondary small" disabled={loading} onClick={onMore}>
          Riwayat sebelumnya
        </button>
      )}
    </>
  );
}
