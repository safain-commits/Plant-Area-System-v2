# Laporan Audit Visual & Verifikasi Polish Portal v3

> Mengacu pada [PORTAL-GOLD-STANDARD-PROMPT.md](../../design/PORTAL-GOLD-STANDARD-PROMPT.md) dan [portal-brief.jsonc](../../design/portal-brief.jsonc).
> Tanggal verifikasi: 9 November 2026.
> Target implementasi: Menyetarakan Portal SSO (`/`) dengan gold standard Ringkasan Bag Filter (`/bag-filter`).

---

## 1. Ringkasan Eksekutif

Portal v3 dibangun ulang sepenuhnya di atas arsitektur komponen dan token CSS dashboard Bag Filter (`/bag-filter`). Halaman Portal kini berbagi geometri grid, hierarki tipografi, class styling, dan token warna yang sama persis dengan Bag Filter tanpa mengubah tampilan maupun kontrak modul Bag Filter atau Consumable Room.

Seluruh kriteria audit P1–P8 telah terselesaikan dan diverifikasi melalui pengukuran aktual Playwright pada lingkungan `plant-v2-dev`.

---

## 2. Status Penyelesaian Temuan Audit (P1–P8)

| ID     | Temuan Audit Awal                                                                                                                                                                                       | Tindakan Perbaikan                                                                                                                                                                                                                                                                                                                    | Status      | Bukti Verifikasi                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **P1** | **Celah & Lubang Grid**<br>Dua kartu hanya mengisi 2/3 baris. Sepertiga kanan kosong sementara tile "Segera hadir" membentang penuh. Gap 32 px dan rail 360 px sejak 1280 px (berbeda dari Bag Filter). | Layout diganti menggunakan `.dashboard-grid` > `.dashboard-main` + `.dashboard-rail`. Gap 16 px (`--space-4`). Lebar rail 300 px pada 1280–1535 px dan 360 px pada ≥1536 px. Grid kartu dan planned tile memakai class kolom eksplisit (`cols-1/2/3`).                                                                                | **SELESAI** | `measurements.json`: Rail width 300 px (1280 px) & 360 px (1536 px), gap 16 px identik dengan Bag Filter. `heroAppAligned: true`.          |
| **P2** | **Tidak Ada Titik Fokus**<br>Semua blok berupa kotak putih berbobot sama tanpa display number, chart, atau aksen lime.                                                                                  | Ditambahkan split card `.hero-chart-card` berisi bar chart aktivitas 12 minggu WIB (`PortalActivityChart`) dengan slot aktif lime + hatch 135° serta KPI rail perhatian (`PortalKpiRail`) dengan display number besar.                                                                                                                | **SELESAI** | Screenshot `portal-1536-*.png`, `portal-1280-*.png`. Slot aktif chart memakai aksen lime bergaris miring (hatch).                          |
| **P3** | **"Perlu Perhatian" Seperti Tag**<br>Chip terbungkus 2 baris, pengulangan teks 4 kali, angka oranye hanya 14 px.                                                                                        | Direstrukturisasi menjadi maksimal 3 grup perhatian bermakna sebagai `.metric-block` dengan angka `--type-large` dan `--negativeText`. State tenang (`is-calm`) bila 0. Overflow ditampung dalam tombol "Lihat semua (n)" dengan `Overlay` popup menu (`placement="bottom-end"`).                                                     | **SELESAI** | Kontrak `PortalSummary` menambah `attention[].group`. Tampilan 1 grup ("Bag ≥ 1.260 hari") rapi dengan link langsung ke equipment terkait. |
| **P4** | **Kartu Aplikasi Datar**<br>3 KPI berbobot sama, label terbungkus, nilai kritis tidak berwarna, bar distribusi segmen outline, tombol aksi dan link berdesakan di footer.                               | Kartu aplikasi (`PortalAppCard`) mengadopsi anatomi Bag Filter "Cakupan pemasangan": headline display besar (`strong.display-lg`), progress bar lime 14 px dengan hatch (`.progress-track > i.hatched`), caption penjelasan 1-2 baris, maksimal 2 metrik sekunder dengan semantic tone, footer bersih hanya link "Buka {Aplikasi} →". | **SELESAI** | Kartu Bag Filter: headline `17.650 / 18.784 bag`, progress 94,0%, 2 metrik sekunder. Kartu Consumables: `1 / 3 material`, progress 33,3%.  |
| **P5** | **Feed Aktivitas Lemah**<br>Judul "Tanpa WO", tanggal panjang memakan kolom, rail berhenti di tengah layar.                                                                                             | Dibuat mengikuti pola `.activity-row` Bag Filter: judul bermakna ("Penggantian 422-BF1", "Consume Order · R22"), waktu relatif WIB (`formatRelativeWib`), nilai dan satuan rata kanan ("3 bag", "1 item"), scroll internal mengisi penuh tinggi rail. Filter chip aplikasi muncul jika aplikasi aktif ≥ 3.                            | **SELESAI** | Screenshot feed terisi aktivitas aktual. Tidak ada judul "Tanpa WO". Tinggi rail sama dengan kolom main pada ≥1280 px.                     |
| **P6** | **Heading & Eyebrow Tidak Selaras**<br>Tanggal menggantung di baseline H1, eyebrow "Portal" tidak berirama dengan breadcrumb Bag Filter.                                                                | Eyebrow diselaraskan menjadi `TQ-CMMS / PORTAL` (gaya breadcrumb uppercase). Tanggal dipindahkan ke slot kanan atas (`.portal-date-slot`) sejajar dengan eyebrow, seperti penempatan "Data aktual" di Bag Filter.                                                                                                                     | **SELESAI** | Heading rapi, H1 sapaan waktu WIB ("Selamat pagi/siang/sore/malam, {Nama}."), tanggal di kanan atas.                                       |
| **P7** | **"Segera Hadir" Terlalu Menyerupai Kartu Aktif**<br>Latar terang dan border solid terkesan dapat diklik.                                                                                               | Tile planned memakai border putus-putus (`1px dashed var(--borderStrong)`), latar transparan, teks teredam (`--textMuted`), tanpa hover atau link. Meniru metafora slot bag kosong pada peta Bag Filter.                                                                                                                              | **SELESAI** | Screenshot tile "Segera hadir" transparan dengan garis putus-putus, sejajar kolom kartu aktif.                                             |
| **P8** | **Aksi Cepat Tersebar & Bersaing**<br>Tombol aksi di footer kartu bersaing dengan link buka aplikasi.                                                                                                   | Dipindahkan menjadi satu-satunya permukaan lime di Portal: widget `.feature-widget` di rail kanan atas berisi maksimal 3 aksi relevan sesuai hak akses peran pengguna (`summary.action`), statis tanpa tilt/tagline, feedback highlight saat `:active`. Disembunyikan untuk peran viewer.                                             | **SELESAI** | Widget "AKSI CEPAT" berwarna lime menyatu di rail kanan, kartu aplikasi bersih hanya menampilkan status.                                   |

---

## 3. Hasil Pengukuran Geometri & Kesetaraan dengan Bag Filter

Pengukuran diambil langsung via Playwright `getBoundingClientRect()` pada `https://localhost:9443`:

### A. Perbandingan Rail dan Gap (Portal vs Bag Filter)

| Breakpoint  | Tema   | Bag Filter Rail Width | Portal Rail Width | Bag Filter Gap | Portal Gap | Main Height | Rail Height | Status      |
| ----------- | ------ | --------------------- | ----------------- | -------------- | ---------- | ----------- | ----------- | ----------- |
| **1536 px** | Terang | 360.0 px              | 360.0 px          | 16.0 px        | 16.0 px    | 1188.0 px   | 1188.0 px   | **IDENTIK** |
| **1536 px** | Gelap  | 360.0 px              | 360.0 px          | 16.0 px        | 16.0 px    | 1188.0 px   | 1188.0 px   | **IDENTIK** |
| **1280 px** | Terang | 300.0 px              | 300.0 px          | 16.0 px        | 16.0 px    | 1208.0 px   | 1208.0 px   | **IDENTIK** |
| **1280 px** | Gelap  | 300.0 px              | 300.0 px          | 16.0 px        | 16.0 px    | 1208.0 px   | 1208.0 px   | **IDENTIK** |
| **768 px**  | Terang | 644.0 px (stack)      | 644.0 px (stack)  | -              | -          | -           | -           | **IDENTIK** |
| **768 px**  | Gelap  | 644.0 px (stack)      | 644.0 px (stack)  | -              | -          | -           | -           | **IDENTIK** |
| **375 px**  | Terang | 343.0 px (stack)      | 343.0 px (stack)  | -              | -          | -           | -           | **IDENTIK** |
| **375 px**  | Gelap  | 343.0 px (stack)      | 343.0 px (stack)  | -              | -          | -           | -           | **IDENTIK** |

### B. Kesetaraan Tinggi Kartu & Penyelarasan Grid

- **Hero & App Grid Alignment**: `heroAppAligned: true` pada seluruh breakpoint desktop (tepi kiri dan kanan hero card sejajar sempurna dengan grid kartu).
- **Equal Heights Baris Kartu**: `cardHeightsEqual: true` pada seluruh breakpoint desktop. Kedua kartu aplikasi memiliki tinggi yang sama persis (388 px), dengan footer `summary-open` menempel rata ke dasar kartu (`margin-top: auto`).
- **Accent Budget**: `featureWidgetCount: 1`. Hanya ada tepat satu permukaan lime pada Portal (widget Aksi Cepat).
- **Density Lipatan Layar (1280×800)**: Heading + Hero + Kartu aplikasi tertata rapi dan terlihat di area viewport tanpa perlu scroll vertikal (`maxCardBottom <= 800`).

---

## 4. Kinerja & Stabilitas Visual (Cumulative Layout Shift)

Pengukuran CLS dilakukan dengan emulasi jaringan **Slow 4G** (1.000 kbps download, 500 kbps upload, 200 ms RTT) dengan cache browser dikosongkan total:

| Metrik                            | Ambang Batas Target | Nilai Aktual Terukur | Evaluasi                   |
| --------------------------------- | ------------------- | -------------------- | -------------------------- |
| **CLS (Cumulative Layout Shift)** | $\le 0{,}020$       | **$0{,}016$**        | **MEMENUHI TARGET (PASS)** |

**Faktor Pendukung CLS Rendah:**

1. **Skeleton Simetris**: Tinggi skeleton untuk hero, kartu aplikasi (388 px), widget aksi cepat, dan feed aktivitas disetel identik dengan tinggi konten saat siap.
2. **Min-Height Teks**: Caption kartu (`p.fine`) memiliki `min-height: 32px` sehingga kartu dengan caption 1 baris maupun 2 baris tidak menimbulkan layout shift.
3. **Pemesanan Ruang Widget**: State loading rail mengalokasikan ruang `.feature-widget` sejak awal jika pengguna memiliki grant bertipe tulis (non-viewer), mencegah pergeseran feed aktivitas saat API selesai memuat.

---

## 5. Uji Skalabilitas Katalog Aplikasi (Fixtures)

Pengujian dilakukan menggunakan fixture route mock Playwright untuk skenario 0, 1, 2, 3, dan 5 aplikasi aktif:

| Skenario       | Kartu Aktif  | Planned Tile | Filter Feed                   | Isolasi Error & Recovery                                                                                                          | Bukti Screenshot     |
| -------------- | ------------ | ------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **0 Aplikasi** | 0            | 5            | Tidak tampil                  | Panel `.portal-no-access` tampil ramah.                                                                                           | `fixture-0-apps.png` |
| **1 Aplikasi** | 1 (`cols-1`) | 4 (`cols-1`) | Tidak tampil                  | Kartu mengisi lebar baris tunggal secara simetris.                                                                                | `fixture-1-apps.png` |
| **2 Aplikasi** | 2 (`cols-2`) | 3 (`cols-2`) | Tidak tampil                  | 2 kolom simetris tanpa celah kosong.                                                                                              | `fixture-2-apps.png` |
| **3 Aplikasi** | 3 (`cols-3`) | 2 (`cols-3`) | **Tampil** (Semua / Aplikasi) | Grid 3 kolom (2 kolom pada tablet), chip filter muncul otomatis.                                                                  | `fixture-3-apps.png` |
| **5 Aplikasi** | 5 (`cols-3`) | 0            | **Tampil** (Semua / Aplikasi) | Aplikasi RCA gagal (503), kartu menampilkan `.portal-card-error`. Klik "Coba lagi" memulihkan kartu tanpa memengaruhi kartu lain. | `fixture-5-apps.png` |

---

## 6. Pembuktian Non-Regresi (Pixel Identity) Bag Filter

Modul Bag Filter (`/bag-filter`) dan Consumables (`/consumables`) sama sekali tidak diubah stylenya. Kelas CSS yang dipakai Portal merupakan kelas yang sudah ada dan di-reuse:

- Screenshot Bag Filter sebelum dan sesudah polish diambil pada breakpoint 1280 px:
  - Tanggal verifikasi: 9 Nov 2026.
  - Komparasi struktur DOM: Tidak ada class baru yang disuntikkan ke `/bag-filter`.
  - Kesetaraan visual: Tata letak, chart kuartal, KPI rail, distribusi umur bag, dan aktivitas di `/bag-filter` 100% identik dengan kondisi sebelumnya.

---

## 7. Bukti Screenshot

Seluruh screenshot hasil verifikasi tersimpan di direktori `docs/testing/portal-v3/`:

### Responsif Portal

- `portal-1536-light.png` & `portal-1536-dark.png`
- `portal-1280-light.png` & `portal-1280-dark.png`
- `portal-768-light.png` & `portal-768-dark.png`
- `portal-375-light.png` & `portal-375-dark.png`

### Responsif Bag Filter (Referensi Gold Standard)

- `bag-filter-1536-light.png` & `bag-filter-1536-dark.png`
- `bag-filter-1280-light.png` & `bag-filter-1280-dark.png`
- `bag-filter-768-light.png` & `bag-filter-768-dark.png`
- `bag-filter-375-light.png` & `bag-filter-375-dark.png`

### Fixture Skalabilitas

- `fixture-0-apps.png` (Pengguna baru tanpa akses)
- `fixture-1-apps.png` (Hanya 1 aplikasi aktif)
- `fixture-2-apps.png` (Kondisi saat ini: Bag Filter & Consumables)
- `fixture-3-apps.png` (Penambahan Drawing Database)
- `fixture-5-apps.png` (5 aplikasi aktif dengan isolasi error & recovery RCA)

---

## 8. Struktur Commit

Implementasi dibagi menjadi 3 commit terstruktur sesuai panduan:

1. **Commit 1**: `feat(contracts): extend portal summary for hub v3`
   - Pembaruan kontrak `PortalSummary` v2 di `@plant/contracts`: penambahan `headline`, `metrics[].tone`, `attention[].group`, `activity.weeks`, `recent[].value/unit`, dan pembuangan `signal`.
   - Implementasi helper waktu WIB `wibWeekStarts` dan `formatRelativeWib`.
   - Pembaruan agregasi `portalSummary` di `@plant/bag-core` dan `stockPortalSummary` di `@plant/consumables-core`.
   - Unit test helper kontrak dan test integrasi platform/consumables.

2. **Commit 2**: `feat(portal): rebuild hub on the Bag Filter dashboard system`
   - Rebuild `PortalHub` di `@plant/ui` menggunakan `.dashboard-grid`, `.hero-chart-card`, `.kpi-rail`, `.feature-widget`, `.recent-card`.
   - Pembuatan komponen `PortalActivityChart` dengan 12 slot bar lime bergaris miring (hatched).
   - Penataan kartu aplikasi `PortalAppCard` dengan headline display-lg, progress bar lime hatched 14 px, 2 secondary metrics, dan footer bersih.
   - Refaktor `dashboard.css`: eliminasi aturan legacy portal yang usang, penyelarasan margin, equal heights, dan skeleton simetris.

3. **Commit 3**: `docs(portal): visual audit screenshots and polish verification report`
   - Screenshot visual audit 4 breakpoint terang/gelap + 5 fixture skalabilitas di `docs/testing/portal-v3/`.
   - File hasil pengukuran `docs/testing/portal-v3/measurements.json`.
   - Pembaruan dokumentasi `docs/UI-THEME.md` bagian Portal.
   - Laporan verifikasi visual dan audit `docs/testing/portal-v3/REPORT.md`.

---

## 9. Catatan & Keputusan Desain

1. **Aksi Cepat Terpusat di Rail**: Tombol aksi dipindahkan ke widget lime di rail kanan agar kartu aplikasi murni berfungsi sebagai pemantau status. Footer kartu hanya memuat tautan "Buka {Aplikasi} →".
2. **Budget Warna Lime**: Satu-satunya permukaan lime di Portal adalah widget Aksi Cepat. Slot aktif chart dan progress bar kartu memakai aksen lime bergaris (hatch).
3. **Distribusi Umur Bag**: Distribusi umur 7 kelompok tidak ditampilkan di Portal (sudah diwakili oleh grup perhatian "Bag ≥ 1.260 hari") guna menjaga ketenangan dan fokus visual.
4. **Penyelarasan Header KPI Rail**: Header `.kpi-rail .section-head h2` distilasi dengan `display: inline-flex; align-items: center; gap: var(--space-2)` dan ikon info 16×16 px berwajah `var(--textSecondary)` untuk memastikan simetri sumbu vertikal (selisih pusat 0 px) dan jarak horizontal 8 px terhadap teks "Perlu perhatian".
5. **Penyelarasan Label Tanggal Chart pada Mobile & Tablet**:
   - Menambahkan `white-space: nowrap` dan `overflow: visible` pada `.portal-hub .hero-chart-card .bar-slot small` sehingga label tanggal tidak pecah menjadi 2 baris (misal `21\nSep`) yang sebelumnya menyebabkan garis dasar (baseline) bergerigi dan menabrak garis grid `0`.
   - Mengubah selector penyembunyian selang-seling dari `:nth-child(even)` menjadi `:nth-last-child(even)` agar dijangkarkan dari minggu berjalan (Slot 12 aktif selalu memiliki label tanggal `9 Nov`).
   - Melakukan scoping ketat seluruh aturan bar-slots Portal ke `.portal-hub .hero-chart-card` agar 4 kuartal Bag Filter (`/bag-filter`) tetap utuh 100% di semua breakpoint.
