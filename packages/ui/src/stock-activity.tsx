import { formatDate, stockDocumentLabels, type StockDocument } from '@plant/contracts';
import { Icon } from './icon';
export const movementLabels = {
  opening: 'Saldo awal',
  receipt: 'Penerimaan',
  issue: 'Pemakaian',
  return: 'Return Order',
  adjustment: 'Koreksi',
} as const;
export function StockActivity({ items, compact = false }: { items: StockDocument[]; compact?: boolean }) {
  if (compact)
    return (
      <div className="summary-activity-list">
        {items.length ? (
          items.slice(0, 3).map((d) => (
            <a key={d.id} href={`/consumables/history?document=${encodeURIComponent(d.id)}`}>
              <span>
                <strong>{d.number}</strong>
                <small>
                  {stockDocumentLabels[d.type]} · {d.hec || 'R22'} · {formatDate(d.createdAt)} WIB
                </small>
              </span>
              <span>{d.lineCount} item</span>
            </a>
          ))
        ) : (
          <p className="muted">Belum ada dokumen di stok R22.</p>
        )}
      </div>
    );
  return (
    <section
      className={compact ? 'stock-activity summary-stock-activity' : 'panel recent-card stock-activity'}
    >
      {!compact && (
        <div className="section-head">
          <h2>Aktivitas terbaru</h2>
          <Icon name="clock" />
        </div>
      )}
      <div className="activity-scroll" tabIndex={0} role="region" aria-label="Aktivitas material terbaru">
        {!items.length ? (
          <div className="empty">
            <Icon name="clock" />
            <p>Belum ada dokumen di stok R22.</p>
          </div>
        ) : (
          items.slice(0, compact ? 3 : 8).map((d) => (
            <a
              key={d.id}
              className="activity-row stock-activity-row"
              href={`/consumables/history?document=${encodeURIComponent(d.id)}`}
            >
              <span className={`app-icon movement-icon ${d.type}`}>
                <Icon name={d.type === 'consume' ? 'issue' : 'receipt'} />
              </span>
              <span className="stock-activity-description">
                <strong>{d.number}</strong>
                <small>
                  {stockDocumentLabels[d.type]} · {d.hec || 'R22'}
                </small>
                <small title={d.requesterName}>{d.requesterName}</small>
                <small>
                  {d.actorName} · {formatDate(d.createdAt)} WIB
                </small>
              </span>
              <span className="stock-activity-value">
                <strong>
                  {d.lineCount} <small>item</small>
                </strong>
              </span>
            </a>
          ))
        )}
      </div>
      {!compact && (
        <a className="stock-history-link" href="/consumables/history">
          Lihat riwayat <Icon name="arrow" />
        </a>
      )}
    </section>
  );
}
