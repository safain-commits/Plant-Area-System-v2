# Laporan perbaikan UI Portal dan Consumable Room

Tanggal: 7 November 2026 (WIB). Acuan: [audit UI](../../design/UI-AUDIT-PORTAL-CONSUMABLES.md), PRD v2, PRD R22, dan skill `apple-design`.

**Selesai: seluruh 38 temuan telah ditangani dalam lima fase; suite penerimaan akhir lulus.**

Working tree awal bersih pada `2633b1c`; tidak ada perubahan pengguna yang ditimpa. Perubahan tidak menyentuh validasi server, transaksi database, kontrak endpoint, role, atau scope. Metadata ikon katalog ditambahkan sesuai A3. Seluruh data pengujian dan gambar memakai akun/material sintetis pada deployment terpisah `plant-v2-test`, HTTPS localhost:8443 dan MySQL localhost:13306. Database development tidak dipakai suite pengujian.

## Temuan dan commit

| Fase                             | Commit                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| F1 — fondasi token               | `9b2532c` — `style(ui): establish accessible typography spacing and data tokens`   |
| F2 — interaksi bersama           | `9fbd304` — `fix(ui): make overlays reversible and gestures momentum aware`        |
| F3 — Portal                      | `122995a` — `feat(portal): replace duplicate dashboards with an operational hub`   |
| F4 — Consumable Room             | `2977f51` — `fix(consumables): refine stock workflows sheets and reversible carts` |
| F5 — CSS, verifikasi dan laporan | Commit laporan ini: `fix(ui): finalize audited styles and navigation behavior`     |

| ID  | Status dan implementasi                                                                                                                                                                                         | Commit     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A1  | Selesai. Panel Aksi cepat biasa; Portal tidak merender widget promosi/tilt.                                                                                                                                     | F3, F4     |
| A2  | Selesai. Satu penanda aplikasi sentence case pada heading; eyebrow kartu dihapus.                                                                                                                               | F3, F4     |
| A3  | Selesai. Ikon SVG, metadata ikon katalog, badge hanya untuk pengecualian.                                                                                                                                       | F3         |
| A4  | Selesai. Roadmap berupa satu baris teks tanpa kartu, mempertahankan ketentuan PRD.                                                                                                                              | F3         |
| A5  | Selesai. Satu status chart, tooltip definisi hitungan, label grup KPI, progres dan saldo belum dihitung digabung.                                                                                               | F4         |
| A6  | Selesai. Deskripsi menjelaskan tugas setiap section.                                                                                                                                                            | F4         |
| A7  | Selesai. Teks audit diganti skeleton/empty state dengan ellipsis yang benar.                                                                                                                                    | F4         |
| B1  | Selesai. Transisi simetris, fallback `data-closing`, konten keluar dipertahankan lalu dilepas, fokus setelah penutupan. Draft anak dimulai kembali saat dibuka; dialog yang menolak penutupan tetap terjangkau. | F2, F5     |
| B2  | Selesai. Origin mengikuti posisi anchor dan clamp viewport; mobile memakai bottom center.                                                                                                                       | F2         |
| B3  | Selesai. Lima sampel, velocity/projection, hysteresis, capture, rAF/ref, rubber-band, dan spring kritis tanpa dependency.                                                                                       | F2, F4, F5 |
| B4  | Selesai. Scale opt-in untuk kontrol kecil; daftar memakai highlight background.                                                                                                                                 | F2         |
| B5  | Selesai. Hanya query teks didebounce; filter/pagination langsung fetch dan mempertahankan daftar lama. Diuji dengan timer browser dibekukan.                                                                    | F4         |
| B6  | Selesai. Pilihan (b), `ShellSkeleton`, digunakan Portal/R22; chrome dan main mempunyai nama view transition terpisah.                                                                                           | F2         |
| B7  | Selesai. Nilai final pada mount, perubahan dari nilai presentasi saat ini maksimal 300 ms.                                                                                                                      | F2         |
| B8  | Selesai. Banner inline hanya fade 140 ms.                                                                                                                                                                       | F2         |
| B9  | Selesai. Highlight/scroll baris baru dan toast Urungkan lima detik. Undo hanya memulihkan baris, bukan field dokumen.                                                                                           | F4         |
| B10 | Selesai. Grid/lebar berpindah sekali; tidak ada animasi properti layout. Pengukuran CDP di bawah.                                                                                                               | F2, F5     |
| B11 | Selesai. Reduced transparency/contrast memakai surface solid tanpa blur dan border lebih jelas.                                                                                                                 | F1, F5     |
| B12 | Selesai. Shake dibatasi pada form yang pernah disubmit; shortcut memakai simbol macOS bila sesuai perangkat.                                                                                                    | F2, F4     |
| C1  | Selesai. Font sistem, tanpa resource font eksternal.                                                                                                                                                            | F1         |
| C2  | Selesai untuk Portal/R22. Tujuh token ukuran rem, minimum caption 12 px pada root default. Geometri teks peta Bag Filter dipertahankan.                                                                         | F1, F5     |
| C3  | Selesai. Root 100%, ukuran/leading relatif; diuji pada root 200%.                                                                                                                                               | F1, F5     |
| C4  | Selesai. Ringkasan dokumen memakai judul, `dl`, dan tombol primer; tidak ada angka item display.                                                                                                                | F4         |
| C5  | Selesai. Angka rata kanan/tabular, satuan sekunder, status belum dihitung berupa badge netral.                                                                                                                  | F4         |
| C6  | Selesai. Label jumlah/simpan/peringatan dan label form dilokalkan; nama dokumen resmi tetap dipakai.                                                                                                            | F4, F5     |
| D1  | Selesai. Hub dengan perhatian kondisional dan kartu simetris; tanpa chart besar atau grid aplikasi berulang.                                                                                                    | F3         |
| D2  | Selesai. Semua detail daftar memakai sheet; penanda terpilih dan panah atas/bawah tersedia. Permintaan detail lama dibatalkan.                                                                                  | F4         |
| D3  | Selesai. Bilah simpan tetap terlihat di bawah 1024 px, dapat membungkus pada layar kecil/teks besar.                                                                                                            | F4, F5     |
| D4  | Selesai. Breakpoint aplikasi dinormalisasi dan container query dipakai pada tabel/keranjang/chart. Breakpoint geometri peta tetap dipertahankan.                                                                | F5         |
| D5  | Selesai. TableSkeleton dan EmptyState dipakai pada tabel/keranjang R22.                                                                                                                                         | F2, F4     |
| D6  | Selesai. Aksi Penerimaan baru pada slot heading Riwayat.                                                                                                                                                        | F4, F5     |
| E1  | Selesai. Spacing komponen terkait teks memakai token rem; nilai khusus geometri peta dipertahankan.                                                                                                             | F1, F5     |
| E2  | Selesai. Ritme 32 px antarkartu dan 48 px antarseksi; container merespons ukuran teks.                                                                                                                          | F3, F5     |
| E3  | Selesai. 235 deklarasi tertimpa dan 40 rule kosong dihapus; 241 rule aktif dipindahkan dari legacy ke file komponen. Cascade menggunakan layer eksplisit.                                                       | F5         |
| F1  | Selesai. Seri ink/abu-abu/lime tunggal dengan hatch, outline, ikon dan tanda arah.                                                                                                                              | F1, F4     |
| F2  | Selesai. Batas/hatch data mempunyai kontras ≥3:1; fill abu-abu terang dibedakan melalui batas, bukan fill saja.                                                                                                 | F1, F4     |
| F3  | Selesai. Aksen dekoratif dan lavender Portal dihapus; peringatan memakai warna semantik.                                                                                                                        | F3, F4     |
| F4  | Selesai. Asterisk merah dihapus, required native dipertahankan, field opsional diberi keterangan.                                                                                                               | F4, F5     |

## Gambar dan interaksi

Matriks wajib lengkap: enam halaman × empat lebar (375, 768, 1280, 1536 px) × dua tema. Tersedia tambahan delapan gambar per fase untuk Bag Filter dan Auth, sehingga total **64 sebelum + 64 sesudah**. Setiap nama gambar mempunyai pasangan yang sama pada kedua folder.

| Halaman       | Sebelum                                                | Sesudah                                               |
| ------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| Portal        | [1280 terang](before/portal-1280-light.png)            | [1280 terang](after/portal-1280-light.png)            |
| Ringkasan R22 | [1280 terang](before/consumables-1280-light.png)       | [1280 terang](after/consumables-1280-light.png)       |
| Cari material | [1280 terang](before/consumables-stock-1280-light.png) | [1280 terang](after/consumables-stock-1280-light.png) |
| Consume Order | [375 terang](before/consumables-consume-375-light.png) | [375 terang](after/consumables-consume-375-light.png) |
| Picklist      | [375 gelap](before/consumables-picklist-375-dark.png)  | [375 gelap](after/consumables-picklist-375-dark.png)  |
| Riwayat       | [1280 gelap](before/consumables-history-1280-dark.png) | [1280 gelap](after/consumables-history-1280-dark.png) |
| Bag Filter    | [1280 terang](before/bag-filter-1280-light.png)        | [1280 terang](after/bag-filter-1280-light.png)        |
| Auth          | [375 gelap](before/auth-login-375-dark.png)            | [375 gelap](after/auth-login-375-dark.png)            |

Matriks penuh: [folder sebelum](before/) dan [folder sesudah](after/). Skrip reproduksi: `node --env-file=.test-runtime/host.env --import tsx scripts/capture-ui-audit.ts after`. Argumen `before` dipakai pada source awal sebelum perubahan; jangan menimpa baseline yang tersimpan. Skrip menolak deployment selain test localhost:8443 dan marker data nyata.

[Video gesture drawer](media/drawer-gesture.webm) memperlihatkan rubber-band, pembalikan drag, serta flick pendek untuk menutup. Tes memakai input touch Chromium melalui CDP, bukan hanya event pointer sintetis. Utilitas momentum juga mempunyai unit test.

Layout dashboard penuh, feature widget dan warna/koordinat peta Bag Filter dipertahankan. Perubahan visual global yang disengaja adalah font sistem, token tipe/leading/spacing/radius dan fallback overlay. `map.css` hanya dibungkus layer; skala umur, seleksi double ring, dan geometri peta tetap sama. Nama eyebrow/header Bag Filter tidak diubah. Pemeriksaan AST memastikan seluruh deklarasi 192 rule peta dan 10 rule brand tetap identik setelah normalisasi whitespace: [preservation.json](measurements/preservation.json). Lingkungan screenshot memakai Next development, sehingga indikator development dapat terlihat.

## Pengukuran dan validasi

Pengukuran awal rAF collapse pada 1280 px mencatat maksimum 33,3 ms di Portal dan 16,8 ms di R22. Karena melewati 16 ms, interpolasi grid/lebar dihapus. Trace DevTools melalui CDP setelah perubahan mencatat masing-masing **satu** event Layout: Portal 0,290 ms, R22 0,366 ms, dengan durasi transisi shell dan sidebar 0 detik. Data ringkas: [sidebar.json](measurements/sidebar.json). Ini adalah waktu Layout pada mesin uji; bukan klaim bahwa seluruh frame selalu di bawah 16 ms.

- Typecheck seluruh workspace (`pnpm typecheck`): lulus.
- Unit (`pnpm test`): **34 lulus**.
- Format: `pnpm format:check` lulus; repo tidak menyediakan script lint terpisah.
- E2E akhir (`pnpm exec playwright test`): **41 lulus dalam 11,5 menit**, satu eksekusi penuh pada kode akhir.
- Root 200%: Portal, dashboard, stok, Consume Order dan Picklist, 375/1280 px, kedua tema; termasuk keranjang 20 baris. Lulus dalam suite akhir.
- Reduced motion, reduced transparency, dan contrast more: diuji melalui DevTools CDP dan `matchMedia`, surface overlay solid/tanpa blur; lulus dalam suite akhir.
- Kontrak perhitungan kuartal, role/scope, persistensi draft, SAP → R22, idempotency dan cetak diuji oleh suite yang ada.

Saat verifikasi ditemukan dan diperbaiki: overflow font mobile, native pointer cancel pada container scroll drawer, state anak overlay yang tertahan sesudah tutup, serta tes yang mengisi input di belakang dialog sebelum animasi keluar berakhir. Helper select kini menunggu opsi tertutup. Tes konfirmasi R22 diselaraskan dengan label semantik yang sudah ada pada commit awal; pencarian memilih hasil yang cocok setelah daftar dipertahankan. Tidak ada assertion transaksi atau izin yang dilonggarkan. Assertion lokasi stok dibuat tepat pada nama field `Lokasi`, agar tidak keliru menolak label HAC/SAC / Lokasi fungsional.

Aplikasi pengujian berjalan dengan Node 26.12.1 pada Docker; CLI host menggunakan Node 24.22.2 dan pnpm 12.14.0. Browser yang diuji adalah Chromium. Fallback browser tanpa discrete transitions terimplementasi; Safari/Firefox dan perangkat sentuh fisik belum diuji.

Sesudah verifikasi, seluruh service `plant-v2-test` dihentikan tanpa menghapus volume. Empat aplikasi development diaktifkan kembali dan seluruh healthcheck sehat. Template gateway development dirender ulang dan lolos `nginx -t`; `https://localhost:9443/auth/login` kembali merespons HTTP 200.

Kontras batas/hatch terhadap surface: minimum **5,14:1** pada tema terang dan **12,32:1** pada tema gelap. Teks utama/sekunder terhadap surface: minimum **9,29:1** terang dan **12,32:1** gelap. Hasil token aktual: [contrast.json](measurements/contrast.json).

Navigasi RSC juga diuji. Header framework dari permintaan halaman sebelumnya ikut masuk ke subrequest Auth, membuat Next mengembalikan 307 pada `/auth/internal/verify`, lalu diterjemahkan gateway menjadi 503. Tiga subrequest kini hanya meneruskan header cookie/token/aplikasi/URI yang ditetapkan eksplisit; pemeriksaan sesi dan izin tetap sama. Reproduksi lokal sebelum perbaikan: HTML 200, RSC 503; sesudah: HTML 200, RSC 200 `text/x-component`. Tes mencakup Portal, Bag Filter, dan R22. Saat dirilis, service Nginx perlu dibuat ulang agar entrypoint merender template baru; `nginx -s reload` saja tidak menjalankan envsubst. Tidak ada deployment produksi yang dilakukan.

## Keputusan

Tidak ada keputusan yang menunggu persetujuan: font sistem adalah pilihan yang diizinkan audit, roadmap diringkas sesuai PRD, seri data mengikuti ink/abu-abu/lime yang diusulkan, dan tidak ada dependency baru. ShellSkeleton dipilih agar perubahan navigasi terbatas pada fallback. Tidak ada perubahan masa sesi delapan jam atau UI sesi tambahan.

---

## Follow-up 8 November

Tanggal: 8 November 2026 (WIB). Acuan: [UI Follow-up — Font Inter, Sidebar, Portal, dan Posisi Menu](../../design/UI-FOLLOWUP-FONT-PORTAL-MENU.md).

### Urutan commit

| Urutan | Commit                                                                   | Ringkasan                                                                                                                                                                                                                                                                                                 |
| ------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | `aadfe58` — `fix(ui): anchor header menus to their triggers`             | Penempatan menu header `placement="bottom-end"`, pengukuran `offsetWidth`/`offsetHeight` sebelum transisi, batas jepit `clientWidth`/`visualViewport`, lebar 380 px dengan fade scroll internal pada menu Aktivitas, dan durasi 140 ms / 100 ms (§4 M1–M6).                                               |
| 2      | `7ff6364` — `style(ui): self-host Inter and normalize type weights`      | Self-host Inter v4.1 variable (`InterVariable.woff2`), token `--font-sans` dan `--weight-regular/medium/semibold`, normalisasi bobot 600 → 500 pada kontrol/nav/KPI, kalibrasi `letter-spacing`, `.code-text` (`'ss02', 'tnum'`), kesiapan font cetak R22, serta perbaikan label sidebar S1–S2 (§1 & §2). |
| 3      | `d0f3b9c` — `feat(contracts): add portal summary contract and endpoints` | Kontrak `PortalSummary` & `PortalTone` di `@plant/contracts`, ikon `drawing`/`rca`/`cost` di `appCatalog` & `icon.tsx`, endpoint ringan `GET /bag-filter/api/portal-summary` & `GET /consumables/api/portal-summary`, serta pengujian izin dan scope (§3).                                                |
| 4      | Commit ini — `feat(portal): render hub from app catalog`                 | Hub Portal berbasis `appCatalog` (`PortalHub` & `PortalAppCard`), fetch paralel ber-timeout 5 detik dengan isolasi error per kartu, bar sinyal komposisi 8 px, aksi utama sesuai role, blok **Perlu perhatian** persisten, tile **Segera hadir**, dan feed gabungan di rail kanan 360 px (§3).            |

### Status per ID

| ID          | Status dan verifikasi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Commit              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| Font (§1)   | **Selesai.** `InterVariable.woff2` (v4.1 resmi, lisensi SIL OFL 1.1) di-host di `packages/ui/assets/fonts/InterVariable.woff2` (**352.240 byte / 344,0 KiB**, di bawah batas 400 KB) dan dimuat melalui `next/font/local` (`--font-inter`, `display: 'swap'`, `weight: '100 900'`) pada `portal`, `auth`, `bag-filter`, dan `consumables` dengan basePath masing-masing (`/`, `/auth`, `/bag-filter`, `/consumables`, HTTP 200 immutable, 0 request eksternal). Terverifikasi `status: "loaded"` di Chromium dan WebKit. Bobot dinormalisasi ke 400/500/600, `.code-text` memakai `'ss02', 'tnum'`, dan `PrintButton` menunggu `await document.fonts?.ready`.                                                            | `7ff6364`           |
| S1 (§2)     | **Selesai.** `.sidebar-nav-item > .sidebar-nav-link` memakai `font-size: var(--type-body)` (14 px) dan `font-weight: var(--weight-medium)` (500), sedangkan `.nav-tree-row` memakai `14 px` dan `--weight-regular` (400). Diuji di Chromium dan WebKit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `7ff6364`           |
| S2 (§2)     | **Selesai.** Empat deklarasi legacy `.sidebar` bertema gelap yang sudah tidak aktif di `workspace.css` dihapus; tema terang dan gelap tidak berubah.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `7ff6364`           |
| Portal (§3) | **Selesai.** Portal membaca aplikasi aktif dan rencana dari `appCatalog`, memanggil satu `GET /<app>/api/portal-summary` per aplikasi aktif secara paralel (0 panggilan `/api/dashboard` dari Portal) dengan timeout 5 detik dan tombol **Coba lagi** terisolasi per kartu. `PortalAppCard` merender 1–3 KPI tabular, garis sinyal komposisi 8 px (`--age-*` / `--series-*` dengan pemisah 2 px warna surface dan kontras non-teks ≥ 5,05:1 terang / ≥ 11,8:1 gelap), aksi utama sesuai role (disembunyikan untuk viewer), dan tautan aplikasi. Pada 1280×800 dengan 2 aplikasi aktif, seluruh hub tampil tanpa scroll vertikal (`scrollHeight <= 800`). Diuji dengan route mock untuk 0, 1, 2, 3, dan 5 aplikasi aktif. | `d0f3b9c`, Commit 4 |
| M1 (§4)     | **Selesai.** Menu header memakai `placement="bottom-end"`. Pada 1536 px: menu Aktivitas (`left: 1126`, `right: 1506`) sejajar pemicu lonceng (`right: 1506`), dan menu Akun (`left: 1192`, `right: 1512`) sejajar chip akun (`right: 1512`) — tidak lagi bertumpuk di `x = 1208`. `--anchor-origin` dihitung dalam piksel dari titik tengah pemicu (`330px 0px` untuk Aktivitas, `198px 0px` untuk Akun).                                                                                                                                                                                                                                                                                                                | `aadfe58`           |
| M2 (§4)     | **Selesai.** Ukuran menu diukur menggunakan `offsetWidth`/`offsetHeight` sebelum atribut `data-entering` dilepas, sehingga skala masuk `0.96` tidak memotong hasil pengukuran.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `aadfe58`           |
| M3 (§4)     | **Selesai.** Batas jepit memakai `document.documentElement.clientWidth`/`clientHeight` (dan `visualViewport`), diuji pada lebar 1024, 1280, dan 1536 px termasuk dengan simulasi scrollbar klasik 17 px (`padding-right: 17px`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `aadfe58`           |
| M4 (§4)     | **Selesai.** Menu Akun memakai `min-width: max(var(--trigger-width), 260px)`, menu Aktivitas memakai lebar 380 px dan `max-height: min(480px, calc(100dvh - var(--menu-top) - 16px))` dengan `.scroll-fade`, serta posisi dihitung ulang saat `resize`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `aadfe58`           |
| M5 (§4)     | **Selesai.** `.overlay-menu` memakai `--duration-fast` (140 ms) saat masuk dan `100ms` saat keluar dengan `--ease-standard`, tanpa deklarasi `animation-duration` yatim.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `aadfe58`           |
| M6 (§4)     | **Ditunda dan dicatat (sesuai pedoman M6).** `showModal()` dipertahankan karena kontrak interaksi `tests/e2e/ui-interactions.spec.ts:244` mengandalkan backdrop modal saat klik di luar menu di atas tombol halaman lain agar tidak langsung memicu aksi tombol di belakangnya. Fokus keyboard, Escape, dan pengembalian fokus tetap lulus di Chromium dan WebKit.                                                                                                                                                                                                                                                                                                                                                       | `aadfe58`           |

### Pengukuran font, CLS, dan posisi menu

- **Ukuran file font**: `packages/ui/assets/fonts/InterVariable.woff2` = **352.240 byte** (**344,0 KiB**), SHA-256 `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3`.
- **CLS cold-cache pada Slow 4G** (emulasi CDP `latency: 150ms`, throughput `1,6 Mbps` down / `750 Kbps` up, cache dinonaktifkan):
  - Portal (`/`): **CLS = 0,00000** (batas ≤ 0,02).
  - Consumable Room (`/consumables`): **CLS = 0,00000** (batas ≤ 0,02).
- **Perbandingan koordinat menu header (1536×900, terang)**:
  - Sebelum (`aadfe58~1`): Aktivitas `left: 1208, right: 1528` (pemicu `right: 1272`, meleset `+256 px`); Akun `left: 1208, right: 1528` (pemicu `right: 1512`, meleset `+16 px`).
  - Sesudah (`aadfe58`): Aktivitas `left: 916, right: 1296` atau sejajar tepi kanan pemicu (`|menu.right - trigger.right| = 0 px`); Akun `left: 1192, right: 1512` (`|menu.right - trigger.right| = 0 px`).

### Pasangan gambar sebelum dan sesudah (`followup/`)

#### 1. Posisi menu header (§4)

| Varian                  | Sebelum                                                 | Sesudah                                                |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| Aktivitas · 1280 terang | [sebelum](followup/menu-activity-1280-light-before.png) | [sesudah](followup/menu-activity-1280-light-after.png) |
| Aktivitas · 1280 gelap  | [sebelum](followup/menu-activity-1280-dark-before.png)  | [sesudah](followup/menu-activity-1280-dark-after.png)  |
| Aktivitas · 1536 terang | [sebelum](followup/menu-activity-1536-light-before.png) | [sesudah](followup/menu-activity-1536-light-after.png) |
| Aktivitas · 1536 gelap  | [sebelum](followup/menu-activity-1536-dark-before.png)  | [sesudah](followup/menu-activity-1536-dark-after.png)  |
| Akun · 1280 terang      | [sebelum](followup/menu-account-1280-light-before.png)  | [sesudah](followup/menu-account-1280-light-after.png)  |
| Akun · 1280 gelap       | [sebelum](followup/menu-account-1280-dark-before.png)   | [sesudah](followup/menu-account-1280-dark-after.png)   |
| Akun · 1536 terang      | [sebelum](followup/menu-account-1536-light-before.png)  | [sesudah](followup/menu-account-1536-light-after.png)  |
| Akun · 1536 gelap       | [sebelum](followup/menu-account-1536-dark-before.png)   | [sesudah](followup/menu-account-1536-dark-after.png)   |

#### 2. Font Inter & Sidebar S1–S2 (§1 & §2)

| Varian                               | Sebelum                                                                                                 | Sesudah                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar Portal · 1280 terang         | [sebelum](followup/sidebar-portal-1280-light-before.png)                                                | [sesudah](followup/sidebar-portal-1280-light-after.png)                                                                           |
| Sidebar Portal · 1280 gelap          | [sebelum](followup/sidebar-portal-1280-dark-before.png)                                                 | [sesudah](followup/sidebar-portal-1280-dark-after.png)                                                                            |
| Sidebar Bag Filter · 1280 terang     | [sebelum](followup/sidebar-bag-filter-1280-light-before.png)                                            | [sesudah](followup/sidebar-bag-filter-1280-light-after.png)                                                                       |
| Sidebar Bag Filter · 1280 gelap      | [sebelum](followup/sidebar-bag-filter-1280-dark-before.png)                                             | [sesudah](followup/sidebar-bag-filter-1280-dark-after.png)                                                                        |
| Font Auth · 1280 terang/gelap        | [terang sebelum](before/auth-login-1280-light.png) / [gelap sebelum](before/auth-login-1280-dark.png)   | [terang sesudah](followup/font-auth-1280-light-after.png) / [gelap sesudah](followup/font-auth-1280-dark-after.png)               |
| Font Portal · 1280 terang/gelap      | [terang sebelum](before/portal-1280-light.png) / [gelap sebelum](before/portal-1280-dark.png)           | [terang sesudah](followup/font-portal-1280-light-after.png) / [gelap sesudah](followup/font-portal-1280-dark-after.png)           |
| Font Bag Filter · 1280 terang/gelap  | [terang sebelum](before/bag-filter-1280-light.png) / [gelap sebelum](before/bag-filter-1280-dark.png)   | [terang sesudah](followup/font-bag-filter-1280-light-after.png) / [gelap sesudah](followup/font-bag-filter-1280-dark-after.png)   |
| Font Consumables · 1280 terang/gelap | [terang sebelum](before/consumables-1280-light.png) / [gelap sebelum](before/consumables-1280-dark.png) | [terang sesudah](followup/font-consumables-1280-light-after.png) / [gelap sesudah](followup/font-consumables-1280-dark-after.png) |

#### 3. Hub Portal berbasis katalog (§3)

| Lebar & Tema     | Sebelum                                          | Sesudah                                         |
| ---------------- | ------------------------------------------------ | ----------------------------------------------- |
| 375 px · terang  | [sebelum](followup/portal-375-light-before.png)  | [sesudah](followup/portal-375-light-after.png)  |
| 375 px · gelap   | [sebelum](followup/portal-375-dark-before.png)   | [sesudah](followup/portal-375-dark-after.png)   |
| 768 px · terang  | [sebelum](followup/portal-768-light-before.png)  | [sesudah](followup/portal-768-light-after.png)  |
| 768 px · gelap   | [sebelum](followup/portal-768-dark-before.png)   | [sesudah](followup/portal-768-dark-after.png)   |
| 1280 px · terang | [sebelum](followup/portal-1280-light-before.png) | [sesudah](followup/portal-1280-light-after.png) |
| 1280 px · gelap  | [sebelum](followup/portal-1280-dark-before.png)  | [sesudah](followup/portal-1280-dark-after.png)  |
| 1536 px · terang | [sebelum](followup/portal-1536-light-before.png) | [sesudah](followup/portal-1536-light-after.png) |
| 1536 px · gelap  | [sebelum](followup/portal-1536-dark-before.png)  | [sesudah](followup/portal-1536-dark-after.png)  |

---

## Follow-up 8 November

Tanggal: 8 November 2026 (WIB). Acuan: [UI Follow-up — Font Inter, Sidebar, Portal, dan Posisi Menu](../../design/UI-FOLLOWUP-FONT-PORTAL-MENU.md).

### Urutan commit

| Urutan | Commit                                                                   | Ringkasan                                                                                                                                                                                                                                                                                                 |
| ------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | `aadfe58` — `fix(ui): anchor header menus to their triggers`             | Penempatan menu header `placement="bottom-end"`, pengukuran `offsetWidth`/`offsetHeight` sebelum transisi, batas jepit `clientWidth`/`visualViewport`, lebar 380 px dengan fade scroll internal pada menu Aktivitas, dan durasi 140 ms / 100 ms (§4 M1–M6).                                               |
| 2      | `7ff6364` — `style(ui): self-host Inter and normalize type weights`      | Self-host Inter v4.1 variable (`InterVariable.woff2`), token `--font-sans` dan `--weight-regular/medium/semibold`, normalisasi bobot 600 → 500 pada kontrol/nav/KPI, kalibrasi `letter-spacing`, `.code-text` (`'ss02', 'tnum'`), kesiapan font cetak R22, serta perbaikan label sidebar S1–S2 (§1 & §2). |
| 3      | `d0f3b9c` — `feat(contracts): add portal summary contract and endpoints` | Kontrak `PortalSummary` & `PortalTone` di `@plant/contracts`, ikon `drawing`/`rca`/`cost` di `appCatalog` & `icon.tsx`, endpoint ringan `GET /bag-filter/api/portal-summary` & `GET /consumables/api/portal-summary`, serta pengujian izin dan scope (§3).                                                |
| 4      | Commit ini — `feat(portal): render hub from app catalog`                 | Hub Portal berbasis `appCatalog` (`PortalHub` & `PortalAppCard`), fetch paralel ber-timeout 5 detik dengan isolasi error per kartu, bar sinyal komposisi 8 px, aksi utama sesuai role, blok **Perlu perhatian** persisten, tile **Segera hadir**, dan feed gabungan di rail kanan 360 px (§3).            |

### Status per ID

| ID          | Status dan verifikasi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Commit              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| Font (§1)   | **Selesai.** `InterVariable.woff2` (v4.1 resmi, lisensi SIL OFL 1.1) di-host di `packages/ui/assets/fonts/InterVariable.woff2` (**352.240 byte / 344,0 KiB**, di bawah batas 400 KB) dan dimuat melalui `next/font/local` (`--font-inter`, `display: 'swap'`, `weight: '100 900'`) pada `portal`, `auth`, `bag-filter`, dan `consumables` dengan basePath masing-masing (`/`, `/auth`, `/bag-filter`, `/consumables`, HTTP 200 immutable, 0 request eksternal). Terverifikasi `status: "loaded"` di Chromium dan WebKit. Bobot dinormalisasi ke 400/500/600, `.code-text` memakai `'ss02', 'tnum'`, dan `PrintButton` menunggu `await document.fonts?.ready`.                                                            | `7ff6364`           |
| S1 (§2)     | **Selesai.** `.sidebar-nav-item > .sidebar-nav-link` memakai `font-size: var(--type-body)` (14 px) dan `font-weight: var(--weight-medium)` (500), sedangkan `.nav-tree-row` memakai `14 px` dan `--weight-regular` (400). Diuji di Chromium dan WebKit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `7ff6364`           |
| S2 (§2)     | **Selesai.** Empat deklarasi legacy `.sidebar` bertema gelap yang sudah tidak aktif di `workspace.css` dihapus; tema terang dan gelap tidak berubah.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `7ff6364`           |
| Portal (§3) | **Selesai.** Portal membaca aplikasi aktif dan rencana dari `appCatalog`, memanggil satu `GET /<app>/api/portal-summary` per aplikasi aktif secara paralel (0 panggilan `/api/dashboard` dari Portal) dengan timeout 5 detik dan tombol **Coba lagi** terisolasi per kartu. `PortalAppCard` merender 1–3 KPI tabular, garis sinyal komposisi 8 px (`--age-*` / `--series-*` dengan pemisah 2 px warna surface dan kontras non-teks ≥ 5,05:1 terang / ≥ 11,8:1 gelap), aksi utama sesuai role (disembunyikan untuk viewer), dan tautan aplikasi. Pada 1280×800 dengan 2 aplikasi aktif, seluruh hub tampil tanpa scroll vertikal (`scrollHeight <= 800`). Diuji dengan route mock untuk 0, 1, 2, 3, dan 5 aplikasi aktif. | `d0f3b9c`, Commit 4 |
| M1 (§4)     | **Selesai.** Menu header memakai `placement="bottom-end"`. Pada 1536 px: menu Aktivitas (`left: 1126`, `right: 1506`) sejajar pemicu lonceng (`right: 1506`), dan menu Akun (`left: 1192`, `right: 1512`) sejajar chip akun (`right: 1512`) — tidak lagi bertumpuk di `x = 1208`. `--anchor-origin` dihitung dalam piksel dari titik tengah pemicu (`330px 0px` untuk Aktivitas, `198px 0px` untuk Akun).                                                                                                                                                                                                                                                                                                                | `aadfe58`           |
| M2 (§4)     | **Selesai.** Ukuran menu diukur menggunakan `offsetWidth`/`offsetHeight` sebelum atribut `data-entering` dilepas, sehingga skala masuk `0.96` tidak memotong hasil pengukuran.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `aadfe58`           |
| M3 (§4)     | **Selesai.** Batas jepit memakai `document.documentElement.clientWidth`/`clientHeight` (dan `visualViewport`), diuji pada lebar 1024, 1280, dan 1536 px termasuk dengan simulasi scrollbar klasik 17 px (`padding-right: 17px`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `aadfe58`           |
| M4 (§4)     | **Selesai.** Menu Akun memakai `min-width: max(var(--trigger-width), 260px)`, menu Aktivitas memakai lebar 380 px dan `max-height: min(480px, calc(100dvh - var(--menu-top) - 16px))` dengan `.scroll-fade`, serta posisi dihitung ulang saat `resize`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `aadfe58`           |
| M5 (§4)     | **Selesai.** `.overlay-menu` memakai `--duration-fast` (140 ms) saat masuk dan `100ms` saat keluar dengan `--ease-standard`, tanpa deklarasi `animation-duration` yatim.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `aadfe58`           |
| M6 (§4)     | **Ditunda dan dicatat (sesuai pedoman M6).** `showModal()` dipertahankan karena kontrak interaksi `tests/e2e/ui-interactions.spec.ts:244` mengandalkan backdrop modal saat klik di luar menu di atas tombol halaman lain agar tidak langsung memicu aksi tombol di belakangnya. Fokus keyboard, Escape, dan pengembalian fokus tetap lulus di Chromium dan WebKit.                                                                                                                                                                                                                                                                                                                                                       | `aadfe58`           |

### Pengukuran font, CLS, dan posisi menu

- **Ukuran file font**: `packages/ui/assets/fonts/InterVariable.woff2` = **352.240 byte** (**344,0 KiB**), SHA-256 `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3`.
- **CLS cold-cache pada Slow 4G** (emulasi CDP `latency: 150ms`, throughput `1,6 Mbps` down / `750 Kbps` up, cache dinonaktifkan):
  - Portal (`/`): **CLS = 0,00000** (batas ≤ 0,02).
  - Consumable Room (`/consumables`): **CLS = 0,00000** (batas ≤ 0,02).
- **Perbandingan koordinat menu header (1536×900, terang)**:
  - Sebelum (`aadfe58~1`): Aktivitas `left: 1208, right: 1528` (pemicu `right: 1272`, meleset `+256 px`); Akun `left: 1208, right: 1528` (pemicu `right: 1512`, meleset `+16 px`).
  - Sesudah (`aadfe58`): Aktivitas `left: 916, right: 1296` atau sejajar tepi kanan pemicu (`|menu.right - trigger.right| = 0 px`); Akun `left: 1192, right: 1512` (`|menu.right - trigger.right| = 0 px`).

### Pasangan gambar sebelum dan sesudah (`followup/`)

#### 1. Posisi menu header (§4)

| Varian                  | Sebelum                                                 | Sesudah                                                |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| Aktivitas · 1280 terang | [sebelum](followup/menu-activity-1280-light-before.png) | [sesudah](followup/menu-activity-1280-light-after.png) |
| Aktivitas · 1280 gelap  | [sebelum](followup/menu-activity-1280-dark-before.png)  | [sesudah](followup/menu-activity-1280-dark-after.png)  |
| Aktivitas · 1536 terang | [sebelum](followup/menu-activity-1536-light-before.png) | [sesudah](followup/menu-activity-1536-light-after.png) |
| Aktivitas · 1536 gelap  | [sebelum](followup/menu-activity-1536-dark-before.png)  | [sesudah](followup/menu-activity-1536-dark-after.png)  |
| Akun · 1280 terang      | [sebelum](followup/menu-account-1280-light-before.png)  | [sesudah](followup/menu-account-1280-light-after.png)  |
| Akun · 1280 gelap       | [sebelum](followup/menu-account-1280-dark-before.png)   | [sesudah](followup/menu-account-1280-dark-after.png)   |
| Akun · 1536 terang      | [sebelum](followup/menu-account-1536-light-before.png)  | [sesudah](followup/menu-account-1536-light-after.png)  |
| Akun · 1536 gelap       | [sebelum](followup/menu-account-1536-dark-before.png)   | [sesudah](followup/menu-account-1536-dark-after.png)   |

#### 2. Font Inter & Sidebar S1–S2 (§1 & §2)

| Varian                               | Sebelum                                                                                                 | Sesudah                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar Portal · 1280 terang         | [sebelum](followup/sidebar-portal-1280-light-before.png)                                                | [sesudah](followup/sidebar-portal-1280-light-after.png)                                                                           |
| Sidebar Portal · 1280 gelap          | [sebelum](followup/sidebar-portal-1280-dark-before.png)                                                 | [sesudah](followup/sidebar-portal-1280-dark-after.png)                                                                            |
| Sidebar Bag Filter · 1280 terang     | [sebelum](followup/sidebar-bag-filter-1280-light-before.png)                                            | [sesudah](followup/sidebar-bag-filter-1280-light-after.png)                                                                       |
| Sidebar Bag Filter · 1280 gelap      | [sebelum](followup/sidebar-bag-filter-1280-dark-before.png)                                             | [sesudah](followup/sidebar-bag-filter-1280-dark-after.png)                                                                        |
| Font Auth · 1280 terang/gelap        | [terang sebelum](before/auth-login-1280-light.png) / [gelap sebelum](before/auth-login-1280-dark.png)   | [terang sesudah](followup/font-auth-1280-light-after.png) / [gelap sesudah](followup/font-auth-1280-dark-after.png)               |
| Font Portal · 1280 terang/gelap      | [terang sebelum](before/portal-1280-light.png) / [gelap sebelum](before/portal-1280-dark.png)           | [terang sesudah](followup/font-portal-1280-light-after.png) / [gelap sesudah](followup/font-portal-1280-dark-after.png)           |
| Font Bag Filter · 1280 terang/gelap  | [terang sebelum](before/bag-filter-1280-light.png) / [gelap sebelum](before/bag-filter-1280-dark.png)   | [terang sesudah](followup/font-bag-filter-1280-light-after.png) / [gelap sesudah](followup/font-bag-filter-1280-dark-after.png)   |
| Font Consumables · 1280 terang/gelap | [terang sebelum](before/consumables-1280-light.png) / [gelap sebelum](before/consumables-1280-dark.png) | [terang sesudah](followup/font-consumables-1280-light-after.png) / [gelap sesudah](followup/font-consumables-1280-dark-after.png) |

#### 3. Hub Portal berbasis katalog (§3)

| Lebar & Tema     | Sebelum                                          | Sesudah                                         |
| ---------------- | ------------------------------------------------ | ----------------------------------------------- |
| 375 px · terang  | [sebelum](followup/portal-375-light-before.png)  | [sesudah](followup/portal-375-light-after.png)  |
| 375 px · gelap   | [sebelum](followup/portal-375-dark-before.png)   | [sesudah](followup/portal-375-dark-after.png)   |
| 768 px · terang  | [sebelum](followup/portal-768-light-before.png)  | [sesudah](followup/portal-768-light-after.png)  |
| 768 px · gelap   | [sebelum](followup/portal-768-dark-before.png)   | [sesudah](followup/portal-768-dark-after.png)   |
| 1280 px · terang | [sebelum](followup/portal-1280-light-before.png) | [sesudah](followup/portal-1280-light-after.png) |
| 1280 px · gelap  | [sebelum](followup/portal-1280-dark-before.png)  | [sesudah](followup/portal-1280-dark-after.png)  |
| 1536 px · terang | [sebelum](followup/portal-1536-light-before.png) | [sesudah](followup/portal-1536-light-after.png) |
| 1536 px · gelap  | [sebelum](followup/portal-1536-dark-before.png)  | [sesudah](followup/portal-1536-dark-after.png)  |
