# Prompt: Portal setara gold standard Bag Filter

> Instruksi untuk coding agent. Sumber nilai dan spesifikasi: [portal-brief.jsonc](portal-brief.jsonc). Jika prompt ini dan JSONC berbeda, **JSONC yang berlaku**.
> Audit dibuat 9 November 2026 terhadap commit `7f17b1e`, berdasarkan dua screenshot desktop dari pengguna (Portal sesudah revisi dan Ringkasan Bag Filter) serta source code.

## 1. Tujuan

Halaman Ringkasan Bag Filter (`/bag-filter`) sudah disetujui pengguna sebagai **gold standard**. Yang disukai: hero card berisi chart dan KPI rail, bar lime dengan garis miring halus (hatch), slot nonaktif berwarna abu-abu dengan bentuk yang sama, angka besar sebagai pembentuk hierarki, progress bar lime bergaris, dan rail kanan dengan widget lime serta daftar aktivitas.

Portal saat ini secara UX sudah lebih baik, misalnya karena ada tombol aksi cepat. Secara visual masih di bawah gold standard. Tugas Anda adalah membangun ulang Portal **dengan komponen dan class yang sama seperti dashboard Bag Filter**, sehingga kedua halaman terasa berasal dari satu sistem. Kontrak per aplikasi tetap dipertahankan dan diperluas agar Drawing Database, Root Cause Analysis, dan Part Cost dapat bergabung tanpa mengubah kode Portal.

## 2. Batasan

1. **Jangan mengubah tampilan `/bag-filter` dan `/consumables`.** Reuse class CSS mereka. Jika perlu mengekstrak komponen, buat komponen baru khusus Portal dan biarkan `dashboard.tsx` serta `stock-summary.tsx` apa adanya. Bandingkan screenshot Bag Filter sebelum dan sesudah. Hasilnya harus identik.
2. Kontrak `/api/dashboard` tidak berubah. Perluasan hanya pada `PortalSummary` dan endpoint `/<app>/api/portal-summary`.
3. Tetap berlaku:
   - Inter self-host, token tipe/spacing/warna, dan reduced motion/transparency/contrast.
   - Tidak ada tilt, tagline, maupun count-up saat mount di Portal.
   - Sesi absolut 8 jam tanpa UI sesi.
   - Satu request ringkasan per aplikasi.
4. Tidak ada dependency baru. Ikuti `AGENTS.md`, termasuk Context7 dan aturan lingkungan uji `plant-v2-test`.
5. Jalankan `git status` lebih dulu. Jangan menimpa perubahan pengguna yang belum di-commit.

## 3. Hasil audit: Portal dibanding gold standard

| ID  | Temuan                                                                                                                                                                                                                                                                                                                                                                                                                                              | Bukti                                                                                                                                                          | Arah perbaikan (detail di JSONC)                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Ada lubang di grid.** Pada layar lebar, dua kartu aplikasi hanya mengisi dua pertiga kolom utama. Sepertiga kanan kosong, padahal tile "Segera hadir" di bawahnya membentang penuh, sehingga tepi kanan tidak sejajar. Jarak ke rail 32 px, sedangkan Bag Filter 16 px. Lebar rail juga 360 px sejak 1280, sementara Bag Filter memakai 300 px sampai 1535 px.                                                                                    | `dashboard.css:781` dan `:788` (`repeat(auto-fill, minmax(…22rem))` membuat 3 track untuk 2 kartu), `:771` (`gap: --space-8`), `:1062` (planned 3 kolom tetap) | `layout`: pakai `.dashboard-grid`, `.dashboard-main`, dan `.dashboard-rail` milik Bag Filter. Jumlah kolom kartu eksplisit (`cols-1/2/3`). Tile "Segera hadir" memakai kolom yang sama dengan kartu.              |
| P2  | **Tidak ada titik fokus.** Semua blok berupa kotak putih dengan bobot sama, tanpa angka display, chart, atau lime. Separuh bawah viewport kosong.                                                                                                                                                                                                                                                                                                   | Screenshot Portal                                                                                                                                              | `hero`: hero split card berisi chart "Catatan pekerjaan" 12 minggu (bar lime bergaris pada slot aktif) dan KPI rail "Perlu perhatian".                                                                            |
| P3  | **"Perlu perhatian" tampak seperti tag.** Chip terbungkus menjadi dua baris, "bag ≥ 1.260 hari" diulang empat kali, dan angka oranye hanya 14 px. Rincian per equipment seharusnya ada di Bag Filter.                                                                                                                                                                                                                                               | `portal-app-card.tsx:407` (chips), `insights.ts` (item per equipment)                                                                                          | `hero.kpiRail`: maksimal 3 grup sebagai `.metric-block` (angka `--type-large`, `--negativeText`), dengan "Lihat semua (n)" lewat overlay. Kontrak menambah `attention[].group`.                                   |
| P4  | **Kartu aplikasi datar.** Tiga KPI berbobot sama. Label "Umur ≥ 1.260 hari" terbungkus dua baris sehingga baris label tidak rata. Nilai kritis 4.094 tidak berwarna, padahal di gold berwarna oranye. Bar distribusi 8 px bersegmen dengan outline tampak seperti permen. Caption hanya menampilkan 2 dari 7 kelompok. Kartu R22 kosong menampilkan bar outline "0 dari 0" yang terlihat rusak. Tombol aksi dan link "Buka …" berdesakan di footer. | `portal-app-card.tsx:134` (signal), `:179` (footer)                                                                                                            | `appCard`: anatomi kartu "Cakupan pemasangan" di Bag Filter. Satu headline `17.650 / 18.784`, progress lime hatched 14 px, caption satu kalimat, maksimal 2 metrik sekunder ber-tone, footer cukup link "Buka …". |
| P5  | **Feed aktivitas lemah.** Judul lima baris semuanya "Tanpa WO" karena field yang paling sering kosong dijadikan judul. Tanggal panjang mengambil satu kolom. Ikon tanpa tile. Rail berhenti di tengah layar dan tidak sama tinggi dengan kolom utama. Penghitung "5 entri" tidak berguna.                                                                                                                                                           | `insights.ts:208` (`title: item.wo \|\| 'Tanpa WO'`), `portal-app-card.tsx:480-483`                                                                            | `rail.activity`: pola `.activity-row` Bag Filter. Judul bermakna ("Penggantian 422-BF1"), waktu relatif, nilai dan satuan di kanan, mengisi tinggi rail dengan scroll internal.                                   |
| P6  | **Heading.** Tanggal menempel di samping H1 pada baseline, lebih kecil, dan tampak menggantung. Eyebrow "Portal" berbeda gaya dengan breadcrumb gold ("EQUIPMENT PROCESS / BAG FILTER").                                                                                                                                                                                                                                                            | `portal-app-card.tsx:374-375`                                                                                                                                  | `heading`: eyebrow `TQ-CMMS / PORTAL` bergaya sama dengan gold. Tanggal pindah ke slot kanan atas, seperti "Data aktual".                                                                                         |
| P7  | **"Segera hadir" terlalu mirip kartu aktif** (latar terang dan border solid), sehingga terkesan bisa diklik.                                                                                                                                                                                                                                                                                                                                        | `dashboard.css:1060` dan seterusnya                                                                                                                            | `planned.tile`: border putus-putus, latar transparan, teks redup. Metafora sama dengan posisi bag kosong.                                                                                                         |
| P8  | **Aksi cepat tersebar.** Tombol aksi yang disukai pengguna ada, tetapi tenggelam di footer kartu dan bersaing dengan link "Buka".                                                                                                                                                                                                                                                                                                                   | Screenshot                                                                                                                                                     | `rail.quickActions`: satu-satunya permukaan lime di Portal (class `.feature-widget`, tanpa tilt atau tagline) berisi maksimal 3 aksi sesuai role.                                                                 |

## 4. Rancangan target (≥1536 px)

```text
TQ-CMMS / PORTAL                                              Senin, 9 Nov 2026 · WIB
Selamat pagi, LinearSAF.
Ringkasan pekerjaan dan perhatian di area Anda.
┌──────────────────────────────────────────────┬──────────┐  ┌──────────────────┐
│ CATATAN PEKERJAAN                            │ Perlu    │  │ AKSI CEPAT  (lime)│
│ 146 catatan                                  │ perhatian│  │ ↳ Catat penggantian│
│ 12 minggu terakhir · Senin–Minggu (WIB)      │          │  │ ↳ Consume Order   │
│ ■ Bag Filter  ■ Consumable Room              │ Bag ≥1.260│  └──────────────────┘
│  ▁ ▃ ▂ ▅ ▂ ▁ ▃ ▂ ▄ ▂ ▁ ▇(lime, hatch)        │ 4.094    │  ┌──────────────────┐
│ 18Agu ……………………………………………………………… 3Nov        │ di 4 equip│  │ Aktivitas terbaru │
│ [Minggu 3–9 Nov · 12 catatan · BF 9 · R22 3] │ Kritis…  │  │ ▣ Penggantian     │
│ → Minggu ini 12 · rata-rata 11 minggu 11     │ 0        │  │   422-BF1   3 bag │
├──────────────────────┬───────────────────────┴──────────┤  │ ▣ Consume Order … │
│ Bag Filter        ⛉  │ Consumable Room              ◫   │  │   …    (scroll)   │
│ 17.650 / 18.784      │ 1 / 3 material                   │  │                   │
│ ▰▰▰▰▰▰▰▰▰▰▰▰▱ (hatch)│ ▰▰▰▰▱▱▱▱▱▱▱▱▱                   │  │                   │
│ 94,0% posisi …       │ 33,3% material dikelola …        │  │                   │
│ Umur≥1.260  Belum    │ Stok nol   Belum dihitung        │  │                   │
│ 4.094       1.134    │ 1          1                     │  │                   │
│ Buka Bag Filter    → │ Buka Consumable Room           → │  │                   │
├──────────────────────┴──────────────────────────────────┤  │                   │
│ Segera hadir  ┆Drawing Database┆ ┆Root Cause…┆ ┆Part Cost┆ │                   │
└─────────────────────────────────────────────────────────┘  └──────────────────┘
```

Breakpoint lain mengikuti `layout.breakpoints` di JSONC, yang sama persis dengan dashboard Bag Filter.

## 5. Langkah implementasi

### Commit 1: `feat(contracts): extend portal summary for hub v3`

1. Ubah `PortalSummary` sesuai `dataContract.shape`. Tambahkan `headline`, `metrics[].tone`, `attention[].group`, `activity.weeks`, serta `recent[].value/unit`. Hapus `signal`.
2. `packages/bag-core/src/insights.ts` (`portalSummary`):
   - Isi `headline` (Terpasang/total) dan dua metrik sekunder.
   - Tambahkan `group` `bag-age` pada attention.
   - Hitung `activity.weeks` (12 minggu WIB, batch batal tidak dihitung).
   - Ubah judul recent sesuai `titleRules`.
3. `packages/consumables-core/src/index.ts` (`stockPortalSummary`):
   - Isi `headline` (Tersedia/operational).
   - Tambahkan dua metrik ber-tone dan group `r22-critical` serta `r22-uncounted`.
   - Hitung `activity.weeks` dari dokumen final dalam scope lokasi.
   - Ubah judul recent menjadi `{jenis dokumen} · {HAC/SAC}`.
4. Buat helper bersama `wibWeekStarts(now, 12)` untuk batas Senin 00:00 WIB. Uji di unit test, termasuk pergantian tahun dan transaksi pukul 23.59/00.00 WIB.
5. Tambah atau ubah test integrasi untuk role viewer, operator, storekeeper, dan admin. Scope equipment dan lokasi wajib tetap terbatas, dan endpoint tetap ringan (JSONC `performance`).

### Commit 2: `feat(portal): rebuild hub on the Bag Filter dashboard system`

1. `PortalHub` disusun ulang: `Heading` (dengan slot kanan), lalu `.dashboard-grid` yang berisi `.dashboard-main` (hero, kartu, segera hadir) dan `.dashboard-rail` (Aksi cepat, Aktivitas).
2. Buat komponen `PortalActivityChart` dengan markup `.bar-chart`, `.chart-grid-lines`, `.bar-slots`, `.bar-slot`, `.bar-stack`, dan `.chart-tooltip` yang sama dengan Bag Filter (`dashboard.tsx` sekitar baris 175–235). Pakai `countScale`. Komponen ini **baru** dan tidak menggantikan chart Bag Filter.
3. KPI rail perhatian: kelompokkan per `group`, tampilkan maksimal 3, dan sediakan overlay "Lihat semua" (`Overlay kind="menu"` dengan placement `bottom-end` yang sudah ada).
4. `PortalAppCard` ditulis ulang sesuai `appCard.anatomy`. Pakai `.progress-track` dan `<i class="hatched">` dari Bag Filter. Hapus `portal-signal-*` dan tombol aksi di footer.
5. Widget Aksi cepat memakai `.feature-widget` dan `.feature-contours` tanpa handler pointer.
6. Feed memakai `.recent-card` dan `.activity-row` dengan formatter waktu relatif WIB (bersama, ada unit test).
7. Hapus CSS Portal yang tidak terpakai lagi: `portal-layout`, `portal-summaries` (auto-fill), `portal-signal-*`, `portal-attention-chip*`, dan `portal-feed-*` yang tergantikan. Pertahankan hanya yang masih dirujuk.
8. Skeleton harus punya tinggi akhir yang sama untuk hero, kartu, widget, dan feed.

### Commit 3: `test(portal): cover hub layouts and scaling fixtures`

- Fixture route mock untuk 0, 1, 2, 3, dan 5 aplikasi (`scalability.fixtures`), termasuk satu endpoint gagal dan pengguna viewer saja (widget Aksi cepat tersembunyi).
- Screenshot pada 375, 768, 1280, dan 1536 px, terang dan gelap, disimpan di `docs/testing/portal-v3/`. Sertakan pasangan screenshot Bag Filter sebelum/sesudah untuk membuktikan tidak ada perubahan.
- Perbarui test e2e lama yang bergantung pada markup chip atau signal. Jelaskan setiap perubahan assertion.

## 6. Kriteria penerimaan

- [ ] Pada 1536 dan 1280 px, tepi kiri/kanan hero, grid kartu, dan baris "Segera hadir" sejajar. Tidak ada sel kosong di tengah baris.
- [ ] Lebar rail dan gap identik dengan `/bag-filter` di setiap breakpoint (ukur `getBoundingClientRect` di e2e).
- [ ] Tinggi rail sama dengan tinggi kolom main pada ≥1280 px, dan feed scroll di dalam.
- [ ] Slot aktif chart memakai lime dan `.hatched`, sedangkan slot lain memakai `--placeholder` dengan bentuk yang sama. Strip detail menyebut angka per aplikasi.
- [ ] Hanya ada satu permukaan lime (widget Aksi cepat). Tidak ada lavender, `--highlight`, atau badge hijau dekoratif.
- [ ] Angka perhatian > 0 memakai `--negativeText`, dan nilai 0 memakai teks normal dengan kalimat "Tidak ada yang perlu ditindaklanjuti".
- [ ] Tidak ada judul aktivitas "Tanpa WO". Setiap baris punya nilai dan satuan di kanan.
- [ ] Pada 1280×800 dengan 2 aplikasi aktif, heading, hero, dan kartu aplikasi terlihat tanpa scroll.
- [ ] CLS Portal ≤ 0,02 (Slow 4G, cache kosong).
- [ ] Viewer tidak melihat aksi tulis, dan scope data sesuai grant.
- [ ] Fixture 5 aplikasi rapi tanpa mengubah `apps/portal/app/page.tsx` atau CSS Portal.
- [ ] `/bag-filter` dan `/consumables` identik piksel dengan sebelum perubahan.
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm format:check`, dan e2e terkait lulus.
- [ ] `docs/UI-THEME.md` bagian Portal diperbarui dan menautkan `portal-brief.jsonc`.

## 7. Laporan

Tulis `docs/testing/portal-v3/REPORT.md` yang berisi status P1–P8, commit, pasangan screenshot, angka CLS, hasil pengukuran lebar rail/gap terhadap Bag Filter, dan keputusan yang masih terbuka. Jangan menandai kriteria sebagai selesai tanpa bukti.

## 8. Keputusan yang diambil dalam brief ini (dapat dibatalkan pengguna)

1. **Aksi cepat pindah dari footer kartu ke widget lime di rail.** Aksinya tetap satu klik dan menjadi lebih menonjol. Kartu aplikasi murni menampilkan status. Jika pengguna ingin tombol tetap di kartu, pertahankan juga di footer kartu, dan widget menampilkan aksi yang sama.
2. **Eyebrow Portal mengikuti gaya gold (huruf besar, format breadcrumb).** Ini membalik sebagian keputusan A2 pada audit pertama. Penyelarasan eyebrow Consumable Room dilakukan di pekerjaan terpisah.
3. **Jarak antarkartu 16 px mengikuti gold**, bukan 32/48 px dari audit pertama, agar Portal dan Bag Filter berirama sama.
4. **Distribusi umur 7 kelompok tidak ditampilkan di Portal.** Informasinya sudah terwakili oleh grup perhatian "Bag ≥ 1.260 hari" dan tersedia lengkap di Bag Filter.
