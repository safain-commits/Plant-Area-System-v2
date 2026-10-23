# Hasil validasi implementasi v2

Tanggal: 22 Oktober 2026. Lingkungan: host Windows dengan Node26.12.1, container Linux Node26.12.1, MySQL8.4.13, Nginx1.30.6, dan Chromium156 melalui Playwright1.64.1. HTTPS localhost8443 memakai sertifikat pengujian. Project Compose: `plant-v2-test`; database dan volume terpisah dari deployment produksi.

## Grafik kuartal dan jeda 561/562 — 23 Oktober 2026

Grafik Portal dan Bag Filter kini menampilkan Q1–Q4 dengan pilihan tahun, default tahun berjalan WIB. Agregasi tetap per pabrikan dan scope pengguna. Pembanding grafik adalah total tahun kalender sebelumnya, sedangkan KPI/distribusi tetap kondisi terkini. Peta 561/562 mempunyai jeda margin 9–10 pada overview dan detail, tanpa mengubah koordinat atau data pemasangan.

Typecheck, build ketiga aplikasi, delapan tes unit, 15 hasil integrasi MySQL, dan lima tes browser Chromium lulus. Fixture integrasi memeriksa seluruh batas kuartal WIB, pergantian tahun, agregasi brand, cakupan equipment, serta penolakan tahun di luar batas. Browser memeriksa pilihan tahun dan empat label Q1–Q4, 24 jeda overview per equipment 561/562, urutan baris sebelum/sesudah jeda pada kedua sisi, serta margin detail 8 px dalam tema terang/gelap. Smoke test SSO/pencatatan dan pemeriksaan responsif tetap lulus.

Screenshot grafik serta peta 561 ditinjau visual; peta 561/562 tersedia lokal di `test-results/quarter-gap-*.png`. Preview HTTPS lokal telah diperbarui. Tidak ada migrasi database; hasil ini validasi lokal perubahan kuartal/jeda, bukan hasil CI baru.

## Perbaikan startup MySQL pada CI Linux — 23 Oktober 2026

[Run pertama commit UI refresh](https://github.com/safain-commits/Plant-Area-System-v2/actions/runs/39908376470) lulus typecheck dan unit test, lalu gagal pada persiapan MySQL sebelum migrasi. Reproduksi memakai image MySQL 8.4.13 dan initializer berizin Linux `0644` menghasilkan `MYSQL_ONETIME_PASSWORD: unbound variable`: entrypoint men-source script, sehingga `set -u` bocor ke shell entrypoint. Script pada mount Windows dapat dieksekusi sebagai proses terpisah, sehingga pengujian dengan volume lama tidak mengungkap masalah ini.

Initializer kini mengisolasi opsi shell dalam subshell. Uji startup dengan database baru dan izin `0644` berhasil mencapai `healthy`; syntax Bash juga lulus. Healthcheck memakai koneksi TCP dan memeriksa kedua database agar server sementara saat inisialisasi tidak dianggap siap. Workflow memakai Ubuntu 24.04 yang dipin, action checkout/setup-node versi Node 24, serta log diagnostik sebelum cleanup jika gagal. Runtime aplikasi tetap Node 26.12.1. Pengujian ini memakai container dan penyimpanan sementara terpisah, tanpa menghapus data preview.

## UI refresh v2 — 23 Oktober 2026

Acuan tampilan aktif adalah brief di `docs/design/` dan [UI-THEME.md](UI-THEME.md). Bagian tema di bawah merupakan catatan historis yang telah digantikan refresh ini.

- Typecheck root dan build/typecheck ketiga aplikasi lulus pada Node 26.12.1. Image standalone diterapkan pada preview HTTPS lokal; Auth, Portal, Bag Filter, dan MySQL berstatus sehat. Tidak ada dependency UI baru atau migrasi database.
- Delapan tes unit lulus. Skala umur tujuh stop diuji pada seluruh 21.601 langkah jam sampai 900 hari dan nilai di atas batas; pemilihan teks sel berdasarkan luminansi menjaga rasio minimal 4,5:1. Koordinat enam equipment tetap 18.784 posisi unik.
- Lima belas hasil integrasi MySQL lulus, termasuk migrasi historis, transaksi/retry, pagination, autentikasi, serta agregasi dashboard dan aktivitas sesuai scope. Fixture memverifikasi pemasangan terkini, brand, tujuh bucket, periode 7/30 hari, scope kosong, serta tanggal pemasangan dekat pergantian hari WIB. Toleransi waktu ke depan tidak masuk keliru ke periode pembanding.
- Lima tes browser Chromium lulus: SSO/password awal/logout, isolasi gateway, peran/scope/API langsung, pencatatan Brand/Pabrikan lintas sisi, history/timeline, dan keenam peta. Pencarian cepat, notifikasi, grafik 7/30 hari, sidebar tersimpan/flyout, serta pembatalan konfirmasi reset password diuji.
- Pengujian tema mencakup Sistem/perubahan perangkat, override, reload, perpindahan aplikasi, antar-tab, event sessionStorage yang diabaikan, pemulihan lifecycle, storage diblokir, dan tema sebelum hydration dengan bundle framework diblokir. Tidak ditemukan page error atau hydration warning pada halaman yang diperiksa.
- Seleksi klik/Shift-click, marquee, keyboard/Shift+arrows, filter legenda, warna umur yang tidak berubah saat dipilih, draft sheet, kalender WIB beserta pilihan jam/menit, dan pergantian tema diuji. Detail mobile mempunyai sel minimal 44 px; label kolom tetap sejajar saat scroll internal. Nomor baris tetap di kiri.
- Pemeriksaan 28 pasangan token per tema lulus batas teks 4,5:1. Audit computed style pada sembilan halaman dalam kedua tema tidak menemukan teks di bawah batas pada keadaan yang diperiksa. Teks link equipment aktif diuji pada DOM sebenarnya untuk mencegah benturan CSS lama. Area gradien diperiksa melalui pasangan token batas warnanya; audit ini bukan sertifikasi aksesibilitas menyeluruh.
- Viewport 390, 640, 768, 1024, 1280, dan 1536 px diperiksa pada Portal, profil, admin, penggantian password, katalog, audit, dan keenam equipment tanpa scroll horizontal halaman. Smoke test platform juga memakai desktop 1440 px. Screenshot terang/gelap Portal, Auth, dan peta desktop/mobile ditinjau visual; berkas lokal berada di `test-results/refresh-*.png`.
- Temuan yang diperbaiki: Escape dropdown menutup parent sheet, timer toast ter-reset oleh rerender, konfirmasi reset password salah tempat, kontras link equipment aktif tertimpa CSS lama, header kolom detail ikut melekat saat scroll horizontal, serta label rentang umur yang salah karakter. Harness mengikuti kontrol custom dan mengabaikan subtree tersembunyi saat streaming Next.js.

Preferensi tampilan dan status aktivitas dibaca tersimpan pada browser, bukan pada akun. Notifikasi hanya menampilkan batch sesuai grant saat permintaan berlangsung; tidak membuat aktivitas dummy. Timer memakai kedaluwarsa sesi Auth tanpa memperpanjangnya. Semua fixture tetap di database uji terpisah. Validasi ini belum mencakup Safari/Firefox, gesture pada perangkat sentuh fisik, atau load test produksi. Context7 tidak tersedia pada tool sesi ini; primitive browser/React dirujuk ke dokumentasi resmi yang ditautkan pada panduan tema.

## Audit dark mode dan kontrol ikon — 23 Oktober 2026

- Dropdown topbar/Auth diganti tombol ikon 36 px (40 px mobile). Satu klik mengganti Terang/Gelap; pilihan Sistem dipindahkan ke Profil → Tampilan. Ikon, tooltip, dan `aria-pressed` mengikuti tema aktual, termasuk perubahan perangkat ketika mode Sistem aktif. Space/Enter juga diuji.
- Audit computed style pada tujuh halaman dark mode menemukan 52 label koordinat history dengan rasio hanya 1,11:1 pada preview sebelum perbaikan. Penyebabnya adalah warna hijau brand langsung pada latar gelap. Tombol kini memakai token informasi; kondisi normal, hover, dan focus lulus batas teks 4,5:1.
- Teks pendukung dark mode menjadi `#B5BEC6`; metadata history/timeline serta label koordinat diperbesar menjadi 12 px. Legenda diberi batas netral untuk membedakan warna umur tertua tanpa mengubah skala data.
- Audit ulang computed style pada Portal, profil, admin, penggantian password, katalog, peta 561, dan audit aplikasi tidak menemukan label teks tampil di bawah batas pada keadaan halaman yang diperiksa. Ini pemeriksaan keterbacaan lokal, bukan klaim sertifikasi aksesibilitas menyeluruh.
- Provider membaca ulang preferensi saat `pageshow` dari cache Back/Forward dan mengabaikan event sessionStorage. Pengujian lifecycle memakai event cache yang disimulasikan; belum mengklaim pengujian cache native di semua browser.
- Typecheck, build ketiga aplikasi, delapan unit test, dan lima tes browser Chromium lulus. Pengujian mencakup kedua tema, enam equipment, desktop/mobile, profile/System, preferensi antar-tab, storage diblokir, initial theme, draft, SSO, dan pencatatan. Screenshot Portal, Auth mobile, dan history setelah perbaikan ditinjau visual. Preview lokal telah diperbarui.

## Tema clean modern industrial — 23 Oktober 2026

- Typecheck root serta typecheck dalam build ketiga aplikasi lulus; image Next.js standalone Portal, Auth, dan Bag Filter berhasil dibangun pada Node 26.12.1 dan diterapkan pada preview lokal.
- Delapan tes unit lulus. Pengujian warna mempertahankan nilai umur lama dan memeriksa kontras teks pada seluruh 21.601 langkah jam sampai 900 hari, nilai kosong, dan umur di atas batas; minimum 4,5:1.
- Smoke test browser platform lulus: SSO, password awal, gateway, pencatatan Brand/Pabrikan, mobile, izin, dan logout. Tiga tes browser tema juga lulus, mencakup default/perubahan Sistem, override, reload, sinkronisasi antar-tab, nilai invalid, dan storage diblokir.
- Dengan bundle framework diblokir, tema tersimpan tetap sudah benar sebelum hydration. Tidak ditemukan page error atau hydration warning pada navigasi Portal, profil, admin, Auth, katalog, audit, dan keenam peta dalam kedua tema.
- Pemeriksaan 22 pasangan token per tema di Chromium lulus: teks minimal 4,5:1; border kontrol/focus yang diperiksa minimal 3:1. Pilihan bag, merek, dan alasan tetap utuh saat berganti tema; hover menu aktif serta focus keyboard diperiksa.
- Desktop 1440 px dan mobile 390 px pada halaman yang diuji tidak memiliki scroll horizontal. Screenshot Portal terang/gelap, peta desktop, detail mobile, serta form Auth tersedia lokal di `test-results/theme-*.png` dan ditinjau visual.
- Pengujian tambahan sempat gagal karena focus dipicu secara programatik setelah interaksi mouse dan cleanup fixture mengabaikan foreign key. Harness diperbaiki menggunakan Tab/Shift+Tab serta penghapusan child row dalam transaksi. Ketiga tes tema lulus saat dijalankan ulang; akun fixture gagal sebelumnya juga sudah dibersihkan.

Tidak ada migrasi database atau perubahan API untuk tema. Validasi browser ini menggunakan Chromium; belum mengklaim hasil Safari/Firefox atau browser lama tanpa dukungan CSS `light-dark()`. Rincian kontrak tema dan warna ada di [UI-THEME.md](UI-THEME.md).

## Posisi label kolom overview — 23 Oktober 2026

Label kolom sisi B pada 421/422 dan Selatan pada 561/562 dipindahkan tepat di bawah nama kompartemen, mengikuti L61/L62. Typecheck root dan build Bag Filter lulus. Pemeriksaan Chromium pada seluruh kompartemen sisi bawah keenam equipment memastikan urutan nama kompartemen → label kolom → grid, urutan huruf tetap benar, serta desktop tanpa scroll horizontal. Screenshot 421 ditinjau visual; preview lokal sudah diperbarui.

## Brand/Pabrikan — 23 Oktober 2026

- Typecheck root dan aplikasi Bag Filter, tujuh tes unit, 14 hasil integrasi MySQL, serta build container Bag Filter dan migrasi lulus.
- Empat pilihan merek diuji pada penyimpanan, history, timeline, audit, dan retry. Merek wajib untuk transaksi baru; perubahan merek dengan idempotency key yang sama ditolak. Retry transaksi lama tanpa merek tetap didukung.
- Migrasi `0002_batch_brand.sql` berhasil pada preview lokal setelah backup. Seluruh 67 batch lama mempertahankan ID dan hash; mereknya tetap NULL, ditampilkan sebagai **Belum tercatat**.
- Alur E2E Chromium lulus, termasuk pemilihan merek, penyimpanan, history/timeline, dan pengosongan pilihan setelah berhasil. Pemeriksaan browser tambahan pada keenam equipment memastikan empat pilihan wajib berada sebelum alasan.
- Screenshot form desktop/mobile tersedia lokal di `test-results/brand-form-*.png`; form mobile ditinjau visual dan tidak mempunyai scroll horizontal.

## Pembaruan equipment v2.1 — 23 Oktober 2026

Katalog enam equipment memiliki **18.784 koordinat**: 561/562 masing-masing 3.264, 421/422 masing-masing 4.080, dan L61/L62 masing-masing 2.048. Pengujian memakai Node 26.12.1 dan MySQL 8.4 pada lingkungan uji terpisah yang sama.

- Typecheck root dan ketiga aplikasi lulus; ketiga aplikasi berhasil dibangun menjadi container Next.js standalone.
- Tujuh tes unit lulus: identitas/label koordinat dapat dikonversi bolak-balik, batas per equipment, orientasi, umur, validasi batch, izin, dan redirect.
- Suite integrasi lulus: 14 hasil termasuk parent test, terdiri dari tiga tes migrasi dan sepuluh sub-skenario operasional/auth. Fixture migrasi memakai database sementara sendiri yang dihapus setelah selesai.
- Fixture 421 dan 422 membuktikan ID, posisi fisik, actor, waktu, dan history tetap; hash baru mendukung retry dengan batch semula. Kegagalan hash di tengah proses membatalkan seluruh perubahan. Konflik target, pengulangan migrasi, serta koordinat yang muncul kembali dari seed lama diuji. Scope baru hanya diberikan kepada bootstrap dan tidak ditambahkan kembali setelah pencabutan manual.
- Browser Chromium lulus: keenam kode tersedia, 422-BF2 ditolak, sudut peta A/B dan Timur/Barat benar, nomor baris kiri, stiffener ada, penyimpanan dua sisi satu batch, reload/persistence, label history, penolakan koordinat invalid, dan scope pengguna. Desktop 1440 dan mobile 390 tidak mempunyai scroll horizontal.
- Screenshot 421/422 serta L61/L62 tersedia lokal di `test-results/`; tampilan L61 desktop/mobile dan 421 desktop telah ditinjau visual.
- Uji operasi lulus: persistence setelah restart, fail-closed saat Auth berhenti, guard layanan langsung, serta backup/restore dengan perbandingan enam kelompok data.

Saat validasi ditemukan bahwa `docker compose start` dapat menjalankan container migrasi lama dan men-seed ulang koordinat lama. Referensi tambahan pada database uji diverifikasi tidak mempunyai transaksi lalu dibersihkan; container migrasi diganti. Runbook kini memakai `up --force-recreate` untuk migrasi dan migrasi memverifikasi katalog meskipun checkpoint sudah selesai. Tidak ada migrasi awal yang diubah, reset database, atau penonaktifan foreign key.

Hasil ini adalah validasi lokal pembaruan equipment. Bukti GitHub Actions di bagian baseline di bawah berlaku untuk commit awal, bukan perubahan v2.1 yang belum dipush. Orientasi tetap perlu penerimaan operator lapangan sebelum go-live.

## Pemeriksaan baseline 22 Oktober 2026 yang lulus

| Area                 | Bukti                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Integritas referensi | Seluruh359 file ekspor lulus checksum; source dan PRD lama tidak diubah                                                      |
| TypeScript           | Root packages/scripts/tests serta ketiga aplikasi lulus typecheck                                                            |
| Build                | Portal, Auth, Bag Filter berhasil build Next.js standalone di Node26; image Linux masing-masing berhasil dibuat dan berjalan |
| Database             | Migrasi kedua database berhasil, dapat dijalankan ulang; seed14.688 koordinat tanpa transaksi produksi                       |
| Unit domain          | 6 tes: koordinat/balik Selatan, umur/warna, WIB/batas tanggal, validasi/canonical payload, izin, redirect aman               |
| Integrasi MySQL      | 10 sub-skenario, seluruhnya lulus (11 hasil termasuk parent test)                                                            |
| Browser gateway      | Alur terpadu SSO/akun/Bag Filter/admin lulus; tidak ada JavaScript page error                                                |
| Persistence          | Jumlah akun, sesi, batch, pemasangan, audit, koordinat sama setelah restart MySQL/Bag Filter                                 |
| Auth tidak tersedia  | Portal, Bag Filter, serta API keduanya memberi503 saat Auth dihentikan                                                       |
| Guard internal       | Pemanggilan langsung API Bag Filter dengan header identitas palsu ditolak401; internal Auth tanpa token ditolak403           |
| Backup/restore       | Dump harian dipulihkan ke container MySQL baru; jumlah enam kelompok data sama                                               |

## Cakupan pengujian

Integrasi menguji batch500, penolakan501/duplikat/koordinat salah, lima retry bersamaan menjadi satu batch, konflik payload409, kegagalan audit yang membatalkan seluruh transaksi, tanggal mundur, waktu sama, 55 batch bersamaan pada satu koordinat, kondisi terkini deterministik, grouping WO kosong, pencarian koordinat, dan pagination50 tanpa kehilangan record.

Autentikasi menguji password sementara wajib diganti, cookie Secure/HttpOnly/Lax/Path=/ tanpa Domain, sesi absolut delapan jam tanpa refresh, perubahan grant berlaku langsung, expiry, logout, deaktivasi, reset, pembatasan10kegagalan per akun/IP, reset bersamaan dengan login, serta12login paralel melebihi ukuran pool pengelolaan.

Browser memeriksa tujuan kembali dengan query lengkap, deep link/reload/aset, endpoint internal termasuk path terenkode, penolakan signup publik dan origin asing, halaman akun sementara, portal ke Bag Filter tanpa login ulang, kondisi equipment30kompartemen kosong, simulasi error history dan tombol retry, pemilihan lintas Utara/Selatan menjadi satu batch tanpa WO, pencarian history, viewport desktop1440 dan mobile390 tanpa scroll horizontal, izin viewer/operator/scope, penonaktifan aplikasi/akun, serta logout pada dua aplikasi. Screenshot login, portal, map desktop dan detail mobile ditinjau secara visual.

## Perbaikan yang ditemukan melalui tes

- Konversi raw DATETIME Drizzle harus eksplisit UTC; parsing sebagai waktu host WIB menggeser timeline/cursor tujuh jam.
- Redirect Nginx relatif harus mempertahankan port HTTPS pengujian. `absolute_redirect off` dan tujuan kembali terenkode mempertahankan deep link/query.
- Transaksi login tidak boleh mengunci user selama adapter Better Auth membuat sesi dalam transaksi berbeda. Pemeriksaan hash/status dilakukan kembali setelah login native, dengan lock yang mengurutkan reset/deaktivasi.
- Pool adapter Better Auth dipisahkan dari pool transaksi pengelolaan agar login paralel tidak menghabiskan koneksi untuk transaksi bersarang.
- Syntax JSX dan pengetikan filter katalog diperbaiki saat typecheck awal.

## Batas hasil

Ini validasi implementasi lokal, bukan persetujuan go-live di server organisasi. Workflow `.github/workflows/ci.yml` juga [lulus di GitHub Actions](https://github.com/safain-commits/Plant-Area-System-v2/actions/runs/39795844806) untuk commit awal `c3b704a` pada branch `main` (22 Oktober 2026, durasi 7 menit 54 detik).

Belum dilakukan load test skala produksi, browser selain Chromium, integrasi sertifikat/hostname organisasi, atau uji operator di lapangan. Target pemulihan empat jam perlu diukur ulang menggunakan volume data produksi. Backup lokal sudah diuji; penyalinan terenkripsi ke storage organisasi di luar host tetap merupakan tugas deployment.

Setelah validasi baseline 22 Oktober, preview lokal dikembalikan ke kondisi awal melalui script khusus database uji: satu admin bootstrap, seluruh grant bootstrap, dan tanpa transaksi pemasangan. Screenshot/laporan pengujian menggambarkan data fixture saat tes berjalan, bukan data operasional.

## Reproduksi

Ikuti README untuk menyiapkan database/bootstrap/gateway, kemudian:

```sh
pnpm typecheck
pnpm test
node --env-file=.test-runtime/host.env --import tsx --test --test-concurrency=1 tests/integration/*.test.ts
pnpm test:e2e
node --env-file=.test-runtime/host.env --import tsx scripts/test-operations.ts
pnpm check:export # opsional bila arsip tersedia di workspace lokal
```

Jangan menjalankan tes browser dan operasi secara bersamaan karena tes operasi sengaja menghentikan dependency.
