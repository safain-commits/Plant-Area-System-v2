# Hasil validasi implementasi v2

## Sidebar dan dashboard Consumable Room — 23 Oktober 2026

Implementasi mengikuti [UI Polish](design/CONSUMABLE-ROOM-UI-POLISH.md). Preview HTTPS lokal telah diperbarui dengan empat image aplikasi. Tidak ada migrasi, perubahan query stok, atau perubahan izin untuk penyempurnaan ini.

- Sidebar mempunyai satu hierarki aplikasi, submenu sesuai aplikasi aktif, penanda halaman, flyout rail, area navigasi yang dapat scroll, serta akun/sesi ringkas di bawah. Halaman Audit Bag Filter sekarang menandai submenu Audit dengan benar.
- Dashboard Consumables mempunyai satu judul, hero chart dengan tiga KPI, kesiapan saldo awal, perhatian, serta rail aksi/aktivitas. Portal memakai varian ringkas. Chart mempunyai sumbu count integer, panel kuartal, keyboard/tap, dan mempertahankan angka distribusi ekstrem tanpa memperbesar bar kecil atau membuat bar nol.
- Delapan aktivitas dibatasi scroll internal, dengan deskripsi dua baris, metadata, jumlah, satuan, dan jenis. Nilai koreksi adalah selisih ledger. Skeleton mengikuti susunan halaman; error/retry mempertahankan tahun dan data terakhir. Link perhatian meneruskan filter ketersediaan ke Cek stok.

| Pemeriksaan          | Hasil aktual                                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck/format     | Root TypeScript, pemeriksaan TypeScript melalui build empat Next.js, Prettier pada file terkait, dan `git diff --check` lulus                                                                   |
| Unit                 | 12 tes lulus, termasuk skala sumbu bilangan bulat/baseline nol; seluruh tes domain/warna lama tetap lulus                                                                                       |
| Build                | Auth, Portal, Bag Filter, Consumables berhasil dibangun sebagai container Node 26.12.1 dengan lockfile frozen                                                                                   |
| Browser HTTPS        | 9 skenario Chromium lulus dalam satu run: tiga UI polish, dua transaksi/akses Consumables, empat tema/peta/shell; pengujian visual diperiksa kembali setelah menambah screenshot 1920 px        |
| Sidebar              | Portal, Consumables, Bag Filter, Audit, Profil/Admin; expanded/rail/drawer, focus return, Ctrl+B, empat peran stok, serta batas viewport tinggi 768/900 px lulus                                |
| Chart                | Loading, semua nol, satu jenis, semua jenis, seimbang, 2/2/2/1.179, rincian keyboard, pergantian tahun, respons HTML gagal, dan retry lulus                                                     |
| Stok/SSO             | Saldo awal, penerimaan pack, pemakaian pecahan, history, peran/scope/API langsung, pergantian aplikasi, detail sesi WIB, serta logout yang mencabut akses kedua API lulus                       |
| Responsif/tema       | 1920, 1440, 1024, 768, 390 px; terang/gelap, tanpa overflow horizontal; mobile menyembunyikan sidebar desktop sebelum drawer terpasang agar tidak menambah tinggi halaman saat hydration/resize |
| Keterbacaan          | Pasangan token/warna dan focus diuji oleh suite tema; teks induk aplikasi baru juga diperiksa langsung minimal 4,5:1 dalam kedua tema. Keyboard/dialog/table chart memakai semantik native      |
| Referensi Bag Filter | PNG area `.dashboard-grid` pada 1440 px sebelum/sesudah identik: SHA-256 `800fdc126f3d4d3057d2100d39df065af3b189a9d39e3d1afb69d9828b24624e`; sidebar memang berubah sesuai rencana              |
| Gateway              | Uji pergantian IP dua aplikasi dengan sentinel HTML lulus tanpa restart Nginx; browser juga lulus setelah recreate empat aplikasi                                                               |

Screenshot terang/gelap 1440/1920/390 px diperiksa visual pada `.test-runtime/stock-polish-*.png`; perbandingan Bag Filter pada `.test-runtime/bag-gold-before.png` dan `.test-runtime/bag-gold-polish.png`. Screenshot sintetis memakai interception respons pada browser pengujian; angka tersebut tidak menjadi data produksi. Fixture baru dan suite transaksi browser membersihkan akun/lokasi/material/movement miliknya berdasarkan ID. Fixture historis preview tidak dihapus dan pemisahan preview pilot menjadi pekerjaan lingkungan tersendiri.

Saat pengerjaan, aturan CSS legacy pada link bersarang sempat membuat label induk terlalu pucat; specificity diperbaiki. Selector error awal juga sempat mencakup live region Next.js; pengujian kemudian dibatasi ke alert ringkasan dan seluruh run akhir lulus. Perubahan viewport sempat menambah ruang sidebar desktop sebelum hydration; CSS mobile dan penantian layout pada screenshot diperbaiki.

Batas: belum menjalankan NVDA/VoiceOver atau Firefox/Safari. Integrasi MySQL penuh dan backup/restore tidak diulang karena schema/query tidak berubah; alur transaksi dan guard tetap diuji terhadap MySQL lewat browser. Tidak menjalankan ulang suite platform yang mengubah password akun pilot; SSO/logout diuji dengan akun sementara milik suite ini. Context7 tidak tersedia; lifecycle fetch/cleanup mengacu pada tipe terpasang dan [dokumentasi React useEffect](https://react.dev/reference/react/useEffect).

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
node --env-file=.test-runtime/host.env --import tsx scripts/test-gateway-recovery.ts
pnpm check:export # opsional bila arsip tersedia di workspace lokal
```

Jangan menjalankan tes browser dan operasi secara bersamaan karena tes operasi sengaja menghentikan dependency.

## Consumable Room v1 — 23 Oktober 2026

Implementasi diuji pada Node.js 26.12.1, MySQL 8.4 di Linux containers Docker Desktop, dan gateway HTTPS lokal. Tidak menjalankan pengujian terhadap deployment produksi.

| Pemeriksaan                       | Hasil aktual                                                                                                                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck root dan empat aplikasi | Lulus; build Next.js juga memeriksa TypeScript setiap aplikasi                                                                                                                                                  |
| Unit test                         | 11 pemeriksaan lulus, mencakup fixed-point, locale, batas presisi, role/scope, dan mapping katalog                                                                                                              |
| Integrasi MySQL lengkap           | 24 pemeriksaan lulus; tujuh pemeriksaan stok dijalankan lagi setelah perubahan filter dan tetap lulus                                                                                                           |
| Build container                   | Auth, Portal, Bag Filter, Consumables, dan image tools berhasil dibangun dengan lockfile frozen                                                                                                                 |
| Browser HTTPS                     | 7 skenario lulus: alur Consumables + role/scope/gateway, dan seluruh regresi platform/tema/peta sebelumnya                                                                                                      |
| Visual                            | Screenshot desktop 1440 px dan mobile 390 px diperiksa pada kedua tema; audit mobile memakai kartu, stock memakai baris/kartu responsif, tidak ada overflow halaman pada seluruh halaman Consumables yang diuji |
| Draft dan tema                    | Jumlah/pekerjaan pemakaian tetap utuh sesudah perubahan tema                                                                                                                                                    |
| Impor katalog privat penuh        | Dry-run, apply, replay pada database sementara: 17.744 master, 43 satuan, 13 kategori; nol inventory, nol movement, nol isi pack yang diasumsikan; database sementara dihapus setelah verifikasi                |
| Migrasi                           | Upgrade volume lokal lama tanpa reset berhasil; fixture memastikan hanya bootstrap aktif diberi grant sekali, pencabutan/disabled dipertahankan, grant Bag Filter tetap ada                                     |
| Rekonsiliasi                      | Tidak ditemukan selisih antara saldo dan penjumlahan ledger                                                                                                                                                     |
| Restart dan fail closed           | Data tetap setelah restart MySQL/Bag Filter/Consumables; Auth berhenti menghasilkan 503 pada kedua aplikasi/API; header identitas palsu tidak melewati guard                                                    |
| Backup dan restore                | Dump tiga database berhasil dipulihkan ke MySQL terpisah, termasuk initializer aplikasi pada instance kosong; dibandingkan 14 tabel, total saldo/ledger, serta checksum ledger                                  |
| Integritas arsip                  | 359 file dan checksum ekspor tetap sesuai; katalog internal tidak masuk Git atau image                                                                                                                          |

Kasus stok yang dibuktikan: saldo awal nol/sekali; jumlah 0,1 + 0,2 presisi; konversi pack dan snapshot lama; master/pack stale; unit terkunci; koreksi versi stale; dua pengambilan bersamaan tanpa minus; retry concurrent satu ledger; key berbeda payload ditolak; kegagalan audit rollback seluruh transaksi; scope baca/tulis; pagination lebih dari 300 pergerakan dan material sama pada dua lokasi; batas kuartal/tanggal WIB.

Perbaikan dari pengujian: timestamp mentah driver MySQL dinormalisasi ke ISO UTC sebelum membentuk cursor; cursor inventory memakai ID pasangan material–lokasi; proxy admin mengenali grant aplikasi/lokasi baru; request pencarian lama dibatalkan; notifikasi tidak menghilangkan hasil sumber lain ketika salah satu gagal. Selector browser menggunakan role yang terlihat karena halaman sebelumnya dapat dipertahankan tersembunyi oleh router.

Artefak lokal: `.test-runtime/consumables-desktop-light.png`, `.test-runtime/consumables-desktop-dark.png`, `.test-runtime/consumables-mobile-dark.png`; laporan Playwright pada `playwright-report/`. Semuanya diabaikan Git. Backup terakhir uji restore `plant-20261023T111422Z.sql.gz` berada pada folder backup privat.

Batas validasi: RTO/kapasitas produksi belum diukur dengan beban aktual. Tidak ada migrasi stok atau transaksi operasional dari arsip. Impor produksi tetap tindakan eksplisit melalui CLI; lokasi, rak, isi pack dan saldo fisik aktual belum ditentukan oleh pengujian ini. Context7 tidak tersedia pada sesi ini; desain mengacu pada API versi terpin, tipe library terpasang, serta dokumentasi resmi MySQL/Drizzle/Next.js yang diperiksa saat perencanaan.

## Perbaikan routing gateway setelah restart — 23 Oktober 2026

Laporan dashboard gagal memuat JSON dan Consumable Room 404 berhasil direproduksi pada preview HTTPS. Akun yang dilaporkan aktif dan mempunyai role admin di kedua aplikasi. Nginx memakai alamat upstream yang di-resolve saat startup; setelah restart container, alamat Bag Filter dan Consumables tertukar. Kedua API dashboard mengembalikan HTML 404 dari aplikasi lain, sedangkan `/consumables` memakai aset Bag Filter. Healthcheck internal tetap sehat, sehingga pemeriksaan restart sebelumnya belum membuktikan akses terautentikasi melalui gateway.

Konfigurasi keempat upstream kini memakai shared zone dan resolusi DNS Docker dinamis (cache 5 detik). Template telah diterapkan pada Nginx lokal dan `nginx -t` lulus. Kedua API dashboard kembali 200 `application/json`; halaman Portal, Bag Filter, Consumable Room, dan Cek Stok kembali 200 dengan prefix aset masing-masing. Tidak ada perubahan role akun, password pengguna, atau migrasi data untuk perbaikan ini.

Pemeriksaan aktual:

- Typecheck root dan 11 unit test lulus.
- `scripts/test-gateway-recovery.ts` lulus: dua alamat lama ditempati layanan HTML sentinel, kedua aplikasi dipaksa memperoleh IP berbeda, lalu dashboard terautentikasi, halaman SSO, serta CSS/JS kembali benar tanpa restart Nginx. Akun verifikasi dan sentinel dibersihkan. Script ditambahkan ke CI setelah tes operasi; belum mengklaim hasil run GitHub baru.
- Satu skenario browser Chromium lulus: kedua ringkasan Portal dan ringkasan Consumables tampil, diikuti saldo awal, penerimaan pack, pemakaian, history, pergantian tema, mobile, serta perpindahan kembali ke Bag Filter/Portal tanpa login ulang. Tidak ada page error. Screenshot halaman yang pulih diperiksa di `.test-runtime/gateway-portal-recovered.png` dan `.test-runtime/gateway-consumables-recovered.png`.
- Percobaan browser awal gagal pada selector pengujian baru yang mencari `img`; grafik menggunakan role `figure`. Selector diperbaiki dan skenario dijalankan ulang hingga lulus.

Tidak menjalankan ulang build empat aplikasi, seluruh integrasi MySQL, atau backup/restore pada perbaikan routing ini; tidak ada perubahan source aplikasi maupun schema. Hasil sebelumnya tetap tercatat pada bagian Consumable Room v1, dengan batasan pemeriksaan restart yang dijelaskan di atas.

## Audit hover dan dropdown — 23 Oktober 2026

Perbaikan shared UI diverifikasi pada build produksi HTTPS lokal. Typecheck root, 12 unit test, build empat aplikasi, dan format file perbaikan lulus. Empat container aplikasi sehat setelah pembaruan. Sebanyak 14 skenario browser lulus dalam satu run, ditambah satu skenario pointer Tema di Portal yang lulus pada run terpisah: total 15 skenario unik.

TestSprite benar-benar dijalankan dengan akun sementara. Run akhir mencatat 0 passed, 2 failed, dan 1 blocked: pemeriksaan desktop parsial berhasil, tetapi aksi hover/resize tidak tersedia pada kontrol browser alat; temuan Tema tidak direproduksi pada tes pointer lokal. Status tersebut tidak digabung dengan hasil Playwright. Akun/sesi pengujian dicabut dan adapter/tunnel dihentikan. Detail temuan, batas pemeriksaan, serta pembersihan ada di [laporan interaksi UI](testing/UI-INTERACTION-RESULTS.md).

Tidak ada migrasi atau perubahan transaksi. Seluruh integrasi MySQL dan backup/restore tidak diulang pada audit interaksi ini.
