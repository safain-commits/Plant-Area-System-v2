import type { Metadata } from 'next';
import '@plant/ui/styles.css';
export const metadata: Metadata = {
  title: 'Portal | Plant Area System',
  description: 'Maintenance Tuban ? Plant Area System',
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
