'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="narrow">
      <section className="panel">
        <h1>Layanan sementara tidak tersedia</h1>
        <p role="alert">Permintaan belum dapat diproses. Silakan coba lagi.</p>
        <button onClick={reset}>Coba lagi</button> <a href="/">Kembali ke portal</a>
      </section>
    </main>
  );
}
