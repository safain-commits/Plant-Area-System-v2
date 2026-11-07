import { Icon, type IconName } from './icon';
export function ApplicationSummary({
  className = '',
  title,
  icon,
  href,
  metrics,
  readOnly,
  children,
}: {
  className?: string;
  title: string;
  icon: IconName;
  href: string;
  metrics: readonly (readonly [string, number])[];
  readOnly?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`panel application-summary ${className}`} aria-label={`Ringkasan ${title}`}>
      <div className="section-head">
        <h2>
          <Icon name={icon} />
          {title}
        </h2>
        {readOnly && <span className="badge neutral">Hanya lihat</span>}
      </div>
      <dl className="summary-metrics">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value.toLocaleString('id-ID')}</dd>
          </div>
        ))}
      </dl>
      <div className="summary-recent">
        <h3>Aktivitas terbaru</h3>
        {children}
      </div>
      <a className="summary-open" href={href}>
        Buka {title}
        <Icon name="arrow" />
      </a>
    </section>
  );
}
