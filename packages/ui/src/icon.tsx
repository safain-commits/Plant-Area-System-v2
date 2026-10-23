import type { SVGProps } from 'react';
const paths = {
  box: 'm3 7 9-5 9 5v10l-9 5-9-5Zm0 0 9 5 9-5m-9 5v10M7.5 4.5l9 5',
  receipt: 'M5 3h14v18l-3-2-4 2-4-2-3 2Zm4 5h6m-6 4h6',
  issue: 'M4 4h10v4M4 4v16h10v-4m-4-4h12m-4-4 4 4-4 4',
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  user: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  moon: 'M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10',
  monitor: 'M3 3h18v14H3zM8 21h8m-4-4v4',
  chevron: 'm9 5 7 7-7 7',
  collapse: 'm11 6-6 6 6 6m8-12-6 6 6 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  x: 'm6 6 12 12M6 18 18 6',
  check: 'm5 12 4 4L19 6',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  clock: 'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  plus: 'M12 4v16M4 12h16',
  calendar: 'M4 5h16v16H4zM8 2v6m8-6v6M4 11h16',
  filter: 'M3 4h18l-7 8v7l-4 2v-9Z',
  info: 'M12 11v6m0-10v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  logout: 'M10 17v4H3V3h7v4m4 1 4 4-4 4m-6-4h13',
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
