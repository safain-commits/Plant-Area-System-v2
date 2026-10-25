# Pengembangan lokal sampai pembaruan VPS

Alur setelah go-live `tq-cmms.com`, berdasarkan konfirmasi pemilik pada 25 Oktober 2026:

```text
Development lokal terisolasi → branch fitur → pengujian → push/PR
→ merge main → CI commit rilis lulus → OpenClaw deploy SHA tertentu
→ pemeriksaan produksi → penerimaan pemilik
```

**Pembaruan membawa kode dan migrasi yang direview. Database VPS tetap menjadi sumber data produksi.** Dump laptop dari migrasi awal tidak diunggah ulang untuk memperbarui fitur.

Tooling development lokal tersedia melalui `scripts/dev.ts` dan perintah `pnpm dev:*`; runtime telah diverifikasi pada PC Windows pada 25 Oktober 2026. Pekerjaan ini tidak mengubah VPS. Panduan eksekusi server tetap [runbook VPS bagian 15](VPS-TQ-CMMS.md#15-upgrade-dan-rollback).

## 1. Pisahkan lingkungan lebih dahulu

| Lingkungan                                                  | Tujuan                              | Aturan                                                                |
| ----------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------- |
| VPS `/opt/tq-cmms`, project `tq-cmms`                       | Produksi                            | Data operasional dan akun aktual; akses melalui domain produksi       |
| Source di workspace PC `plant-area-system` saat ini         | Pengembangan kode                   | Tetap digunakan; tidak perlu clone kedua di PC                        |
| Container/volume lama project `plant-v2-test` di PC         | Arsip sumber migrasi                | Data nyata dipertahankan; aplikasi tetap berhenti dan MySQL baca saja |
| Runtime development `plant-v2-dev` di PC                    | Pengujian fitur lokal               | Container, volume, database, port dan rahasia sendiri                 |
| Workspace MacBook, misalnya `~/Developer/plant-area-system` | Pengembangan kode dan runtime lokal | Clone GitHub; dependency, konfigurasi dan database Mac sendiri        |
| GitHub Actions                                              | Validasi otomatis                   | Runner dan database uji terpisah; fixture sintetis                    |

Sesuai pilihan pemilik, **folder PC saat ini tetap workspace aktif**. Yang dibekukan adalah container/database sumber migrasi, bukan source code Git. Mengedit source, menjalankan typecheck/unit/build, dan commit tetap dapat dilakukan di folder yang sama.

Pemisahan folder bukan syarat utama isolasi Docker. Nama project yang sama pada Docker Engine yang sama dapat memakai container/volume yang sama. Runtime development pada PC harus memakai identitas Compose yang berbeda dari arsip `plant-v2-test`. Pastikan Docker context menunjuk engine lokal perangkat, bukan engine VPS.

Konfigurasi development lokal:

- Project Compose: `plant-v2-dev`; volume database baru `plant-v2-dev_mysql-data`.
- Gateway: `https://localhost:9443`, HTTP loopback `9080`, MySQL loopback `14306` bila akses dari host diperlukan.
- Semua binding host hanya `127.0.0.1`; `PUBLIC_ORIGIN=https://localhost:9443`.
- Rahasia/override lokal dalam `.deploy/dev/` yang sudah diabaikan Git/Docker; tag image development sendiri, misalnya `dev`.
- Sertifikat localhost development dalam `.deploy/dev/certs/`, terpisah dari certificate/source deployment lama.
- Mulai dengan data sintetis. Jika debugging memerlukan data perusahaan, gunakan salinan yang telah disamarkan dan tetap privat; kredensial produksi tidak dipakai untuk development.

Jalankan `pnpm dev:setup`, lalu `pnpm dev:up` dari root workspace dengan Docker lokal aktif. Setup memvalidasi identitas project, volume dan binding loopback; membuat rahasia/certificate sendiri; serta menolak context remote atau resource existing tanpa profil yang sesuai. `dev:up` membangun tools, memigrasikan database baru, menjalankan bootstrap idempoten, dan menyalakan empat app serta gateway. Setup ulang mempertahankan credential/certificate.

URL browser: **https://localhost:9443**. Certificate self-signed belum dipercaya OS/browser, sehingga peringatan certificate dapat muncul. Email awal `developer@example.test`; password sementara tersimpan privat sebagai `BOOTSTRAP_PASSWORD` pada `.deploy/dev/stack.env` dan wajib diganti. Pada PC yang telah diverifikasi, password development setelah uji awal ada di `.deploy/dev/login.env`. Lihat `.deploy/dev/DEV-HANDOVER.md`; jangan commit file rahasia atau memakai password produksi. Jika password diganti lagi, gunakan password terbaru.

`pnpm dev:status` memeriksa container, `pnpm dev:logs` menampilkan log, dan `pnpm dev:down` menghentikan runtime tanpa menghapus volume. Development dimulai tanpa master perusahaan, pemasangan bag atau transaksi stok. Runtime Mac belum diuji; gunakan prompt MacBook untuk verifikasi native pada perangkat tersebut.

PC dan Mac dapat memakai nama project/port development yang sama apabila masing-masing memakai Docker Engine lokalnya sendiri. Volume di PC tidak menjadi volume Mac dan data development tidak otomatis tersinkron.

### Batas script uji saat ini

`scripts/prepare-test.ts`, `scripts/test-operations.ts`, `scripts/test-gateway-recovery.ts`, serta sebagian integration test masih mengasumsikan `plant-v2-test`, MySQL `13306` atau HTTPS `8443`. Project tersebut pada PC sumber sudah menjadi arsip data nyata; MySQL lama masih memakai port `13306`.

Jangan menjalankan script tersebut dari clone baru pada Docker Engine laptop yang sama hanya karena direktori berbeda. Jangan menyalin `.test-runtime` lama atau menghapus penanda `REAL-DATA-PRESENT.json` untuk meloloskan guard.

Untuk menjalankan seluruh suite lokal dengan identitas baru, script dan guard perlu dibuat dapat dikonfigurasi secara konsisten, lalu diuji isolasinya. Sampai pekerjaan itu selesai, jalankan pengujian integrasi/E2E/operasional lengkap melalui CI pada runner terpisah. Pemeriksaan unit, typecheck dan build yang tidak membutuhkan database tetap dapat dilakukan lokal.

`pnpm dev:up` menjalankan empat Next.js development server melalui gateway HTTPS dengan prefix/origin yang sama. Source app dan package bersama dipasang sebagai bind mount baca saja, sedangkan dependency Linux tetap di image. Hot reload app dan UI bersama telah diuji. Setelah perubahan dependency, konfigurasi build yang tidak terpasang, atau migrasi, jalankan `dev:up` lagi. Perintah lama `pnpm dev` menjalankan app pada host port `3000`–`3003` dan tetap memerlukan pengaturan environment/gateway manual.

## 2. Kerjakan satu perubahan pada branch fitur

Mulai dari `main` terbaru pada checkout development, lalu gunakan branch seperti `feat/consumables-export` atau `fix/bag-tooltip`. Untuk satu pekerjaan, kumpulkan implementasi, migrasi bila diperlukan, pengujian yang relevan, serta dokumentasi dalam perubahan yang dapat direview.

Edit source di `apps/` dan `packages/`; jangan mengedit symlink package di `node_modules/@plant/*`. Gunakan versi Node.js 26.12.1 dan pnpm 12.14.0 yang dipin repository. Instal dependency dengan lockfile; perubahan versi dependency dilakukan sebagai perubahan yang disengaja.

### Menyiapkan workspace MacBook pertama kali

Untuk menyerahkan setup lengkap ke Claude Code, gunakan [prompt workspace development MacBook](CLAUDE-CODE-MACBOOK.md). Prompt mencakup clone, runtime native, database development terisolasi, SSO HTTPS, hot reload, pengujian dan handover. Perintah di bawah adalah persiapan awal bila dilakukan manual.

Pasang Git, Node.js 26.12.1 sesuai arsitektur Mac, dan Docker dengan Linux containers serta Compose. Jalankan perintah berikut di Mac, bukan pada terminal PC:

```sh
mkdir -p "$HOME/Developer"
cd "$HOME/Developer"
git clone https://github.com/safain-commits/Plant-Area-System-v2.git plant-area-system
cd plant-area-system
npm install --global pnpm@12.14.0
pnpm install --frozen-lockfile
```

Pastikan Node yang aktif sesuai `.node-version` sebelum instalasi dependency. Atur identitas Git dan autentikasi push GitHub pada Mac melalui SSH atau credential manager; jangan menaruh token dalam URL repository atau file project. Path workspace Mac boleh disesuaikan.

Clone membawa source dan lockfile. Generate environment, sertifikat localhost dan database development Mac secara terpisah. `.tools` PC berisi binary Windows; `node_modules` PC, volume MySQL, `.test-runtime`, `.deploy`, `.env`, `.arsip`, workbook internal dan recovery key tidak disalin sebagai paket workspace Mac. Jika ada kebutuhan recovery/impor khusus, penyerahannya dilakukan sebagai pekerjaan privat tersendiri.

Panduan atau script baru yang masih hanya ada di working tree PC harus di-commit/push sebelum tersedia melalui clone Mac. Menulis panduan ini belum membuat workspace atau runtime Mac.

### Berpindah PC → Mac → PC

GitHub menjadi tempat sinkronisasi **kode yang sudah di-commit**. Perubahan editor yang belum di-commit, database lokal, akun development, sesi browser dan konfigurasi ignored tidak ikut `push`/`pull`.

1. Sebelum pindah perangkat, simpan dan commit file terkait pekerjaan pada branch fitur, lalu push branch tersebut. Commit checkpoint pada branch fitur boleh dipakai untuk melanjutkan pekerjaan yang belum siap rilis; jangan merge ke `main` sampai pemeriksaan rilis lulus.
2. Di perangkat tujuan, pastikan perubahan lokal sudah disimpan/di-commit. Fetch GitHub dan lanjutkan branch fitur yang sama.
3. Setelah pull, sesuaikan dependency dengan lockfile. Jika ada migrasi, terapkan pada database development perangkat itu memakai konfigurasi development; jangan mengarahkan URL ke VPS atau arsip sumber.
4. Setelah selesai bekerja, commit/push lagi. Perangkat satunya mengambil commit tersebut sebelum melanjutkan.

Contoh branch yang telah di-commit pada PC dan siap dibawa ke Mac:

```sh
git push -u origin feat/consumables-export
```

Pada Mac, **pertama kali** ketika branch itu belum ada secara lokal:

```sh
git fetch origin
git switch --track origin/feat/consumables-export
git pull --ff-only
pnpm install --frozen-lockfile
```

Pada perpindahan berikutnya, ketika branch lokal sudah ada, baik PC maupun Mac:

```sh
git status
git switch feat/consumables-export
git pull --ff-only
pnpm install --frozen-lockfile
```

Nama branch contoh disesuaikan dengan pekerjaan. Jangan melanjutkan switch/pull bila masih ada perubahan lokal yang belum diamankan. `--ff-only` berhenti jika kedua perangkat membuat riwayat yang berbeda; review dan integrasikan commit, bukan memaksa salah satunya dengan force push atau reset.

Untuk satu fitur, kerjakan branch tersebut secara bergantian pada satu perangkat aktif. Untuk dua pekerjaan paralel, gunakan dua branch berbeda dan gabungkan melalui PR. Workspace kode tidak disinkronkan melalui OneDrive; OneDrive `backup-vps` tetap untuk backup offsite yang terenkripsi.

## 3. Verifikasi sebelum rilis

Pemeriksaan dasar dari checkout development:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

Tambahkan pemeriksaan sesuai perubahan: UI pada tema terang/gelap dan desktop/mobile; API pada izin/scope serta idempotensi; perubahan database pada migrasi dari schema lama dan pemeliharaan data existing. Gunakan database uji terpisah, bukan koneksi produksi atau arsip sumber.

Commit/push branch, lalu buka PR ke `main`. Review perilaku, risiko data, kebutuhan environment dan prosedur rollback sebelum merge. Setelah merge, verifikasi CI **SHA pada main yang akan dirilis**, bukan hanya hasil branch sebelum merge.

Workflow `.github/workflows/ci.yml` saat diperiksa mencakup typecheck, unit, integrasi MySQL, build container, browser, operasi backup/restore dan gateway recovery. **Workflow ini belum mempunyai job deployment VPS.** Push/merge tidak mengirim kode ke server melalui workflow tersebut; deploy dilakukan OpenClaw atau automation server terpisah yang memang telah dipasang.

## 4. Bedakan jenis pembaruan

| Jenis perubahan                                       | Yang dibawa ke VPS                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| UI satu aplikasi                                      | Source/image aplikasi terkait; periksa dependensi shared                                   |
| `packages/ui`, kontrak, server guard atau autentikasi | Rilis aplikasi yang terdampak secara serempak; default awal memperbarui keempat app        |
| Struktur database                                     | File migrasi baru beserta metadata/checkpoint yang diperlukan; uji pada data existing      |
| Konfigurasi/environment                               | Tambahan atau perubahan variabel yang disebutkan eksplisit; rahasia existing dipertahankan |
| Nginx/Compose                                         | Konfigurasi yang direview, tetap memakai override VPS dan pin MySQL existing               |

Perubahan schema dilakukan melalui migrasi baru pada database produksi existing. Jangan mengedit migrasi awal yang sudah pernah diterapkan atau memakai `drizzle-kit push` untuk mengganti proses rilis produksi. Perubahan destruktif seperti penghapusan/rename kolom memerlukan strategi kompatibilitas dan migrasi data tersendiri.

Default rilis awal adalah memperbarui kelima image `migrate`, `auth`, `portal`, `bag-filter`, dan `consumables` secara serial sesuai runbook. Build satu aplikasi saja dapat dipakai setelah cakupan dependensi dan kompatibilitasnya dipastikan. Jangan menaikkan versi MySQL atau mengganti volume sebagai bagian pembaruan UI biasa.

## 5. OpenClaw memperbarui VPS berdasarkan full SHA

Berikan full commit SHA yang CI-nya lulus, ringkasan perubahan, kebutuhan migrasi/environment, cakupan aplikasi, dan waktu maintenance. Langkah deployment mengikuti runbook:

1. Periksa release aktif, kapasitas, image/tag rollback, working tree VPS serta status backup/offsite. Jika ada perbaikan source yang dibuat OpenClaw langsung di VPS, review dan bawa kembali ke GitHub terlebih dahulu; rahasia dan konfigurasi privat tetap lokal server.
2. Aktifkan maintenance khusus domain dan hentikan layanan aplikasi project agar pencatatan berhenti. MySQL serta volume data dipertahankan. Nginx host dan website lain tetap berjalan.
3. Buat backup tiga database sebelum perubahan; verifikasi gzip/checksum serta salinan terenkripsi ke offsite yang sudah disetujui. Simpan konfigurasi privat dan catat release sebelumnya.
4. Fetch GitHub dan checkout full SHA target yang disetujui. Perbarui `RELEASE_TAG` untuk image baru tanpa menimpa variabel rahasia lain.
5. Gunakan fungsi `dc` produksi dengan `compose.yaml`, `infra/deploy/compose.vps.yaml`, dan `.deploy/compose.mysql-pin.yaml` bila ada. Build image serial sesuai cakupan rilis dan budget RAM/disk VPS.
6. Jika rilis membutuhkan migrasi, jalankan job migrator baru secara terkontrol. Cek hasil/checkpoint dan rekonsiliasi Consumables. Jangan menjalankan bootstrap atau mengimpor ulang dump/master laptop. Untuk rilis tanpa perubahan migrasi/checkpoint, tidak perlu membuat operasi data tambahan hanya untuk mengganti UI.
7. Start Auth, lalu app yang diperbarui dan gateway/backup secara berurutan dengan `--no-deps`. Periksa readiness, backend HTTPS yang tervalidasi dan data sebelum membuka maintenance.
8. Buka maintenance untuk QA publik dan penerimaan pemilik. Periksa login existing, SSO, scope, halaman/aset/API, fitur yang berubah, serta website lama. Simpan bukti hasil aktual dan SHA aktif.

VPS saat ini membangun image sendiri; build dapat memperpanjang maintenance. Pendekatan berikutnya dapat memindahkan build ke CI dan registry, lalu VPS hanya menarik image rilis. Pipeline itu belum tersedia dalam repository ini.

## 6. Jika pembaruan gagal

Jika belum ada migrasi atau schema tetap kompatibel, kembalikan image/kode ke SHA sebelumnya memakai konfigurasi dan volume data existing. Jangan menjalankan down migration otomatis.

Jika schema atau data tidak lagi kompatibel, aktifkan maintenance, simpan backup keadaan terbaru, lalu pilih perbaikan lanjutan atau restore terencana ke target terpisah. Restore backup lama dapat menghilangkan transaksi yang dibuat setelah backup; transaksi tersebut harus dipertahankan/direkonsiliasi. Rollback aplikasi tidak selalu berarti rollback database.

Arsip database laptop tetap bukan tujuan rollback produksi setelah VPS menerima transaksi baru.

## 7. Prompt update untuk OpenClaw

Ganti placeholder sebelum mengirim. Ini mandat pembaruan berikutnya, bukan pengulangan instalasi/restore awal.

```text
Perbarui deployment tq-cmms.com ke full commit SHA: <FULL_SHA_YANG_CI_NYA_LULUS>.
Ringkasan perubahan: <RINGKASAN>.
Cakupan aplikasi/shared package: <CAKUPAN>.
Migrasi database/checkpoint: <TIDAK_ADA_ATAU_DAFTAR>.
Perubahan environment: <TIDAK_ADA_ATAU_NAMA_VARIABEL_TANPA_SECRET>.
Waktu maintenance: <JENDELA_YANG_DISETUJUI>.

Ikuti docs/deployment/VPS-TQ-CMMS.md bagian upgrade/rollback dan
docs/deployment/DEVELOPMENT-TO-VPS.md. Verifikasi CI SHA target, kondisi
working tree VPS, release aktif serta image rollback sebelum perubahan.

Pertahankan tiga database produksi, volume existing, akun/password/grant,
konfigurasi domain/TLS, rahasia, pin MySQL, serta offsite OneDrive yang aktif.
Backup sebelum perubahan dan verifikasi salinan offsite terenkripsi.
Jangan menjalankan bootstrap, reset, impor master atau restore dump laptop.

Terapkan maintenance khusus project, fetch/checkout SHA target, ubah hanya
release/env yang memang diperlukan, build serial, migrasi bila diperlukan,
dan start terkontrol sesuai cakupan. Tidak melakukan git reset --hard untuk
menutupi perubahan server yang belum direview atau cleanup volume global.

Verifikasi backend sebelum membuka maintenance, lalu QA publik dan
penerimaan fitur oleh pemilik. Jika gagal, pertahankan data terbaru dan
ikuti rollback kompatibel. Jangan menimpa database dengan backup lama
tanpa rekonsiliasi transaksi setelah backup.

Laporkan SHA sebelum/sesudah, migrasi, backup/offsite, health, downtime,
hasil QA/SSO/fitur, serta langkah rollback. Jangan mencetak rahasia.
```

## 8. Pemeriksaan dan referensi

Panduan disesuaikan dengan `compose.yaml`, script pengujian, `package.json`, dan workflow CI repository. Rancangan development baru, automatic deployment, serta pembaruan VPS tidak dijalankan pada pekerjaan dokumentasi ini. Source migrasi lokal tetap beku.

Dokumentasi diperiksa melalui Context7:

- [Docker Compose — project name dan scope resource](https://docs.docker.com/compose/how-tos/project-name/).
- [Docker Compose — pembaruan container dan volume](https://docs.docker.com/reference/cli/docker/compose/up/).
- [GitHub Actions — continuous deployment perlu workflow deployment](https://docs.github.com/en/actions/get-started/continuous-deployment).
- [Git — pull fast-forward dan penanganan riwayat yang berbeda](https://git-scm.com/docs/git-pull).

Dokumen pendamping: [runbook VPS](VPS-TQ-CMMS.md), [operasional](../OPERATIONS.md), [panduan pemindahan awal database](DATABASE-LOCAL-TO-VPS.md).
