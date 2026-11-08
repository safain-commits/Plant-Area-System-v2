# Prompt lanjutan: font Inter, Portal yang siap bertambah aplikasi, dan posisi menu header

> Instruksi untuk coding agent. Dokumen ini melanjutkan [UI-AUDIT-PORTAL-CONSUMABLES.md](UI-AUDIT-PORTAL-CONSUMABLES.md) dan [laporan eksekusinya](../testing/ui-audit-2026-11/REPORT.md).
> Audit dibuat pada 8 November 2026 terhadap commit `ec6369b`, dari source dan screenshot di `docs/testing/ui-audit-2026-11/after/`. Aplikasi tidak dijalankan saat audit. Temuan posisi menu (§4) dihitung dari kode, jadi wajib dikonfirmasi dengan screenshot sebelum diperbaiki.

## 0. Konteks dan prioritas acuan

Ada tiga sumber aturan UI dan sebagian saling bertentangan. Urutan yang berlaku:

1. Keputusan pada dokumen ini.
2. [UI-AUDIT-PORTAL-CONSUMABLES.md](UI-AUDIT-PORTAL-CONSUMABLES.md) beserta hasilnya.
3. [ui-brief.jsonc](ui-brief.jsonc) dan [UI-REFRESH.md](UI-REFRESH.md), yaitu brief awal bergaya dashboard "ACRU" (kanvas abu-abu, kartu putih tanpa border, lime sebagai warna data, ink untuk keputusan, rail kanan 360 px).

Brief awal masih menjadi acuan _karakter visual_. Beberapa nilainya sudah diganti audit dan tidak boleh dikembalikan: ukuran 10–11 px, tagline dan feature widget di Portal/R22, serta tilt di Portal. Aturan PRD, keputusan sesi 8 jam, sidebar terang/gelap, skala umur, dan seleksi double ring tetap berlaku. Halaman Bag Filter tetap gold standard.

Ikuti `AGENTS.md`, termasuk Context7 untuk dokumentasi Next.js 16 (`next/font/local`) dan aturan validasi.

---

## 1. Keputusan font: self-host Inter

### Keputusan

Ganti font sistem dengan **Inter variable yang di-host sendiri di repo**. Font sistem tetap menjadi fallback.

Alasannya:

1. **Konsistensi lintas perangkat.** PC klien SBI Tuban kebanyakan Windows (Segoe UI). Mac memakai SF, Android memakai Roboto. Dengan font sistem, lebar teks, bentuk angka, dan pemotongan label berbeda di tiap perangkat, sehingga layout tidak bisa diuji sekali untuk semua.
2. **Data padat.** Inter punya angka tabular, sumbu optical size (`opsz`), dan stylistic set _disambiguation_ (`ss02`) yang membedakan `I l 1` dan `0 O`. Fitur ini penting untuk kode seperti `L61-BF1`, MMID, HAC/SAC `452-BU1`, nomor dokumen R22, dan koordinat bag.
3. **Sesuai brief awal.** Brief menyebut "geometric grotesk, fallback Inter". Skill `apple-design` §15 menyarankan font sistem kecuali ada alasan, dan konsistensi lintas platform untuk produk bermerek adalah alasan yang sah.
4. **Tidak melanggar keamanan.** CSP di `infra/nginx/default.conf.template:46` (`default-src 'self'`) memblokir Google Fonts CDN, tetapi mengizinkan font dari origin sendiri. Self-host juga tetap bekerja di jaringan pabrik tanpa internet.

### Sumber file

Mengunduh dari Google Fonts boleh. Paket unduhannya berisi **TTF** (`Inter-VariableFont_opsz,wght.ttf` dan versi italic) yang terlalu besar untuk web. Pilih salah satu cara:

- **Disarankan:** ambil `InterVariable.woff2` dari release resmi `rsms/inter` di GitHub (versi 4.x, sudah woff2, memiliki `opsz` dan `wght`) https://github.com/rsms/inter/blob/master/docs/font-files/InterVariable.woff2.
- **Atau:** subset TTF dari Google Fonts menjadi woff2 dengan fonttools, sambil mempertahankan seluruh fitur OpenType:

  ```bash
  pip install fonttools brotli
  pyftsubset "Inter-VariableFont_opsz,wght.ttf" \
    --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2190-2199,U+2212,U+2215,U+2248,U+2260,U+2264-2265" \
    --layout-features='*' --flavor=woff2 \
    --output-file=InterVariable-latin.woff2
  ```

  Rentang ini mencakup teks Indonesia, `· – — … → ≥ ≤ ×`, dan simbol mata uang. Periksa hasilnya dengan menampilkan seluruh karakter yang dipakai UI (grep string JSX) dan pastikan tidak ada karakter yang jatuh ke fallback.

Aturan file:

- Hanya kirim **roman variable**. UI tidak memakai italic (sudah dicek: tidak ada `font-style: italic` atau `<em>` di `packages/ui` dan `apps`).
- Simpan di `packages/ui/assets/fonts/` bersama `OFL.txt` (lisensi SIL Open Font License 1.1 wajib disertakan) dan README singkat berisi versi serta sumber.
- Catat ukuran file di laporan. Ukuran Latin woff2 seharusnya jauh lebih kecil daripada TTF asli.

### Implementasi

1. **Loader.** Pakai `next/font/local` jika bisa dipanggil dari modul bersama `packages/ui` (cek dokumentasi Next 16 lewat Context7 dan pastikan bekerja dengan `transpilePackages` serta `basePath` per aplikasi). Tujuannya adalah preload otomatis dan fallback dengan metrik yang disesuaikan, sehingga pergantian font tidak menggeser layout.
   - Jika tidak bisa dari modul bersama, panggil di keempat `layout.tsx` (portal, auth, bag-filter, consumables) dengan path ke file yang sama.
   - Alternatif terakhir adalah `@font-face` di `tokens.css` dengan `font-display: swap` ditambah fallback `@font-face` lokal ber-`size-adjust`/`ascent-override` untuk Segoe UI dan Arial.
2. **Token.** Tambahkan `--font-sans: var(--font-inter, 'Inter'), var(--font-system);` di `tokens.css`. Ubah `refresh.css:4` dari `var(--font-system)` menjadi `var(--font-sans)`, dan pertahankan `font-optical-sizing: auto`.
3. **Kode dan identitas.** Buat utilitas `.code-text { font-feature-settings: 'ss02', 'tnum'; }` untuk MMID, kode equipment, HAC/SAC, nomor dokumen, WO, dan koordinat. Jangan aktifkan `ss02` untuk teks biasa.
4. **Weight.** Tetapkan token weight: `--weight-regular: 400` (isi), `--weight-medium: 500` (label, tombol, angka KPI, sesuai brief "large, medium weight"), dan `--weight-semibold: 600` (judul h1–h3). Saat ini ada 8 deklarasi `font-weight: 600` campuran; normalisasikan ke token.
5. **Tracking.** Kalibrasi ulang setelah ganti font. Inter butuh tracking negatif lebih kuat di ukuran besar (display −0.025em, large −0.02em, title −0.01em, body 0, caption +0.005em). Hapus tracking px peninggalan label huruf besar yang sekarang dipakai pada teks sentence case:
   - `workspace.css:22` `.nav-label` 1.8px (label "Ruang kerja" terlihat renggang).
   - `workspace.css:100` `.footer` 1.2px.
   - `workspace.css:83` `.topbar` 1.3px.
   - `workspace.css:13`, `:18`, `:284`, `:292` (brand). Cek apakah masih dirender, dan hapus jika tidak.
6. **Cetak bukti R22.** Pastikan `@media print` tetap memakai Inter dan font sudah termuat sebelum `window.print()` (`await document.fonts.ready`).
7. **Dokumentasi.**
   - Ubah kalimat "Tidak menambahkan … resource font eksternal" di `docs/UI-THEME.md` menjadi "font di-host sendiri; tidak ada CDN font".
   - Perbarui `typography.family` di `ui-brief.jsonc` agar agent berikutnya tidak kembali ke Satoshi/General Sans atau ke font sistem.

### Kriteria selesai (font)

- [ ] DevTools → Rendered Fonts menunjukkan Inter pada heading, body, input, select, button, `kbd`, dan tabel di keempat aplikasi.
- [ ] Network: satu request woff2 per aplikasi dari origin sendiri, `Cache-Control` immutable, dan tidak ada request ke domain luar. CSP tidak diubah.
- [ ] CLS Portal dan `/consumables` ≤ 0,02 pada throttling "Slow 4G" dengan cache dikosongkan.
- [ ] Screenshot Portal, R22, dan Bag Filter di Chromium dan WebKit (Playwright) tampak identik bentuk hurufnya.
- [ ] Bag Filter: geometri peta tidak berubah. Jika label sel peta memakai ukuran px tetap, pastikan tidak terpotong dengan Inter dan catat di laporan.

---

## 2. Masalah kecil yang terlihat di screenshot setelah Codex

**S1 · P1: Ukuran label sidebar tidak konsisten.** Di `portal-1536-light.png`, "Portal", "Profil saya", dan "Kelola akses" tampil 16 px, sedangkan "Bag Filter" dan "Consumable Room" 14 px. Penyebabnya `workspace.css:800-803` (`.sidebar nav .sidebar-label { font-size: var(--type-headline) }`), yang ditimpa hanya untuk link aplikasi di `:905-907`. **Perbaikan:** semua label navigasi tingkat atas memakai `--type-body` dengan weight 500. Sub-item tree juga memakai `--type-body` dengan weight 400.

**S2 · P2: Sisa aturan sidebar gelap lama.** `workspace.css:30-55` masih berisi `.sidebar nav a` dengan `--inverse-muted`, hover `--brand-slate`, aktif `--action`, dan `span { width: 17px }`. Aturan ini mungkin tertimpa, tapi tetap menjadi jebakan cascade. Hapus jika tidak ada lagi elemen yang memakainya (buktikan dengan screenshot sebelum/sesudah).

---

## 3. Portal: hub yang tenang tapi berisi, dan siap untuk aplikasi baru

### Kondisi sekarang

- Portal hanya berisi salam, chip "Perlu perhatian", dan dua kartu yang **dikodekan langsung**, yaitu `Dashboard variant="compact"` dan `StockSummary variant="compact"` (`apps/portal/app/page.tsx:20-24`). Aplikasi rencana hanya muncul sebagai satu baris teks kecil di atas footer (`:30-37`).
- Kartu terlihat kosong. Separuh tinggi kartu berisi "Aktivitas terbaru" yang sering bernilai "Belum ada…", dan karena setiap aplikasi punya feed sendiri, feed kosong berulang di setiap kartu.
- `PortalAttention` memanggil `/bag-filter/api/dashboard` dan `/consumables/api/dashboard` (`portal-attention.tsx:14`, `:27`). `Dashboard` dan `StockSummary` memanggil endpoint yang sama lagi (`dashboard.tsx:91`, `stock-summary.tsx:46`). Akibatnya ada dua request per aplikasi untuk data yang sama.
- `PortalAttention` mengembalikan `null` sampai data datang (`portal-attention.tsx:51`), sehingga kartu di bawahnya **melompat turun** setelah halaman tampil (layout shift).
- Menambah Drawing Database saat ini berarti mengedit `page.tsx`, `portal-attention.tsx`, dan membuat komponen ringkasan baru. Tidak ada kontrak bersama, sehingga setiap aplikasi baru berisiko merusak keseimbangan layout.
- Entri `planned` di `appCatalog` (`packages/contracts/src/index.ts:236-253`) tidak punya `icon`.

### Prinsip desain

Portal adalah **titik berangkat kerja**, bukan dashboard analitik. Pengguna datang untuk tahu apa yang perlu ditindaklanjuti, melihat kondisi tiap aplikasi sekilas, lalu masuk ke aplikasi. Tingkat kepadatan yang dituju: satu layar 1280×800 terisi tanpa scroll untuk dua aplikasi aktif, dan halaman tetap rapi saat ada lima aplikasi. Acuan dari brief awal adalah kolom utama dan **rail kanan 360 px**.

### Tata letak target

```text
≥1280 px  (kolom utama fleksibel + rail 360 px, gap 32)
┌──────────────────────────────────────────────┬──────────────────────┐
│ Portal                                       │                      │
│ Selamat sore, Operator.   Minggu, 8 Nov 2026 │                      │
├──────────────────────────────────────────────┤  Aktivitas terbaru   │
│ Perlu perhatian                              │  (gabungan semua     │
│ [▲ 1 Kritis, stok nol ›] [● 1 Belum dihitung›]│   aplikasi, 8 baris, │
│  — atau — ✓ Tidak ada yang perlu ditindak... │   ikon aplikasi,     │
├──────────────────────┬───────────────────────┤   scroll internal)   │
│ ⛉ Bag Filter         │ ◫ Consumable Room     │                      │
│ 18.784   0      0    │ 3      1      1       │  [Semua][BF][R22]    │
│ ▬▬▬▬▬▬▬▬▬▬ (umur)    │ ▬▬▬▬▬▬▬ (ketersediaan)│   (chip filter muncul │
│ [Catat penggantian]  │ [Consume Order]       │    bila ≥3 aplikasi) │
│ Buka Bag Filter   →  │ Buka Consumable Room →│                      │
├──────────────────────┴───────────────────────┤                      │
│ Segera hadir                                 │                      │
│ ▢ Drawing Database · ▢ Root Cause Analysis · │                      │
│ ▢ Part Cost   (tile ringkas 1 baris, redup)  │                      │
└──────────────────────────────────────────────┴──────────────────────┘
768–1279: rail pindah ke bawah kolom utama; kartu aplikasi 2 kolom.
<768: satu kolom; KPI kartu memakai pola baris label–nilai yang sudah ada.
```

Elemen yang ditambahkan agar Portal berisi tanpa menjadi ramai:

1. **Garis sinyal per kartu.** Tambahkan satu bar komposisi setinggi 6–8 px dengan legenda singkat saat hover/fokus. Bag Filter memakai distribusi umur 7 kelompok dengan token `--age-*` (data sudah ada di `distribution`). Consumable Room memakai komposisi Tersedia / Stok nol / Belum dihitung dengan token `--series-*`, dan lime hanya untuk "Tersedia". Bar ini memberi warna dan informasi tanpa menambah kartu.
2. **Satu aksi utama per kartu**, sesuai role (logika sudah ada di `StockSummary`). Contohnya "Catat penggantian" untuk operator Bag Filter, "Consume Order"/"Penerimaan Picklist" untuk R22, dan tidak ada aksi untuk viewer. Tampilkan sebagai tombol sekunder kecil, sedangkan "Buka …" tetap menjadi link di footer.
3. **Feed aktivitas gabungan di rail kanan** menggantikan "Aktivitas terbaru" per kartu. Kartu menjadi lebih pendek dan sama tinggi, sementara feed tetap satu walau aplikasinya bertambah.
4. **Status "Perlu perhatian" selalu punya tempat.** Saat memuat, tampilkan skeleton chip. Jika kosong, tampilkan satu baris tenang "✓ Tidak ada yang perlu ditindaklanjuti". Chip memakai ikon aplikasi dan warna semantik (`--warningText` atau danger untuk kritis), diurutkan menurut tingkat keparahan, dan maksimal 4 chip ditambah "Lihat semua (n)".
5. **"Segera hadir" sebagai tile ringkas** setinggi ±56 px dalam satu baris (ikon garis, nama, deskripsi satu baris, warna `--textSecondary`, latar `--surfaceMuted`). Tile tidak punya badge berwarna atau link, sehingga tidak terlihat bisa diklik. Bagian ini lebih terlihat daripada footnote sekarang, tetapi tetap lebih rendah tingkatnya daripada kartu aktif.
6. Tanggal WIB di sebelah salam, sebagai teks sekunder.

Yang **tidak** ditambahkan: chart kuartal, gauge, feature widget/tagline, tilt, eyebrow kartu, dan badge "Aktif".

### Kontrak ringkasan aplikasi (inti skalabilitas)

Tambahkan di `@plant/contracts`:

```ts
export type PortalTone = 'neutral' | 'accent' | 'warning' | 'danger';
export type PortalSummary = {
  appId: AppId;
  updatedAt: string; // ISO
  metrics: { key: string; label: string; value: number; unit?: string; href?: string }[]; // 1–3
  signal?: {
    label: string;
    scale: 'age' | 'series';
    segments: { key: string; label: string; value: number; tone?: PortalTone }[];
  };
  attention: { key: string; label: string; value: number; severity: 'warning' | 'danger'; href: string }[];
  recent: { id: string; title: string; meta: string; at: string; href: string }[]; // ≤ 5
  action?: { label: string; href: string; icon: IconName }; // sudah difilter role
};
```

- Tambahkan field `icon` ke **semua** entri `appCatalog`, termasuk yang `planned`, serta ikon baru di `icon.tsx` dengan stroke dan grid yang sama: `drawing` (lembar dengan sudut terlipat), `rca` (bercabang/fishbone sederhana), dan `cost` (tag harga). Field opsional `portalSummary: '/<app>/api/portal-summary'` hanya untuk aplikasi aktif.
- Setiap aplikasi aktif menyediakan `GET /<app>/api/portal-summary`. Endpoint ini memakai sesi dan scope yang sama dengan dashboard aplikasi, bersifat ringan (tidak membawa seri kuartal), dan diuji izin viewer/operator/admin. Bag Filter dan Consumables membuat endpoint ini dari query yang sudah ada. **Jangan mengubah kontrak `/api/dashboard`.**
- Portal membaca daftar aplikasi dari `appCatalog`, lalu mengambil semua ringkasan **paralel, satu request per aplikasi**, dengan timeout 5 detik dan isolasi error per aplikasi. Kartu yang gagal menampilkan error kecil dengan tombol "Coba lagi", sedangkan kartu lain tetap tampil. "Perlu perhatian" dan feed rail diturunkan dari hasil yang sama. Hapus `PortalAttention` yang melakukan fetch sendiri.
- Buat komponen `PortalAppCard` generik dari kontrak (gantikan `ApplicationSummary` dan varian compact `Dashboard`/`StockSummary` khusus Portal). Varian compact yang tidak dipakai lagi dihapus, tetapi `/bag-filter` dan `/consumables` tidak boleh berubah.
- Grid kartu: `grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr))`, kartu dalam satu baris sama tinggi, dan anatomi kartu tetap rapi dengan 1, 2, atau 3 metrik serta dengan atau tanpa `signal` dan `action`.

Dengan kontrak ini, mengintegrasikan Drawing Database cukup dengan: (1) mengubah status katalog menjadi `active`, (2) menyediakan endpoint `portal-summary`, dan (3) menambah grant. **Tidak ada perubahan** pada `apps/portal/app/page.tsx` atau CSS Portal.

### Kriteria selesai (Portal)

- [ ] Fixture uji (Playwright dengan route mock, tanpa data nyata) untuk 0, 1, 2, 3, dan 5 aplikasi aktif, termasuk aplikasi fiktif dengan 1 metrik tanpa sinyal dan aplikasi yang endpoint-nya gagal. Ambil screenshot 375/768/1280/1536, terang dan gelap.
- [ ] Satu request ringkasan per aplikasi. Tidak ada lagi request `/api/dashboard` dari Portal.
- [ ] CLS Portal ≤ 0,02, dan blok "Perlu perhatian" tidak menggeser kartu.
- [ ] Pada 1280×800 dengan 2 aplikasi aktif, heading, perhatian, dua kartu, dan "Segera hadir" terlihat tanpa scroll.
- [ ] Viewer tidak melihat tombol aksi, dan scope equipment/stok sesuai grant.
- [ ] Setiap warna non-teks berkontras ≥ 3:1 terhadap surface, termasuk segmen sinyal (pakai pemisah 2 px warna surface antarsegmen).

---

## 4. Posisi menu header di desktop ("Aktivitas aplikasi" dan Akun)

Kedua menu memakai `Overlay kind="menu"` dengan `anchor` (`packages/ui/src/workspace.tsx:592-598` dan `:640-646`). Posisi dihitung di `packages/ui/src/overlay.tsx:124-141`. Contoh perhitungan memakai `portal-1536-light.png`: lonceng berada di x 1224–1272, chip akun di x 1284–1512, gutter konten kanan 24 px, dan lebar menu 320 px (`refresh.css:651-660`).

**M1 · P1: Menu tidak sejajar dengan pemicunya.**

- Kode menyejajarkan tepi **kiri** menu dengan tepi kiri pemicu (`desiredLeft = rect.left`), lalu menjepitnya ke `innerWidth - width - 8`. Lonceng (1224) dan chip akun (1284) sama-sama terjepit ke x ±1208, sehingga **kedua menu muncul di posisi yang persis sama** dan tidak menempel ke pemicu masing-masing.
- Tepi kanan menu (±1528) melewati gutter konten (1512), sehingga menu tidak sejajar dengan apa pun di header.
- Origin `top right` ditulis, tetapi tepi kanan menu tidak berada di pemicu. Akibatnya scale-in berasal dari titik ±250 px di kanan lonceng, padahal skill §7 meminta animasi berasal dari pemicu.
- **Perbaikan:** tambahkan `placement="bottom-end"` untuk menu header. Tepi kanan menu = `rect.right`, `left = rect.right - width`, lalu jepit ke batas viewport. Origin = titik bawah tengah pemicu, dihitung relatif ke kotak menu (`--anchor-origin: ${rect.left + rect.width / 2 - left}px 0`). Origin dalam px ini juga berlaku untuk placement lain, sehingga scale selalu berasal dari pemicu.

**M2 · P1: Ukuran menu diukur saat sedang di-scale.**

- `overlay.tsx:118-126` menghapus `data-entering` lalu langsung memanggil `getBoundingClientRect()`. Pada saat itu transisi baru mulai dan `transform` masih `scale(0.96)` (`refresh.css:1427-1444`). `getBoundingClientRect` ikut terkena transform, sehingga lebar terbaca ±307 px, bukan 320, dan tinggi juga 4% lebih kecil.
- Akibatnya batas jepit meleset sekitar 13 px dan menu bisa terpotong di tepi kanan atau bawah.
- **Perbaikan:** ukur dengan `offsetWidth`/`offsetHeight`, yang tidak terkena transform. Hitung posisi **sebelum** memulai transisi masuk.

**M3 · P1: `innerWidth` termasuk scrollbar.**

- `html { scrollbar-gutter: stable }` (`refresh.css:1404-1406`) selalu menyisakan ruang scrollbar. Di Windows dengan scrollbar klasik (±15–17 px, kondisi PC klien), `innerWidth` lebih lebar daripada area yang benar-benar terlihat, sehingga menu dapat masuk ke bawah gutter scrollbar.
- **Perbaikan:** gunakan `document.documentElement.clientWidth`/`clientHeight`, atau `visualViewport` jika tersedia, sebagai batas jepit. Uji dengan Chromium `--hide-scrollbars` dimatikan, atau emulasi Windows.

**M4 · P2: Ukuran dan tinggi menu.**

- Menu Akun 320 px lebih lebar daripada chip 228 px. Ini boleh, asalkan tepi kanannya sejajar chip (M1). Gunakan `min-width: max(trigger width, 260px)`.
- Menu Aktivitas berisi baris batch atau dokumen yang panjang. Lebarnya menjadi 380 px, dengan `max-height: min(480px, 100dvh - top - 16px)` dan scroll internal yang memiliki fade di tepi (sesuai brief).
- Hitung ulang posisi saat `resize`, atau tutup menu saat ukuran viewport berubah.

**M5 · P2: Timing menu terlalu lambat untuk menu.**

- Menu memakai transisi bersama overlay (`--duration-moderate` 280 ms untuk masuk dan keluar, `refresh.css:1432-1439`). Brief meminta menu masuk dalam waktu kurang dari 200 ms dan keluar lebih cepat. Skill `apple-design` meminta menu tanpa overshoot.
- **Perbaikan:** `.overlay-menu` memakai `--duration-fast` (140 ms) untuk masuk dan sekitar 100 ms untuk keluar, dengan `--ease-standard`. Pembalikan di tengah animasi tetap harus mulus.
- `animation-duration: var(--duration-fast)` di `refresh.css:659` sudah tidak berfungsi sejak animasi diganti transisi. Hapus baris itu.

**M6 · P3 (opsional): Semantik menu.** Menu header saat ini memakai `showModal()`, yang membuat seluruh halaman inert dan menuntut satu klik untuk menutup sebelum bisa mengklik hal lain. Untuk menu ringan, atribut `popover` (light dismiss, top layer, non-modal) lebih tepat. Ubah hanya jika fokus keyboard, Escape, pengembalian fokus, dan test `menu-focus.spec.ts` tetap lulus di Chromium dan WebKit. Jika berisiko, tunda dan catat.

### Kriteria selesai (menu)

- [ ] Test Playwright baru di `tests/e2e/menu-focus.spec.ts` atau file baru, pada lebar 1024, 1280, dan 1536, dengan dan tanpa scrollbar klasik:
  - Tepi kanan menu = tepi kanan pemicu ±1 px, kecuali ketika dijepit.
  - Menu sepenuhnya berada di dalam `clientWidth - 8` dan `clientHeight - 8`.
  - Jarak vertikal ke pemicu 8 px.
  - Origin transform berada di dalam kotak pemicu.
- [ ] Menu Aktivitas dan Akun tidak lagi muncul di koordinat x yang sama.
- [ ] Screenshot kedua menu terbuka (1280 dan 1536, terang dan gelap) disimpan di `docs/testing/ui-audit-2026-11/followup/`.
- [ ] Menu tema, Select, dan flyout sidebar (`placement="right"`) tidak mengalami regresi.

---

## 5. Urutan kerja dan laporan

1. Commit 1, `fix(ui): anchor header menus to their triggers` (§4). Ini perbaikan paling kecil dan paling terukur.
2. Commit 2, `style(ui): self-host Inter and normalize type weights` (§1 dan S1–S2), dengan screenshot pembanding semua aplikasi.
3. Commit 3, `feat(contracts): add portal summary contract and endpoints` (kontrak, ikon katalog, dua endpoint, test izin).
4. Commit 4, `feat(portal): render hub from app catalog` (§3).

Setelah setiap commit, jalankan `pnpm typecheck`, `pnpm test`, `pnpm format:check`, dan E2E terkait sesuai README (deployment `plant-v2-test`).

Tambahkan bagian "Follow-up 8 November" di `docs/testing/ui-audit-2026-11/REPORT.md` yang berisi status per ID (font, S1–S2, Portal, M1–M6), ukuran file font, angka CLS, dan pasangan screenshot. Perbarui `docs/UI-THEME.md` bagian Portal dan menu. Jangan menulis "selesai" untuk kriteria yang belum diverifikasi.
