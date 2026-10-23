import { formatDate, formatQuantity, type Movement } from '@plant/contracts';
import { Icon, type IconName } from './icon';
export const movementLabels = {
  opening: 'Saldo awal',
  receipt: 'Penerimaan',
  issue: 'Pemakaian',
  adjustment: 'Koreksi',
} as const;
const icons: Record<Movement['type'], IconName> = {
  opening: 'box',
  receipt: 'receipt',
  issue: 'issue',
  adjustment: 'settings',
};
export function StockActivity({ items, compact = false }: { items: Movement[]; compact?: boolean }) {
  return (
    <section className="panel recent-card stock-activity">
      <div className="section-head">
        <h2>Aktivitas terbaru</h2>
        <Icon name="clock" />
      </div>
      <div className="activity-scroll" tabIndex={0} role="region" aria-label="Aktivitas material terbaru">
        {!items.length ? (
          <div className="empty">
            <Icon name="clock" />
            <p>Belum ada transaksi pada lokasi Anda.</p>
          </div>
        ) : (
          items.slice(0, compact ? 3 : 8).map((m) => (
            <a
              key={m.id}
              className="activity-row stock-activity-row"
              href={`/consumables/history?movement=${encodeURIComponent(m.id)}`}
            >
              <span className={`app-icon movement-icon ${m.type}`}>
                <Icon name={icons[m.type]} />
              </span>
              <span className="stock-activity-description">
                <strong title={`${m.mmid} · ${m.description}`}>{m.description}</strong>
                <small className="stock-activity-code" title={`${m.mmid} · ${m.locationName}`}>
                  {m.mmid} · {m.locationName}
                </small>
                <small title={`${m.actorName} · ${formatDate(m.createdAt)} WIB`}>
                  {m.actorName} · {formatDate(m.createdAt)} WIB
                </small>
              </span>
              <span className="stock-activity-value">
                <strong title={`${formatQuantity(m.quantity)} ${m.unit}`}>
                  {formatQuantity(m.quantity)} <small>{m.unit}</small>
                </strong>
                <small>{movementLabels[m.type]}</small>
                {m.type === 'adjustment' && <small>Selisih saldo</small>}
              </span>
            </a>
          ))
        )}
      </div>
      <a className="stock-history-link" href="/consumables/history">
        Lihat riwayat <Icon name="arrow" />
      </a>
    </section>
  );
}
