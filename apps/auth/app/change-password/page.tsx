import { pageIdentity } from '@plant/server';
import { PasswordForm } from '../forms';
import { LogoutButton } from '@plant/ui';
export const dynamic = 'force-dynamic';
export default async function ChangePassword() {
  const identity = await pageIdentity('/', true);
  return (
    <main className="narrow">
      <a href="/" className="wordmark">
        PLANT AREA / TUBAN
      </a>
      <section className="panel">
        <p className="eyebrow">KEAMANAN AKUN</p>
        <h1>{identity.mustChangePassword ? 'Buat password Anda' : 'Ganti password'}</h1>
        <p>
          {identity.mustChangePassword
            ? 'Ganti password sementara sebelum membuka aplikasi.'
            : 'Gunakan password yang hanya Anda ketahui.'}
        </p>
        <PasswordForm temporary={identity.mustChangePassword} />
      </section>
      <LogoutButton />
    </main>
  );
}
