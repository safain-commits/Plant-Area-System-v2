# Prompt Claude Code — setup development MacBook

Salin seluruh blok prompt berikut ke Claude Code pada MacBook. Claude Code dapat memulainya dari direktori home; workspace belum harus ada. Hasil yang diminta adalah lingkungan development lokal yang berjalan dan dapat diuji, beserta tooling yang bisa digunakan kembali pada PC.

Ini mandat setup development. Produksi `https://tq-cmms.com` sudah live menurut pemilik; task ini tidak memberikan akses atau mandat perubahan VPS.

## Prompt siap salin

```text
Aku ingin kamu menyiapkan workspace development Plant Area System v2 di
MacBook ini sampai Portal, Auth, Bag Filter, dan Consumable Room dapat
digunakan melalui browser lokal. Selesaikan implementasi dan verifikasinya;
jangan berhenti pada rencana atau hanya berhasil menjalankan satu aplikasi.

Repository:
https://github.com/safain-commits/Plant-Area-System-v2.git

Default workspace Mac:
~/Developer/plant-area-system

Konteks:
- Aku juga mengembangkan kode pada workspace plant-area-system di PC Windows.
- GitHub menyinkronkan kode yang sudah di-commit. Environment, dependency,
  database, akun development dan sesi browser masing-masing perangkat terpisah.
- Produksi sudah berjalan pada tq-cmms.com. Database VPS adalah sumber data
  produksi dan tidak boleh disentuh task ini.
- Project Docker lama plant-v2-test pada PC menyimpan arsip data nyata dan
  dibekukan. Jangan membuat tooling yang dapat mengaktifkan, mereset atau
  menulis ke project tersebut ketika kelak dijalankan pada PC.
- Tidak perlu mengambil .env, dump SQL, Excel, arsip internal, node_modules,
  binary Windows atau recovery key dari PC/OneDrive/VPS.

1. Periksa Mac dan workspace

Deteksi macOS, arsitektur arm64/x86_64, Git, Node, package manager, Docker,
Compose, Docker context, port serta kapasitas yang tersedia. Docker context
harus menuju engine lokal Mac, bukan daemon/SSH/context VPS.

Jika workspace belum ada, clone repository ke default path di atas. Jika
sudah ada, periksa remote, branch, commit dan working tree; jangan overwrite,
clone menimpa folder existing, force checkout atau reset perubahan lokal.
Ikuti instruksi AGENTS.md/CLAUDE.md yang berlaku bila ada.

Sesudah clone, baca paling sedikit:
- README.md dan docs/deployment/DEVELOPMENT-TO-VPS.md
- package.json, pnpm-workspace.yaml, pnpm-lock.yaml dan .node-version
- compose.yaml, infra/Dockerfile, infra/nginx/* dan next.config.ts tiap app
- scripts/migrate.ts, scripts/bootstrap.ts dan scripts/prepare-test.ts
- playwright.config.ts serta guard script integration/operations/recovery
- docs/API.md dan docs/UI-THEME.md untuk menjaga perilaku yang sudah ada

Periksa apakah tooling development sudah ditambahkan setelah prompt ini
ditulis. Gunakan/perbaiki tooling existing yang sesuai, jangan membuat dua
setup yang saling bertentangan. Kerjakan perubahan reusable pada branch
fitur/setup tersendiri dari baseline yang telah diperiksa.

2. Pakai runtime yang dipin

Baseline repository saat prompt ditulis: Node.js 26.12.1, pnpm 12.14.0,
MySQL 8.4, empat aplikasi Next.js/React, Drizzle, Better Auth dan Nginx.
Source dan lockfile pada commit yang dipakai tetap menjadi acuan.

Pasang/aktifkan Node native sesuai arsitektur Mac memakai instalasi atau
version manager yang tersedia. Jangan memakai binary .tools Windows atau
mengganti runtime global proyek lain tanpa kebutuhan. Instal dependency
dengan frozen lockfile; jangan upgrade dependency untuk sekadar melewati error.
Jangan memaksa semua image menjadi linux/amd64 pada Apple Silicon.

Gunakan Context7 untuk API/config teknologi yang sedang dipakai. Cocokkan
dengan versi stabil yang dipin; jangan menyalin contoh canary secara otomatis.
Jika Context7 belum tersedia, laporkan kebutuhan integrasinya dan gunakan
dokumentasi resmi untuk pekerjaan independen yang bisa dilanjutkan.

Jika instalasi tool, trust certificate, atau login GitHub membutuhkan GUI,
hak administrator atau interaksi pemilik yang tidak bisa kamu selesaikan,
jelaskan langkah dan alasan spesifiknya. Lanjutkan pekerjaan independen
yang tidak membutuhkan input itu. Jangan meminta password/token di laporan.

3. Buat runtime development yang benar-benar terisolasi

Target default:
- Compose project: plant-v2-dev
- Named volume MySQL baru: plant-v2-dev_mysql-data
- Public origin lokal: https://localhost:9443
- Gateway HTTPS 127.0.0.1:9443; HTTP 127.0.0.1:9080 bila diperlukan
- MySQL 127.0.0.1:14306 hanya jika akses host diperlukan
- Database: plant_auth, plant_bag_filter dan plant_consumables pada instance
  development baru itu, dengan kredensial independen
- Tag image development sendiri; tidak memakai tag release produksi/test
- Rahasia, host.env/stack.env dan artefak lokal: .deploy/dev/
- Certificate/key localhost: .deploy/dev/certs/
- TEST_DATABASE=0 untuk data development persisten; jangan menyamarkannya
  sebagai deployment uji disposable hanya agar script tes bersedia berjalan

Jika port/nama sudah terpakai, identifikasi pemilik resource. Jangan stop
service lain atau mengganti port secara diam-diam. Sesuaikan seluruh origin,
URL, cookie, gateway dan dokumentasi secara konsisten bila perlu perubahan.

Implementasikan tooling reusable, misalnya scripts/prepare-dev.ts,
konfigurasi infra/dev/, serta perintah dev:setup, dev:up, dev:down,
dev:status dan dev:logs. Sesuaikan nama dengan struktur yang sudah ada.
Tooling Node/Compose harus bisa dipakai juga dari PowerShell Windows;
jangan mengandalkan path user Mac atau shell macOS pada kode bersama.

Setup yang dijalankan ulang harus mempertahankan credential, certificate,
akun, database dan volume development existing. Tolak target yang ambigu
atau ditandai berisi data nyata. Jangan overwrite .env/certificate atau
reset database sebagai fallback otomatis.

Tambahkan konfigurasi development secara aditif. Pertahankan deployment
VPS dan workflow CI existing. Pastikan file rahasia diabaikan Git serta
Docker build context, termasuk jika menggunakan env per aplikasi.

4. Jalankan empat aplikasi dan SSO lokal

Gunakan satu origin HTTPS dengan path:
- Portal: /
- Auth: /auth
- Bag Filter: /bag-filter
- Consumable Room: /consumables

Pertahankan basePath, navigasi dokumen penuh antar aplikasi, guard server,
origin/CSRF, service token internal, cookie Secure/HttpOnly dan scope akses.
Endpoint internal tidak menjadi endpoint publik hanya karena ini development.

Buat konfigurasi development dengan hot reload yang benar-benar bekerja
untuk source aplikasi dan package bersama. Pilih pendekatan yang sederhana
dan bisa digunakan kembali pada PC. Jangan mencampur node_modules native Mac
ke image Linux. Jika memakai Compose Watch atau bind mount, periksa ignore,
dependensi workspace, permission, file watching dan kebutuhan rebuild.

Audit jalur HMR/WebSocket melalui gateway. Proxy produksi saat ini tidak
boleh diasumsikan sudah mendukung semua kebutuhan Next dev. Jika perlu,
gunakan proxy/config khusus development tanpa melemahkan produksi atau
menghapus pemeriksaan identitas/origin. Batasi allowed dev origins secara
spesifik jika memang diperlukan; jangan memakai wildcard agar error hilang.

Pertahankan pemisahan URL internal antar-container dan URL dari host.
Jangan mengubah production origin ke localhost. Host port hanya boleh
dipublikasikan pada loopback; app server boleh mendengarkan interface
internal container yang diperlukan agar gateway Docker dapat mengaksesnya.

Gunakan certificate localhost development terpisah. Utamakan trust lokal
yang dapat digunakan browser; laporkan bila trust memerlukan interaksi OS.
Jangan mengklaim certificate trusted jika browser masih memberi warning.
Pengecualian verifikasi TLS hanya boleh pada konteks tes localhost tertentu,
bukan konfigurasi produksi atau penonaktifan TLS global.

5. Migrasi dan akun development

Jalankan migrator hanya pada instance development yang baru diverifikasi.
Pastikan keenam equipment/18.784 koordinat tersedia. Consumables boleh mulai
tanpa master/lokasi/saldo sampai fixture development dibuat.

Buat akun bootstrap development pada database pengguna development kosong,
dengan email domain .test dan password kuat yang disimpan privat. Pertahankan
kewajiban mengganti password awal. Jangan mencetak password ke laporan;
berikan lokasi file privat tempat pemilik mengambil kredensialnya.
Jika smoke test mengganti password awal, simpan kredensial development akhir
secara privat dan pastikan handover sesuai keadaan akun yang terakhir.

Fixture sintetis kecil boleh dibuat untuk menguji fitur. Pisahkan seed dev
dari migrator/seed produksi. Jangan mengambil data produksi untuk membuat
dashboard development tampak berisi, dan jangan menjalankan bootstrap/reset
pada database existing yang bukan target development kosong.

6. Periksa batas script pengujian

Script test/operations/gateway-recovery saat ini mempunyai asumsi project
plant-v2-test, MySQL 13306 dan HTTPS 8443. Sebagian menjalankan restart serta
menulis fixture. Jangan mengarahkannya langsung ke runtime plant-v2-dev.

Untuk setup ini, siapkan smoke test development yang dibatasi origin dan
project dev. Unit/typecheck/build serta smoke test lokal harus bisa dijalankan.
Suite integrasi/E2E/operasi existing tetap dapat berjalan di CI terpisah.

Jika memilih membuat script test dapat dikonfigurasi, pertahankan default
CI dan seluruh guard data nyata. Uji isolasinya lebih dahulu; jangan melemahkan
guard, menghapus marker REAL-DATA-PRESENT atau menonaktifkan tes agar hijau.
Jangan menjadikan perombakan seluruh suite CI sebagai alasan setup dev macet.

7. Verifikasi sampai bisa dipakai

Jalankan pemeriksaan yang relevan dan catat hasil aktual:
- typecheck, unit dan build empat aplikasi dengan versi yang dipin
- merged Compose dan Docker context sesuai target lokal; tampilkan hanya
  config --quiet/metadata yang aman, bukan konfigurasi berisi secret
- container/network/volume memang milik plant-v2-dev; binding hanya loopback
- login development, ganti password pertama, SSO Portal ke dua app operasional,
  profil, grant/scope dan logout
- deep link/reload, CSS/JS, JSON API, readiness dan endpoint internal tertutup
- enam peta Bag Filter serta halaman Consumables, tema terang/gelap dan mobile
- hot reload perubahan aplikasi dan package bersama, tanpa rebuild manual
  setiap edit; kembalikan hanya perubahan uji yang kamu buat sendiri
- restart container dev mempertahankan data; setup ulang tidak merotasi
  credential atau menduplikasi akun/koordinat

Gunakan browser/otomasi yang tersedia pada Mac. Jangan mengklaim pengujian
browser atau macOS trust lulus hanya berdasarkan curl/container healthy.
Data uji hanya dibuat pada database development yang telah dibuktikan.

8. Serahkan workspace dan panduan pakai

Simpan handover privat di .deploy/dev/DEV-HANDOVER.md. Isi minimal:
path workspace, arsitektur, branch/commit, versi runtime, project/container/
volume/port, URL login, lokasi kredensial privat, status certificate, perintah
setup/start/stop/logs, hasil tes, cara bekerja dengan hot reload dan pekerjaan
yang masih membutuhkan pemilik. Jangan menaruh nilai password/token/key.

Dokumentasikan tooling reusable di docs dan laporkan diff yang siap direview.
Jelaskan penggunaan pada PC Windows tanpa menyalakan project arsip lama.
Jangan merge ke main atau menjalankan deployment VPS sebagai bagian setup ini.

Saat berpindah perangkat: commit/push branch fitur dari perangkat asal;
di perangkat tujuan amankan perubahan lokal, fetch/switch branch yang sama,
pull --ff-only dan install dependency sesuai lockfile. Database/env lokal
tidak ikut sinkronisasi. Jangan force push/reset untuk mengatasi perbedaan
riwayat. Push biasa tidak dianggap sebagai rilis produksi.

Kerjakan langkah yang sudah termasuk mandat ini tanpa meminta konfirmasi
berulang. Tanyakan hanya informasi atau interaksi OS/akun yang benar-benar
diperlukan. Jika terhambat, laporkan blocker spesifik, bukti terakhir dan
langkah resume; jangan mengisi status lulus untuk pekerjaan yang belum diuji.
```

## Batas verifikasi prompt ini

Prompt disesuaikan dengan source repository dan [alur PC/Mac](DEVELOPMENT-TO-VPS.md). Setup, runtime, hot reload, trust certificate dan pengujian pada MacBook harus dikerjakan serta dibuktikan Claude Code di Mac. Pembuatan prompt dari PC bukan bukti bahwa workspace Mac sudah siap.

Dokumentasi teknologi diperiksa melalui Context7. Claude Code tetap perlu memeriksa API yang dipakai terhadap versi repository:

- [Next.js — allowed development origins](https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins).
- [Docker Compose — project name](https://docs.docker.com/compose/how-tos/project-name/).
- [Docker Compose — Watch dan dependency native](https://docs.docker.com/compose/how-tos/file-watch/).
