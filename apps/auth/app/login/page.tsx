import { safeReturnTo } from '@plant/contracts';
import { LoginForm } from '../forms';
import { BrandLogo, ThemeToggle } from '@plant/ui';
export const dynamic = 'force-dynamic';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <main className="auth-layout">
      <aside className="auth-story">
        <a className="brand" href="/" aria-label="TQ-CMMS — Kembali ke portal">
          <BrandLogo />
        </a>
        <div>
          <p className="eyebrow">MAINTENANCE · CONNECTED</p>
          <h1>
            Satu akses.
            <br />
            Setiap area kerja.
          </h1>
          <p>Masuk ke portal untuk membuka aplikasi maintenance sesuai tanggung jawab Anda.</p>
          <div className="auth-lines" aria-hidden="true" />
        </div>
        <small>TQ-CMMS / TUBAN OPERATIONS</small>
      </aside>
      <section className="auth-form">
        <div className="auth-form-header">
          <a className="auth-brand" href="/" aria-label="TQ-CMMS — Kembali ke portal">
            <BrandLogo />
          </a>
          <ThemeToggle />
        </div>
        <p className="eyebrow">SELAMAT DATANG</p>
        <h2>Masuk ke portal</h2>
        <p className="muted">Gunakan akun yang diberikan oleh admin.</p>
        {query.changed === '1' && (
          <p className="notice" role="status">
            Password diperbarui. Silakan masuk kembali.
          </p>
        )}
        <LoginForm returnTo={safeReturnTo(typeof query.returnTo === 'string' ? query.returnTo : '/')} />
        <p className="fine">Lupa password? Hubungi admin portal untuk reset akun.</p>
      </section>
    </main>
  );
}
