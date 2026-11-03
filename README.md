# Plant Area System v2

Portal SSO, Bag Filter, dan Consumable Room dengan Node.js 26, Next.js, Better Auth, MySQL 8.4, Drizzle, dan Nginx. Source aktif berada di `apps/`, `packages/`, `infra/`, dan `scripts/`. Ekspor lama tersimpan di `.arsip/` hanya pada workspace asal karena memuat data internal; folder itu tidak diterbitkan ke GitHub. Gunakan README ini dan PRD v2 sebagai acuan pengembangan saat ini.

Dokumen: [audit](docs/AUDIT.md), [PRD v2](docs/PRD-v2.md), [rencana implementasi](docs/IMPLEMENTATION-PLAN.md), [kontrak API](docs/API.md), [tema UI](docs/UI-THEME.md), [operasional](docs/OPERATIONS.md), [hasil validasi](docs/VALIDATION.md).

Deployment VPS `tq-cmms.com` dengan **Nginx host yang sudah ada**: gunakan [runbook VPS](docs/deployment/VPS-TQ-CMMS.md) dan [handover OpenClaw](docs/deployment/OPENCLAW-HANDOVER.md). Runbook memakai override khusus agar gateway Docker hanya membuka port loopback dan tidak berebut port 80/443 dengan website lain.

Untuk membawa data aktual Docker lokal, gunakan [panduan migrasi/backup restore](docs/deployment/DATABASE-LOCAL-TO-VPS.md) dan [prompt OpenClaw khusus database](docs/deployment/OPENCLAW-DATABASE-HANDOVER.md). Restore mempertahankan ketiga database, akun dan izin; jalur ini tidak memakai bootstrap atau impor master ulang.

Setelah VPS live, gunakan [alur pengembangan PC/Mac sampai pembaruan VPS](docs/deployment/DEVELOPMENT-TO-VPS.md). Folder `plant-area-system` pada PC tetap workspace aktif; Mac memakai clone GitHub sendiri. Runtime/database development dipisahkan dari arsip sumber migrasi dan produksi. Fitur dirilis melalui GitHub dan SHA yang lolos CI; workflow CI saat ini belum mempunyai job deploy otomatis.

Setup MacBook dapat diserahkan kepada Claude Code memakai [prompt development MacBook](docs/deployment/CLAUDE-CODE-MACBOOK.md), termasuk environment lokal, SSO HTTPS, hot reload dan verifikasi.

Ikon Tema di topbar dan form Auth membuka pilihan **Terang/Gelap/Sistem**. Default mengikuti perangkat dan pilihan tersimpan pada browser untuk seluruh aplikasi. UI refresh v2 memakai sidebar yang dapat diciutkan, dashboard data aktual, pencarian cepat (**Ctrl/Cmd+K**), notifikasi aktivitas sesuai scope, dan form pencatatan dalam sheet. Peta memakai skala umur lime–kuning–oranye–merah serta seleksi double ring tanpa mengubah warna umur. Acuan visual tersedia di [brief UI](docs/design/UI-REFRESH.md).

## Persiapan

Gunakan Node **26.12.1**, pnpm **12.14.0**, dan Docker dengan Linux containers/Compose. Instal pnpm memakai `npm install --global pnpm@12.14.0`, lalu `pnpm install --frozen-lockfile`.

Pada workspace Windows ini tersedia runtime lokal `.tools/node-v26.12.1-win-x64/node.exe` (diabaikan version control). Launcher pnpm milik NVM dapat menghasilkan `error: CommandNotFound` jika pnpm belum tersedia pada versi Node yang aktif. Workspace ini menyediakan aktivasi Node/pnpm sendiri; jalankan pada setiap terminal PowerShell baru:

```powershell
. .\scripts\activate-dev.ps1
node --version
pnpm --version
```

Hasilnya harus Node `v26.12.1` dan pnpm `12.14.0`. Jika pnpm lokal belum terpasang, instal sekali dengan runtime lokal lalu ulangi aktivasi:

```powershell
& .\.tools\node-v26.12.1-win-x64\node.exe .\.tools\node-v26.12.1-win-x64\node_modules\npm\bin\npm-cli.js install --global --prefix .tools/pnpm pnpm@12.14.0 --allow-scripts=pnpm
. .\scripts\activate-dev.ps1
```

Aktivasi hanya mengubah PATH terminal tersebut dan mendahulukan runtime project; instalasi Node/NVM global tetap dapat dipakai oleh project lain.

Jangan mengedit package di `node_modules/@plant/*`; pnpm menghubungkannya ke source workspace. Edit `packages/contracts`, `packages/auth-core`, `packages/bag-core`, `packages/consumables-core`, `packages/server`, atau `packages/ui` secara langsung.

## Menjalankan pilot produksi

1. Salin `.env.example` menjadi `.env`. Isi `PUBLIC_ORIGIN` dengan origin HTTPS tanpa trailing slash, enam rahasia independen, dan akun bootstrap. Gunakan random hex 32 byte untuk password database/secret layanan, misalnya `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Jangan memakai nilai contoh.
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

Buka `PUBLIC_ORIGIN`. Login dengan akun bootstrap dan ganti password sementara. Akun bootstrap adalah admin portal, admin Consumable Room untuk seluruh lokasi, serta admin Bag Filter untuk enam equipment (561, 562, 421, 422, L61, L62; semuanya BF1). Setelah itu buat akun dan scope melalui **Kelola akses**. Tidak ada registrasi publik atau transaksi demo yang dibuat migrasi. Untuk upgrade dari katalog empat equipment, ikuti bagian migrasi equipment di [panduan operasional](docs/OPERATIONS.md).

Hapus `BOOTSTRAP_PASSWORD` dari `.env` setelah digunakan dan simpan password baru di pengelola password organisasi. Bootstrap yang dijalankan ulang tidak mengubah akun yang sudah ada. Jangan memakai `docker compose down -v` pada deployment berisi data.

## Development lokal PC/Mac

Dengan Node/pnpm yang dipin dan Docker Engine lokal aktif, jalankan dari root workspace:

Khusus PowerShell pada PC ini, aktifkan terminal terlebih dahulu dengan `. .\scripts\activate-dev.ps1`.

```sh
pnpm dev:setup
pnpm dev:up
pnpm dev:status
pnpm dev:smoke
```

Buka **https://localhost:9443**. Sertifikat localhost bersifat self-signed dan belum dipercaya browser/OS; browser dapat menampilkan peringatan sertifikat. Login awal memakai email `developer@example.test` dan `BOOTSTRAP_PASSWORD` dalam `.deploy/dev/stack.env`, lalu wajib mengganti password. Setelah `pnpm dev:smoke` atau verifikasi awal dijalankan pada perangkat tersebut, kredensial development terakhir tersedia secara privat dalam `.deploy/dev/login.env`; lihat juga `.deploy/dev/DEV-HANDOVER.md`. Gunakan password terbaru Anda setelah menggantinya lagi.

Runtime `plant-v2-dev` memakai volume baru, kredensial sendiri dan binding loopback: HTTPS9443, HTTP9080 serta MySQL14306. Tidak memakai akun/data VPS atau database arsip `plant-v2-test`. Data awal kosong, selain admin, katalog aplikasi dan konfigurasi enam equipment. Seluruh rahasia/sertifikat/generated override berada di `.deploy/dev/`, diabaikan Git/Docker.

Source `apps/*/app` dan `packages/*/src` mendukung hot reload. Perubahan dependency atau migrasi memerlukan `pnpm dev:up` untuk membangun ulang tools dan menjalankan migrator. `pnpm dev:down` menghentikan runtime tanpa menghapus volume; `pnpm dev:logs` menampilkan log terakhir; `pnpm dev:smoke` memverifikasi SSO, keenam peta Bag Filter, Consumable Room, WebSocket HMR (`/…/_next/hmr`), tema, dan mobile khusus terhadap `plant-v2-dev`. Setup ulang mempertahankan kredensial dan sertifikat. Script menolak Docker context remote; tidak memasang trust certificate ke OS. Runtime telah diuji baik pada PC Windows (`x86_64`) maupun MacBook Apple Silicon (`arm64`).

Suite integration/E2E/operasi lama masih khusus lingkungan uji disposable di bawah; jangan menjalankannya terhadap database development atau arsip nyata.

## Lingkungan uji lokal terpisah

**Khusus PC sumber migrasi:** project `plant-v2-test` lama berisi data nyata dan tetap dibekukan sesudah cutover. Jangan menjalankan blok di bawah pada Docker Engine yang masih mempunyai project tersebut, termasuk dari clone lain: nama project dan sebagian port/nama container masih tetap dalam script uji. Development boleh memakai workspace saat ini, dengan runtime project, volume, port, sertifikat dan kredensial baru sesuai panduan di atas. Suite lengkap dapat berjalan pada runner CI terpisah.

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
node --env-file=.test-runtime/host.env --import tsx scripts/test-gateway-recovery.ts
pnpm check:export # opsional; memeriksa arsip jika tersedia di workspace lokal
```

Tes operasi me-restart MySQL/Bag Filter/Consumable Room, menghentikan sementara Auth, dan membuat server restore sementara pada project uji. Jangan menjalankannya saat pengujian browser masih berlangsung. Laporan browser ada di `playwright-report/`, screenshot di `test-results/`; keduanya lokal dan tidak dikomit.

`pnpm dev` menjalankan Portal3000, Auth3001, Bag Filter3002, dan Consumables3003. Lingkungan development harus memasok env tiap layanan dan gateway HTTPS yang meneruskan prefix/host dengan konfigurasi setara; Compose adalah cara menjalankan SSO lengkap yang telah diuji. Script Node tidak memuat `.env` otomatis; gunakan `node --env-file=... --import tsx ...`.

Build terpisah: `pnpm --filter @plant/portal build`, `pnpm --filter @plant/auth build`, `pnpm --filter @plant/bag-filter build`, atau `pnpm --filter @plant/consumables build`. Dockerfile menerima `--build-arg APP=portal|auth|bag-filter|consumables`. Pembaruan satu aplikasi: build image baru, kemudian `docker compose up -d --no-deps bag-filter` (sesuaikan nama layanan). Pada VPS gunakan fungsi `dc` dan override produksi sesuai runbook. Simpan image/tag lama untuk rollback.

Kebutuhan sebelum go-live: hostname dan sertifikat organisasi, rahasia deployment, salinan backup di luar host, uji orientasi oleh operator, serta restore drill pada server tujuan.

## Consumable Room v1.1 — R22

Satu stok R22 pada `/consumables`, tanpa pengelolaan lokasi. Rak tetap opsional. Consume/Return memakai HEC wajib dan keranjang multi-item persisten; Penerimaan Picklist mendukung konversi SAP → satuan terkecil R22 serta bukti cetak bernomor. Role Viewer, Client, R22 Cashier dan Admin mengatur tindakan; semua grant melihat stok/riwayat yang sama.

Mulai dari [PRD R22](docs/CONSUMABLE-ROOM-PRD.md), [kontrak API](docs/API.md), serta [upgrade R22 dan handover OpenClaw](docs/deployment/R22-UPGRADE.md). Migrasi aditif `0002`/`0003` mempertahankan master dan history. Preflight menolak data yang perlu digabungkan; tidak mereset database. Produksi harus diperbarui melalui SHA teruji dan checkpoint backup/maintenance.

```sh
pnpm consumables:preflight
pnpm consumables:import-naming /private/naming.csv --dry-run
pnpm consumables:import-naming /private/naming.csv --apply
pnpm consumables:reconcile
```

CSV penamaan, katalog, PPTX dan dump perusahaan tetap privat di luar Git/image. Impor master tidak membawa saldo SAP. Saldo R22 dikonfirmasi melalui hitung fisik; detail format CSV dan aturan replay ada di runbook R22.
