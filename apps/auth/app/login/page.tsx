import { safeReturnTo } from '@plant/contracts';
import { LoginForm } from '../forms';
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
        <a className="brand" href="/">
          P
          <span>
            PLANT AREA
            <br />
            <small>TUBAN OPERATIONS</small>
          </span>
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
        <small>PLANT AREA SYSTEM / INTERNAL</small>
      </aside>
      <section className="auth-form">
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
