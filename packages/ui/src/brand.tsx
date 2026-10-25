import { brandRevision, compactArtwork, fullArtwork } from './brand-artwork';

/** Decorative artwork; the containing link provides its accessible name. */
export function BrandLogo({ compact = false }: { compact?: boolean }) {
  const artwork = compact ? compactArtwork : fullArtwork;
  return (
    <svg
      className={`brand-logo${compact ? ' brand-logo-compact' : ''}`}
      viewBox={artwork.viewBox}
      width={compact ? 44 : 200}
      height={44}
      aria-hidden="true"
      focusable="false"
      data-brand={compact ? 'compact' : 'full'}
    >
      {artwork.paths.map((path, i) => (
        <path
          key={i}
          d={path.d}
          fillRule={path.rule}
          className={path.accent ? 'brand-logo-accent' : 'brand-logo-ink'}
        />
      ))}
    </svg>
  );
}

/** Explicit prefix keeps each zone's favicon on its own public asset route. */
export const brandIcon = (basePath = '') => ({
  url: `${basePath}/favicon.svg?v=${brandRevision}`,
  type: 'image/svg+xml',
  sizes: 'any',
});
