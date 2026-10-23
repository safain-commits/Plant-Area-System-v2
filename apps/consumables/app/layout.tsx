import type { Metadata } from 'next';
import '@plant/ui/styles.css';
import { ThemeProvider, ThemeScript } from '@plant/ui';
export const metadata: Metadata = {
  title: 'Consumable Room | Plant Area System',
  description: 'Maintenance Tuban · Plant Area System',
  robots: { index: false, follow: false },
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
