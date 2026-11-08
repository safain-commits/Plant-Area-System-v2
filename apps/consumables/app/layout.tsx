import type { Metadata } from 'next';
import localFont from 'next/font/local';
import '@plant/ui/styles.css';
import { brandIcon, ThemeProvider, ThemeScript } from '@plant/ui';

const inter = localFont({
  src: '../../../packages/ui/assets/fonts/InterVariable.woff2',
  variable: '--font-inter',
  display: 'swap',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'Consumable Room | TQ-CMMS',
  description: 'TQ-CMMS — Maintenance Tuban',
  robots: { index: false, follow: false },
  icons: { icon: brandIcon('/consumables') },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
