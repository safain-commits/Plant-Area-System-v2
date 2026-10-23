# Plant Area System v2

Portal SSO dan aplikasi Bag Filter dengan Node.js 26, Next.js, Better Auth, MySQL 8.4, Drizzle, dan Nginx. Source aktif berada di `apps/`, `packages/`, `infra/`, dan `scripts/`. Ekspor lama tersimpan di `.arsip/` hanya pada workspace asal karena memuat data internal; folder itu tidak diterbitkan ke GitHub. Gunakan README ini dan PRD v2 sebagai acuan pengembangan saat ini.

Dokumen: [audit](docs/AUDIT.md), [PRD v2](docs/PRD-v2.md), [rencana implementasi](docs/IMPLEMENTATION-PLAN.md), [kontrak API](docs/API.md), [tema UI](docs/UI-THEME.md), [operasional](docs/OPERATIONS.md), [hasil validasi](docs/VALIDATION.md).

Ikon Tema di topbar dan form Auth membuka pilihan **Terang/Gelap/Sistem**. Default mengikuti perangkat dan pilihan tersimpan pada browser untuk seluruh aplikasi. UI refresh v2 memakai sidebar yang dapat diciutkan, dashboard data aktual, pencarian cepat (**Ctrl/Cmd+K**), notifikasi aktivitas sesuai scope, dan form pencatatan dalam sheet. Peta memakai skala umur lime–kuning–oranye–merah serta seleksi double ring tanpa mengubah warna umur. Acuan visual tersedia di [brief UI](docs/design/UI-REFRESH.md).

## Persiapan

Gunakan Node **26.12.1**, pnpm **12.14.0**, dan Docker dengan Linux containers/Compose. Instal pnpm memakai `npm install --global pnpm@12.14.0`, lalu `pnpm install --frozen-lockfile`.

Pada workspace Windows ini tersedia runtime lokal `.tools/node-v26.12.1-win-x64/node.exe` (diabaikan version control). Aktifkan untuk terminal PowerShell:

```powershell
$env:PATH = "$PWD\.tools\node-v26.12.1-win-x64;$env:PATH"
```

Jangan mengedit package di `node_modules/@plant/*`; pnpm menghubungkannya ke source workspace. Edit `packages/contracts`, `packages/auth-core`, `packages/bag-core`, `packages/server`, atau `packages/ui` secara langsung.

## Menjalankan pilot produksi

1. Salin `.env.example` menjadi `.env`. Isi `PUBLIC_ORIGIN` dengan origin HTTPS tanpa trailing slash, lima rahasia independen, dan akun bootstrap. Gunakan random hex 32 byte untuk password database/secret layanan, misalnya `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Jangan memakai nilai contoh.
2. Pasang sertifikat organisasi `infra/certs/tls.crt` dan private key `infra/certs/tls.key`. DNS hostname harus menunjuk ke server ini. Lindungi `.env`, key, dan folder backup dari akses pengguna lain.
3. Jalankan urutan berikut dari root repositori:

```sh
docker compose build
docker compose up -d mysql
docker compose run --rm migrate
docker compose --profile setup run --rm bootstrap
docker compose up -d auth portal bag-filter nginx backup
docker compose ps
```

Buka `PUBLIC_ORIGIN`. Login dengan akun bootstrap dan ganti password sementara. Akun bootstrap adalah admin portal serta admin Bag Filter untuk enam equipment (561, 562, 421, 422, L61, L62; semuanya BF1). Setelah itu buat akun dan scope melalui **Kelola akses**. Tidak ada registrasi publik atau transaksi demo yang dibuat migrasi. Untuk upgrade dari katalog empat equipment, ikuti bagian migrasi equipment di [panduan operasional](docs/OPERATIONS.md).

Hapus `BOOTSTRAP_PASSWORD` dari `.env` setelah digunakan dan simpan password baru di pengelola password organisasi. Bootstrap yang dijalankan ulang tidak mengubah akun yang sudah ada. Jangan memakai `docker compose down -v` pada deployment berisi data.

## Lingkungan uji lokal terpisah

Environment pengujian memakai project Compose **plant-v2-test**, volume sendiri, hostname localhost, HTTPS8443, serta MySQL13306 hanya pada loopback. Script uji tidak boleh diarahkan ke produksi.

```sh
node --import tsx scripts/prepare-test.ts
docker compose --env-file .test-runtime/stack.env -p plant-v2-test -f compose.yaml -f .test-runtime/compose.yaml up -d --wait mysql
node --env-file=.test-runtime/host.env --import tsx scripts/migrate.ts
node --env-file=.test-runtime/host.env --import tsx scripts/bootstrap.ts
```

Untuk sertifikat localhost, hanya pada workspace pengujian yang belum mempunyai sertifikat organisasi:

```sh
docker run --rm -v "${PWD}/infra/certs:/certs" --entrypoint openssl mysql:8.4 req -x509 -newkey rsa:2048 -nodes -keyout /certs/tls.key -out /certs/tls.crt -days 7 -subj /CN=localhost -addext subjectAltName=DNS:localhost,IP:127.0.0.1
docker compose --env-file .test-runtime/stack.env -p plant-v2-test -f compose.yaml -f .test-runtime/compose.yaml up -d --build nginx backup
```

Buka **https://localhost:8443**. Sertifikat pengujian tidak dipercaya browser secara otomatis. Kredensial bootstrap lokal ada di `.test-runtime/stack.env`; file ini diabaikan version control. Suite browser mengubah password akun pilot menjadi nilai khusus fixture di `tests/e2e/platform.spec.ts`. Untuk mengembalikan keadaan kosong, gunakan script reset hanya pada database uji lalu jalankan bootstrap lagi; ini menghapus akun dan transaksi uji.

## Pengembangan dan pemeriksaan

```sh
pnpm typecheck
pnpm test
pnpm build
node --env-file=.test-runtime/host.env --import tsx --test --test-concurrency=1 tests/integration/*.test.ts
pnpm exec playwright install chromium
pnpm test:e2e
node --env-file=.test-runtime/host.env --import tsx scripts/test-operations.ts
pnpm check:export # opsional; memeriksa arsip jika tersedia di workspace lokal
```

Tes operasi me-restart MySQL/Bag Filter, menghentikan sementara Auth, dan membuat server restore sementara pada project uji. Jangan menjalankannya saat pengujian browser masih berlangsung. Laporan browser ada di `playwright-report/`, screenshot di `test-results/`; keduanya lokal dan tidak dikomit.

`pnpm dev` menjalankan Portal3000, Auth3001, Bag Filter3002. Lingkungan development harus memasok env tiap layanan dan gateway HTTPS yang meneruskan prefix/host dengan konfigurasi setara; Compose adalah cara menjalankan SSO lengkap yang telah diuji. Script Node tidak memuat `.env` otomatis; gunakan `node --env-file=... --import tsx ...`.

Build terpisah: `pnpm --filter @plant/portal build`, `pnpm --filter @plant/auth build`, atau `pnpm --filter @plant/bag-filter build`. Dockerfile menerima `--build-arg APP=portal|auth|bag-filter`. Pembaruan satu aplikasi: build image baru, kemudian `docker compose up -d --no-deps bag-filter` (sesuaikan nama layanan). Simpan image/tag lama untuk rollback.

Kebutuhan sebelum go-live: hostname dan sertifikat organisasi, rahasia deployment, salinan backup di luar host, uji orientasi oleh operator, serta restore drill pada server tujuan.
