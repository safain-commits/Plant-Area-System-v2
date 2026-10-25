import type { Metadata } from 'next';
import '@plant/ui/styles.css';
import { brandIcon, ThemeProvider, ThemeScript } from '@plant/ui';
export const metadata: Metadata = {
  title: 'Bag Filter | TQ-CMMS',
  description: 'TQ-CMMS — Maintenance Tuban',
  robots: { index: false, follow: false },
  icons: { icon: brandIcon('/bag-filter') },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
