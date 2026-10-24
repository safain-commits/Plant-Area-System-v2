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

## Perbaikan jaringan CI — 24 Oktober 2026

Run GitHub Actions [39988644093](https://github.com/safain-commits/Plant-Area-System-v2/actions/runs/39988644093) pada commit `384ec1e` gagal hanya di langkah **Gateway recovery after application IP changes**. Log runner menunjukkan Docker menolak `docker run --ip` karena jaringan menggunakan subnet otomatis, bukan subnet yang dikonfigurasi pengguna. Pada run yang sama, instalasi, typecheck/unit, integrasi MySQL, build, seluruh **16 tes browser**, restart/fail-closed, serta backup/restore sudah lulus.

Override pengujian yang dibuat `scripts/prepare-test.ts` sekarang mendeklarasikan IPAM subnet eksplisit. `scripts/test-gateway-recovery.ts` memeriksa konfigurasi dan jaringan aktif sebelum mengganti container; kedua container aplikasi stateless dihapus agar reservasi IP dilepas secara konsisten, kemudian dibuat ulang. Konfigurasi jaringan deployment produksi tidak berubah.

Verifikasi lokal aktual: typecheck root dan format file perubahan lulus; prepare mempertahankan kredensial yang ada; jaringan uji dibuat ulang tanpa menghapus volume MySQL. Jumlah akun/grant, batch/pemasangan Bag Filter, master/pergerakan material, serta total saldo stok sama sebelum dan sesudah proses. Tes recovery berhasil menempatkan dua sentinel pada IP lama, memberi IP baru kepada kedua aplikasi, dan memverifikasi dashboard JSON, halaman SSO, serta CSS/JS tanpa restart gateway. Akun fixture dan sentinel dibersihkan otomatis. Hasil lokal ini tidak menyatakan run CI perbaikan sudah lulus.

## Runbook VPS dan handover OpenClaw — 24 Oktober 2026

[Runbook tq-cmms.com](deployment/VPS-TQ-CMMS.md) dan [handover OpenClaw](deployment/OPENCLAW-HANDOVER.md) disiapkan untuk Nginx existing di host. Override VPS divalidasi dengan Compose: hanya 127.0.0.1:18080/18443 dipublikasikan, aplikasi/MySQL tetap tanpa host port, private network tetap internal, serta environment/resource/logging merge benar. Dua puluh empat blok Bash diperiksa dengan `bash -n`; dua blok Python dikompilasi dan generator environment dijalankan pada fixture tanpa mencetak rahasia.

Fixture Nginx lokal memverifikasi kedua template, HTTP ACME webroot, redirect HTTPS, preservasi path/query/Host, overwrite forwarded/identity headers, maintenance khusus domain, dan TLS upstream dengan verifikasi aktif. Certificate backend yang tidak dipercaya menghasilkan502; trust valid kembali menghasilkan200. Alamat upstream fixture disesuaikan ke backend container terpisah. Container/network fixture dibersihkan. Dokumentasi sumber Docker/Nginx/Certbot diperiksa melalui Context7 dan sumber primer.

Tidak melakukan SSH, instalasi Docker pada VPS pengguna, perubahan DNS, issuance Let's Encrypt, impor katalog, atau deploy publik. Tidak menjalankan ulang build aplikasi/tes bisnis pada perubahan dokumentasi dan konfigurasi opsional ini. Hasil ini tidak menjamin kapasitas VPS pada beban operasional; OpenClaw harus memverifikasi checkpoint di server tujuan.

## Penggantian master Consumables dari workbook perusahaan — 24 Oktober 2026

Workbook sumber diperiksa tanpa diubah. Seluruh 17.744 master unik divalidasi dan dry-run importer lulus. Sesuai keputusan pengguna, stok SAP dan nilai finansial diabaikan; lokasi, rak, serta isi pack tidak diasumsikan. Sebanyak 99 MRP Type kosong dipertahankan kosong. Tidak ada saldo atau transaksi sumber yang diimpor.

Setelah backup database Consumables diverifikasi, aplikasi tersebut dihentikan sementara dan data contoh diganti dalam satu transaksi MySQL tanpa reset schema atau menonaktifkan foreign key. Hasil akhir: 17.744 master, nol lokasi/inventory/pergerakan/idempotensi, satu catatan impor, dan satu audit provenance. Seluruh field master dicocokkan terhadap sumber; replay importer tidak menambah record. Jumlah record Auth dan Bag Filter tetap sama. Aplikasi Consumables berhasil dimulai kembali.

Verifikasi baca melalui HTTPS gateway mengambil seluruh katalog dalam 355 halaman API, memeriksa pencarian/detail tiga sampel, 13 kategori, dashboard kosong, serta ketiadaan stok dan transaksi. Chromium memverifikasi katalog dan pencarian pada desktop 1440 px dan mobile 390 px: tidak ada page error atau overflow horizontal. Akun verifikasi sementara dibersihkan. Tidak mencatat transaksi stok untuk pengujian ini.

Preview ditandai berisi data nyata dan mode pengujian dinonaktifkan. Prepare serta konfigurasi browser test terbukti menolak penanda tersebut, termasuk ketika flag pengujian dipaksakan; file environment tetap utuh. Prepare pada fixture direktori kosong tetap berhasil dan pengulangannya mempertahankan kredensial. Typecheck root, format file perubahan, serta pemeriksaan whitespace lulus. Pengujian bisnis berikutnya memerlukan deployment terpisah. Workbook, adapter, backup, dan bukti rinci tetap lokal serta diabaikan Git/Docker. Tidak menjalankan ulang suite integrasi/E2E bisnis atau backup/restore ke database aktif yang kini berisi master perusahaan.

## Impor riwayat Bag Filter 561/562 — 24 Oktober 2026

Workbook manual dua sheet ditelaah melalui nilai, format tanggal/warna, merge, serta render sumber tanpa mengubah file. Terdapat 192 baris riwayat. Sesuai konfirmasi pengguna, tabel riwayat diutamakan jika berbeda dari peta, hanya koordinat terverifikasi yang diimpor, dan rentang OH 12–17 Maret 2026 memakai 17 Maret pukul 00.00 WIB. Tanggal lain tanpa jam juga memakai 00.00 WIB; konvensi ini dicatat dalam provenance. Brand/Pabrikan dan WO yang tidak tercantum tidak diasumsikan.

Setelah aplikasi Bag Filter dihentikan sementara dan backup diperiksa gzip/schema/checksum, 498 batch/4.503 pemasangan uji 561 diganti dalam satu transaksi MySQL. Sebelumnya 562 kosong. Hasil: 561 mempunyai 42 batch/3.295 pemasangan dan 2.600 posisi dengan riwayat; 562 mempunyai 56 batch/5.109 pemasangan dan 3.213 posisi dengan riwayat. Seluruh equipment lain, katalog, serta koordinat dipertahankan dengan pemeriksaan checksum. Tidak mengubah data bisnis Auth atau Consumables.

Enam baris duplikat antar-tabel tidak dihitung sebagai transaksi tambahan; 88 baris belum terverifikasi ditahan dalam laporan privat dengan referensi sel sumber. Masalah mencakup koordinat parsial yang tertimpa pada peta, tanggal kosong, perbedaan peta/tabel, dan QTY yang tersimpan sebagai serial tanggal Excel. Peta aplikasi menunjukkan pemasangan terakhir yang berhasil diverifikasi; riwayat manual belum lengkap, sehingga umur berdasarkan catatan dapat berbeda dari kondisi fisik yang belum diklarifikasi.

Verifikasi baca melalui HTTPS gateway mencocokkan seluruh 98 batch dan 8.404 koordinat riwayat terhadap manifest, termasuk pagination, pencarian tanggal, tanggal OH, penggantian Oktober, timeline beberapa kali penggantian, serta grafik kuartal. Chromium memeriksa peta/riwayat pada desktop 1440 px dan mobile 390 px tanpa page error atau overflow halaman; screenshot ditinjau. Akun verifikasi sementara dibersihkan. Replay kontrak idempotensi dan pengulangan job ber-checkpoint tidak menggandakan data. Aplikasi kembali sehat setelah pembaruan.

Workbook, manifest, backup, dan laporan rinci tetap lokal serta diabaikan Git/Docker. Tidak menjalankan tes bisnis yang menulis ke data nyata, restore, migrasi schema, atau build ulang aplikasi pada pekerjaan data ini.

## Impor riwayat Bag Filter 421/422 dan L61/L62 — 24 Oktober 2026

Workbook empat sheet ditelaah melalui nilai, format, label koordinat, komentar, dan render sumber tanpa mengubah file. Seluruh 12.256 posisi sumber dipetakan dari format mendatar ke identitas koordinat aplikasi: 421/422 memakai A/B dan L61/L62 memakai Timur/Barat. Penanda beberapa nomor kejadian serta pemetaan CMF ke Cipta Medya dikonfirmasi pengguna. Sesuai keputusan pengguna, rincian kompartemen terverifikasi tetap diimpor ketika QTY total sumber berbeda; nilai asli dan selisih dipertahankan dalam audit/laporan privat. Tanggal memakai kolom DATE pukul 00.00 WIB, disimpan UTC. Brand yang tidak tercantum dan WO dibiarkan kosong.

Setelah backup Bag Filter diperiksa gzip/schema/checksum dan aplikasi dihentikan sementara, 76 batch/110 pemasangan uji L61/L62 diganti dalam satu transaksi MySQL; 421/422 sebelumnya kosong. Hasil impor: 421 mempunyai 13 batch/2.852 pemasangan dan 2.732 posisi ber-riwayat; 422 mempunyai 42 batch/3.151 pemasangan dan 2.830 posisi ber-riwayat; L61 mempunyai 5 batch/1.603 pemasangan dan 1.600 posisi ber-riwayat; L62 mempunyai 6 batch/965 pemasangan dan 963 posisi ber-riwayat. Kejadian besar dipecah maksimal 500 posisi, dan merek berbeda dipisahkan per batch. Tidak ada perubahan schema atau penonaktifan foreign key.

Dari 63 kejadian sumber, 53 mempunyai sedikitnya satu kompartemen terverifikasi. Sebanyak 78 entri pasangan kejadian–kompartemen ditahan untuk klarifikasi; enam entri jumlah nol tidak dibuat menjadi penggantian. Peta menunjukkan pemasangan terakhir yang terverifikasi, sehingga riwayat dan kondisi fisik belum dijamin lengkap. Laporan privat mencatat empat perbedaan total jumlah, koordinat parsial yang tidak cocok, keterangan sisi yang ambigu, serta marker peta di luar rincian tabel.

Verifikasi baca melalui HTTPS mencocokkan seluruh 66 batch dan 8.571 koordinat, waktu, brand, batas batch, snapshot, pencarian, timeline, pagination audit, serta total dan distribusi brand grafik Q1–Q4 tahun 2024/2025. Chromium memeriksa empat peta/riwayat pada desktop 1440 px dan mobile 390 px tanpa page error atau overflow halaman; screenshot ditinjau. Regresi API memastikan snapshot, ID batch, dan waktu pemasangan 561/562 tetap sama. Checksum data 561/562, katalog, serta koordinat tetap sama; tidak mengubah data bisnis Auth/Consumables. Akun verifikasi sementara dibersihkan. Aplikasi kembali sehat setelah pembaruan.

Workbook, manifest, backup, serta laporan rinci tetap lokal dan diabaikan Git/Docker. Tidak menjalankan suite bisnis yang menulis ke data nyata, restore, migrasi schema, atau build ulang aplikasi pada pekerjaan data ini.

## Impor tambahan riwayat Bag Filter 2026 — 24 Oktober 2026

Workbook empat sheet diperiksa tanpa diubah melalui nilai, format, merge, formula, label koordinat, dan render sumber. Tujuh kejadian ditemukan pada 421, 422, serta L62; sheet L61 hanya mempunyai header dan peta kosong. Seluruh 12.256 posisi sumber dipetakan ke konfigurasi aplikasi. Penempatan judul kompartemen merged pada sheet 422 berbeda dari baris header angka; pemetaan memakai urutan angka dan label A–H yang diverifikasi, bukan mengasumsikan baris judul sebagai header. Formula QTY L62 `128*4` cocok dengan empat kompartemen penuh. Kolom Budget/OPEX pada 422 tidak dibaca sebagai kejadian.

Sesuai keputusan pengguna sebelumnya, tanggal dan rincian kompartemen tabel diutamakan; rincian terverifikasi tetap diimpor meskipun total QTY berbeda. Penggantian parsial memerlukan jumlah koordinat peta yang cocok tepat; penggantian penuh memakai kapasitas eksplisit. Nomor kejadian dibedakan berdasarkan workbook/tahun. Tanggal tanpa jam memakai 00.00 WIB, disimpan UTC; brand yang tidak tercantum tetap null dan WO kosong. Tiga perbedaan QTY total dan lima rincian kompartemen yang belum terverifikasi dicatat dalam laporan privat; marker di luar rincian tabel tidak ditambahkan berdasarkan asumsi.

Preflight tidak menemukan benturan tanggal/koordinat dengan data berjalan. Setelah Bag Filter dihentikan sementara dan backup diperiksa gzip/schema/checksum, satu transaksi MySQL hanya menambahkan sembilan batch, 1.889 pemasangan, sembilan audit, serta checkpoint. Tidak ada penghapusan, pembaruan transaksi lama, perubahan schema, maupun penonaktifan foreign key. Tambahan: 421 satu batch/14 pemasangan; 422 enam batch/1.363 pemasangan; L62 dua batch/512 pemasangan; L61 tidak berubah. Seluruh 164 batch/16.975 pemasangan lama beserta audit, checkpoint, katalog, dan koordinat tetap sama berdasarkan checksum sebelum/sesudah.

Hasil akhir lokal: 421 mempunyai 14 batch/2.866 pemasangan dan 2.738 posisi ber-riwayat; 422 mempunyai 48 batch/4.514 pemasangan dan 3.813 posisi ber-riwayat; L61 tetap 5 batch/1.603 pemasangan dan 1.600 posisi ber-riwayat; L62 mempunyai 8 batch/1.477 pemasangan dan 1.219 posisi ber-riwayat. Riwayat 561/562 tidak berubah. Total enam equipment menjadi 173 batch/18.864 catatan pemasangan; pemasangan berulang pada posisi yang sama bukan posisi tambahan.

Verifikasi aktual melalui HTTPS gateway mencocokkan seluruh sembilan batch baru dan 1.889 koordinat, 164 batch lama, snapshot keenam equipment, pencarian riwayat 2026, timeline sebelum/sesudah, pagination audit, serta jumlah dan distribusi brand grafik kuartal 2024/2025/2026. Chromium memeriksa empat peta/riwayat pada desktop 1440 px dan mobile 390 px tanpa page error atau overflow halaman; screenshot ditinjau. Request tulis Bag Filter diblokir selama pemeriksaan browser; akun verifikasi sementara dibersihkan. Replay kontrak seluruh batch baru dan pengulangan job ber-checkpoint tidak menambah data. Bag Filter kembali sehat setelah impor.

Workbook, manifest, backup, dan laporan `tmp/BAG-2026-IMPORT-REVIEW.md` tetap lokal dan diabaikan Git/Docker. Riwayat yang tertahan belum tercakup sehingga data manual belum dinyatakan lengkap. Tidak menjalankan reset, suite bisnis, restore, migrasi schema, atau build ulang aplikasi pada pekerjaan data ini. Tidak melakukan deployment atau pemindahan database ke VPS.

## Konfirmasi penggantian total 422-BF1 Comp. 3A — 24 Oktober 2026

Permintaan langsung pengguna mengonfirmasi penggantian total 136 bag Comp. 3A pada 22 Juli 2024. Preflight tidak menemukan riwayat pada kompartemen tersebut ataupun benturan tanggal/koordinat. Posisi A1–H17 divalidasi terhadap konfigurasi equipment. Tanggal tanpa jam memakai 00.00 WIB, disimpan sebagai `2024-07-21T17:00:00.000Z`; Brand/Pabrikan tidak diasumsikan dan WO kosong. Provenance mencatat sumber konfirmasi pengguna, bukan workbook.

Setelah backup Bag Filter diperiksa gzip/schema/checksum dan aplikasi dihentikan sementara, satu transaksi MySQL menambahkan satu batch, 136 pemasangan, satu audit, serta checkpoint. Seluruh riwayat/audit lama, checkpoint lama, katalog, dan koordinat tetap sama berdasarkan checksum. API HTTPS memverifikasi batch, pencarian, snapshot, dan timeline seluruh 136 posisi; retry kontrak batch tidak menambah data. Akun verifikasi sementara dibersihkan dan Bag Filter kembali sehat. Tidak mengubah data bisnis Auth/Consumables atau menjalankan reset, build, restore, maupun suite tes bisnis.

Hasil lokal: 422-BF1 menjadi 49 batch/4.650 pemasangan dengan 3.949 posisi ber-riwayat; total enam equipment 174 batch/19.000 pemasangan. Konfirmasi tanggal 2024 ini tidak menyelesaikan marker kejadian 2026 yang belum terverifikasi. Laporan `tmp/BAG-422-3A-20240722-REVIEW.md` serta backup/bukti tetap privat dan lokal.

## Konfirmasi penggantian total 422-BF1 Comp. 10B — 24 Oktober 2026

Konfirmasi langsung pengguna menambahkan penggantian penuh 136 bag Comp. 10B pada 16 Oktober 2023. Preflight memastikan tidak ada duplikasi tanggal/koordinat; posisi A1–H17 divalidasi. Tanggal tanpa jam memakai 00.00 WIB (`2023-10-15T17:00:00.000Z`), brand belum tercatat dan WO kosong. Provenance menyimpan sumber konfirmasi pengguna.

Setelah backup diperiksa gzip/schema/checksum dan Bag Filter dihentikan sementara, satu batch, 136 pemasangan, satu audit, dan checkpoint ditambahkan dalam satu transaksi. Seluruh riwayat/audit lama, checkpoint lama, katalog, serta koordinat tetap sama berdasarkan checksum. API HTTPS memverifikasi batch, pencarian tanggal, snapshot, timeline seluruh 136 posisi, dan grafik Q4 2023. Lima pemasangan parsial yang lebih baru pada 2024–2026 tetap menjadi kondisi terkini; 131 posisi lainnya memakai pemasangan 2023. Retry kontrak dan pengulangan job ber-checkpoint tidak menambah data. Akun verifikasi sementara dibersihkan dan aplikasi kembali sehat.

Hasil lokal: 422-BF1 menjadi 50 batch/4.786 pemasangan dengan 4.080 posisi ber-riwayat; total enam equipment 175 batch/19.136 pemasangan. Cakupan seluruh posisi bukan bukti kelengkapan seluruh kejadian historis; entri tertahan tetap belum terselesaikan. Laporan `tmp/BAG-422-10B-20231016-REVIEW.md`, manifest, serta backup/bukti tetap privat. Tidak mengubah data bisnis Auth/Consumables atau menjalankan reset, build, restore, maupun suite tes bisnis.

## Impor tambahan riwayat Bag Filter 2023 — 24 Oktober 2026

Workbook empat sheet dibaca tanpa diubah, melalui nilai, format, merge, formula, tabel riwayat, label koordinat, dan render sumber. Seluruh 12.256 posisi sumber dipetakan ke konfigurasi aplikasi; 20 kejadian operasional ditemukan. Baris 422 No. 3 hanya berisi nomor dan tidak dianggap kejadian. Formula QTY 421 `49+28` cocok dengan cached value dan perhitungan independen 77; tidak ditemukan sel error Excel. Nomor kejadian dipisahkan berdasarkan workbook/tahun.

Pengguna mengonfirmasi tanggal selesai untuk rentang pekerjaan, serta dua koreksi label sumber: L61 No. 2 `19(67)` menjadi Comp. 10(67); 421 No. 4 `8A(1)` yang kedua menjadi 8B(1). Label dan rentang asli tetap dalam provenance. Tanggal tanpa jam memakai 00.00 WIB, disimpan UTC. Brand Filtras hanya diterapkan pada 65 pemasangan terverifikasi yang dirujuk catatan Filtras; OEM Intensive pada sepuluh kompartemen penuh 421 menjadi 1.360 pemasangan Intensiv filter (Original). Sebanyak 1.831 pemasangan lain tidak diasumsikan brand-nya; WO tetap kosong.

Setelah backup diperiksa gzip/schema/checksum dan Bag Filter dihentikan sementara, transaksi awal menambahkan 25 batch/3.175 pemasangan/25 audit impor, satu audit tautan sumber, serta checkpoint. Penggantian penuh 136 bag 422 Comp. 10B tanggal 16 Oktober 2023 sudah ada dari konfirmasi pengguna sebelumnya: batch/ID/actor/alasan/pemasangan lama tetap utuh, hanya mendapat audit tautan ke sumber Excel. Setelah jawaban koreksi diterima, backup terpisah dan transaksi lanjutan menambahkan dua batch/81 pemasangan/dua audit serta checkpoint lain. Tidak ada reset, penghapusan, perubahan schema, atau penonaktifan foreign key.

Verifikasi retry pertama menemukan empat kunci idempotensi bermerek Original mengandung karakter yang tidak diterima kontrak. Catatan telah committed; hanya empat kunci milik impor baru dinormalisasi dalam transaksi perbaikan, tanpa mengubah ID, request hash, tanggal, brand, atau koordinat. Manifest dan generator diperbaiki. Retry seluruh batch dan pengulangan job kemudian lulus tanpa duplikasi. Seluruh 175 batch/19.136 pemasangan lama, audit lama, checkpoint lama, katalog, serta koordinat tetap sama berdasarkan checksum sebelum/sesudah; transaksi awal juga dipertahankan saat penambahan koreksi.

Tambahan akhir: 421 sebanyak 15 batch/1.970 pemasangan; 422 dua batch/131 pemasangan; L61 delapan batch/727 pemasangan; L62 dua batch/428 pemasangan. Total tambahan 27 batch/3.256 pemasangan; database enam equipment menjadi 202 batch/22.392 pemasangan. Snapshot akhir: 421 memiliki 3.944 posisi ber-riwayat; 422 sebanyak 4.080; L61 sebanyak 1.986; L62 sebanyak 1.254. Snapshot 561/562 dan semua pemasangan yang lebih baru tetap sesuai tanggal pemasangannya. Tujuh belas rincian berjumlah 112 bag menurut sumber belum terverifikasi, dan enam perbedaan QTY total dicatat dalam laporan privat; riwayat belum dinyatakan lengkap.

Pemeriksaan HTTPS API mencocokkan seluruh 27 batch baru/3.256 koordinat dan brand, 175 batch lama, snapshot keenam equipment, pencarian, pagination history/audit, timeline penggantian berulang, serta grafik kuartal dan distribusi brand tahun 2023/2024/2025/2026. Seluruh 81 timeline posisi dari dua koreksi pengguna diperiksa termasuk tanggal berakhirnya pemasangan. Grafik tidak menghitung ulang 136 pemasangan duplikat 10B. Chromium memeriksa empat peta/riwayat pada desktop 1440 px dan mobile 390 px tanpa page error atau overflow halaman; screenshot ditinjau. Request tulis Bag Filter diblokir saat pemeriksaan browser; akun verifikasi sementara dibersihkan. Bag Filter kembali sehat.

Workbook, manifest, dua backup, bukti perbaikan kunci, dan laporan `tmp/BAG-2023-IMPORT-REVIEW.md` tetap lokal dan diabaikan Git/Docker. Tidak mengubah data bisnis Auth/Consumables atau menjalankan reset, suite tes bisnis, build ulang aplikasi, migrasi schema, restore, maupun deployment VPS pada pekerjaan data ini.

## Penyiapan migrasi database lokal ke VPS — 24–25 Oktober 2026

Pemilik mengonfirmasi project belum dipasang di VPS. Panduan baru memakai target kosong, logical dump tiga database, release/MySQL image yang dipin, pembekuan penulis sumber, transfer privat, perbandingan fingerprint sebelum migrator, rekonsiliasi, pencabutan sesi hanya pada target, serta satu database penulis setelah cutover. Runbook VPS dan handover instalasi kosong diberi cabang restore tanpa bootstrap/impor ulang.

Snapshot read-only database lokal pukul 23.40 WIB pada MySQL 8.4.13 mencatat 46 akun/48 grant; enam equipment/18.784 koordinat; 205 batch/22.529 pemasangan/206 audit Bag Filter; serta 17.744 master/3 lokasi/1 inventory/2 pergerakan/7 audit/2 idempotensi Consumables. Ini baseline pemeriksaan, bukan paket final cutover; snapshot sumber final harus dibuat kembali setelah penulis dihentikan. File baseline privat berada di `.test-runtime/database-transfer-baseline.json`.

Pemeriksaan yang dijalankan:

- Root TypeScript `tsc --noEmit` memakai Node.js 26.12.1 lulus untuk alat snapshot dan source project.
- Alat `database-backup.mjs` dan `database-snapshot.ts` diuji dengan dua instance MySQL 8.4 terpisah, memakai fixture sintetis dan kredensial target berbeda. Dump gzip dipulihkan; fingerprint seluruh tabel/schema cocok. BIGINT di atas batas integer JavaScript, DECIMAL enam angka, UTC milidetik, dan Unicode dipertahankan. Kredensial runtime baru target tetap berfungsi.
- Output backup existing ditolak. Capture menolak orphan foreign key yang sengaja dibuat hanya pada fixture. Perbandingan biasa menolak pengosongan sesi; mode `--after-session-revoke` hanya menerima tiga tabel Auth sementara menjadi kosong dan tetap menolak perubahan fingerprint akun. Container fixture dibersihkan. Bukti privat: `.test-runtime/database-transfer-validation/5e223fd2/result.json`.
- Sebanyak 32 blok Bash diperiksa dengan `bash -n` pada container tanpa jaringan/database, empat blok PowerShell diperiksa parser tanpa dieksekusi, tiga blok Python dikompilasi tanpa dieksekusi, dan 13 tautan lokal dokumentasi deployment ditemukan. Bukti privat: `.test-runtime/database-doc-validation-result.json`.

Tidak menjalankan freeze sumber final, dump data perusahaan untuk cutover, transfer SSH, restore ke database nyata, migrasi schema, suite bisnis/E2E, build ulang aplikasi, perubahan DNS atau deployment VPS pada pekerjaan ini. Keberhasilan fixture bukan bukti restore seluruh data perusahaan di VPS. Status publikasi, penerimaan login, backup offsite, dan RTO/RPO VPS tetap harus dibuktikan saat eksekusi OpenClaw/pemilik.
