# Prompt: Perbaikan UI Portal dan Consumable Room berdasarkan audit `apple-design`

> Dokumen ini adalah instruksi untuk coding agent. Bacalah seluruhnya sebelum mengubah kode.
> Audit dibuat pada 7 November 2026 dari pembacaan source code (statis) terhadap working tree saat ini.
> Aplikasi belum dijalankan saat audit, sehingga setiap temuan visual wajib dikonfirmasi dengan screenshot sebelum dan sesudah perubahan.

---

## 1. Peran dan tujuan

Anda adalah senior product engineer yang memperbaiki kualitas UI **Portal** (`apps/portal`) dan **Consumable Room / R22** (`apps/consumables`) beserta komponen bersama di `packages/ui`. Tujuannya adalah membuat kedua area ini terasa **tenang, presisi, dan responsif**, seperti alat kerja profesional. Saat ini kesannya masih seperti template dashboard hasil generator.

Gunakan skill **`apple-design`** sebagai lensa utama. Jika tersedia, skill `review-animations`, `improve-animations`, dan `animation-vocabulary` dapat dipakai sebagai pendukung. Prinsip yang paling relevan:

- **Response** (§1): umpan balik muncul saat pointer-down, dan tidak ada latensi buatan di jalur input.
- **Interruptibility** (§3) dan **springs** (§4): animasi dapat diinterupsi dan selalu dimulai dari nilai yang sedang tampil.
- **Velocity handoff dan momentum** (§5–6): keputusan menutup sheet/drawer didasarkan pada kecepatan, bukan hanya posisi.
- **Spatial consistency** (§7): jalur masuk sama dengan jalur keluar, dan origin animasi berada pada elemen pemicu.
- **Rubber-banding** (§9) serta **frame-level smoothness** (§11): animasikan hanya `transform` dan `opacity`.
- **Materials** (§12) dan **reduced motion/transparency/contrast** (§14).
- **Typography** (§15): tracking per ukuran, leading, hierarki dari weight dan ukuran, serta skala yang menghormati pengaturan teks pengguna.
- **Purpose, Simplicity, Craft, Familiarity** (§16): setiap elemen harus pantas mendapat tempatnya.

## 2. Batasan yang tidak boleh dilanggar

1. **PRD-v2.md dan CONSUMABLE-ROOM-PRD.md tetap otoritatif untuk perilaku fungsional.** Jangan mengubah alur bisnis R22, kontrak API, validasi server, role/scope, atau data.
2. Keputusan desain yang sudah dikunci pengguna:
   - Sidebar terang pada tema terang dan gelap pada tema gelap. Sidebar dapat diciutkan menjadi rail 76 px, dengan lebar penuh 248 px.
   - Tombol primer berwarna ink. Palet primer lime dan sekunder pumpkin.
   - Skala umur bag adalah lime → kuning → oranye → merah (lihat `--age-*` di `tokens.css`).
   - Seleksi bag memakai double ring ink.
   - Tidak ada UI timer atau perpanjangan sesi; sesi berlaku absolut 8 jam.
3. **Halaman aplikasi Bag Filter adalah gold standard dan tidak boleh diubah tampilannya.** Perbaikan dashboard Bag Filter yang tampil di Portal dilakukan melalui _varian Portal_ yang baru, bukan dengan mengubah `/bag-filter`.
4. Jangan menambah dependency UI tanpa persetujuan pengguna (lihat `docs/UI-THEME.md`). Spring dan gesture dibuat dengan utilitas kecil buatan sendiri, CSS transition, atau `@starting-style`. Jika Motion/Framer Motion dirasa perlu, **tanyakan dulu**.
5. Saat audit, working tree memiliki perubahan yang belum di-commit pada `order-cart.tsx`, `picklist.tsx`, `quantity-dialog.tsx`, `workspace.tsx` (consumables), `confirm.tsx`, `consumables.css`, dan `index.tsx`. Jalankan `git status` dan `git diff` lebih dulu. **Jangan menimpa atau membuang pekerjaan tersebut.** Bangun perbaikan di atasnya.
6. Bahasa UI adalah Bahasa Indonesia. Istilah dokumen klien (_Consume Order_, _Return Order_, _Picklist_, _HAC/SAC_, _R22_, _MMID_, _WO_) adalah nama resmi dan tetap dipakai. Label lain yang masih berbahasa Inggris diterjemahkan.
7. Semua warna, radius, durasi, dan easing harus berasal dari token di `packages/ui/src/tokens.css`. Jangan menulis literal hex atau rgba baru di file komponen.

## 3. Cara kerja

1. Ambil screenshot **sebelum** perubahan untuk `/`, `/consumables`, `/consumables/stock`, `/consumables/consume`, `/consumables/picklist`, dan `/consumables/history`. Lakukan pada lebar 375, 768, 1280, dan 1536 px, dalam tema terang dan gelap. Simpan di `docs/testing/ui-audit-2026-11/before/`.
2. Kerjakan fase pada §6 secara berurutan. Buat satu commit per fase dengan pesan bergaya Conventional Commits.
3. Di akhir setiap fase, jalankan lint, typecheck, unit test, dan Playwright yang sudah ada (`pnpm -w lint`, `pnpm -w typecheck`, `pnpm -w test`, `pnpm -w e2e`, atau nama script yang ada di `package.json`).
4. Ambil screenshot **sesudah** dengan matriks yang sama, lalu tulis laporan sesuai §8.

---

## 4. Ringkasan hasil audit

| Area                  | Kondisi                       | Masalah inti                                                                                                                                                                                                                                                                                       |
| --------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI slop dan kurasi    | Buruk                         | Kartu promosi bergradien lime dengan tagline, efek tilt 3D, eyebrow huruf besar di hampir setiap kartu, ikon glyph Unicode, badge status yang selalu bernilai sama, dan teks keterangan berlapis.                                                                                                  |
| Animasi dan interaksi | Sedang                        | Animasi masuk ada, tetapi animasi keluar tidak ada. Origin menu tidak berada pada pemicu. Gesture drawer/sheet hanya memakai ambang posisi tanpa kecepatan atau spring. `:active scale` diterapkan pada baris tabel lebar. Ada debounce pada select/pagination dan count-up di setiap KPI.         |
| Typography            | Sedang                        | Font stack menyebut Inter yang tidak pernah dimuat. Ada 12 ukuran font, 37 di antaranya teks 10–11 px. Semua ukuran memakai px dengan root 14 px. Angka di tabel rata kiri. Hierarki terbalik, misalnya jumlah item 32 px yang lebih menonjol daripada tombol Submit.                              |
| Layout                | Buruk (Portal) / Sedang (R22) | Portal merender ulang dashboard Bag Filter penuh, lalu menambahkan tiga jalur navigasi ke aplikasi yang sama. `loading.tsx` tampil tanpa shell sehingga sidebar hilang saat navigasi. Detail material dibuka sebagai dialog, sedangkan detail riwayat sebagai sheet. Breakpoint ditentukan ad-hoc. |
| White space           | Sedang                        | Nilai spacing di luar grid (5, 6, 10, 14, 18, 20, 22, 30 px) bercampur dengan skala 4/8. Jarak antarseksi sama dengan jarak antarkartu, sehingga halaman tidak bernapas.                                                                                                                           |
| Warna                 | Sedang                        | Warna seri chart Consumables (lime, pumpkin, kuning) bertabrakan dengan makna skala umur di halaman yang sama. Segmen `--highlight` di atas putih hanya mencapai kontras 1,2:1. Terlalu banyak aksen (lime, pumpkin, kuning, lavender, hijau sukses) dipakai sebagai dekorasi.                     |

Kekuatan yang **harus dipertahankan**: token warna sudah rapi (tidak ada literal hex di luar `tokens.css`). Sudah ada `prefers-reduced-motion`. Overlay memakai `<dialog>` dengan pengembalian fokus. Angka sudah memakai `tabular-nums`. Target sentuh 44 px di mobile. Sidebar memiliki tree navigation dan view transition indikator aktif.

---

## 5. Temuan dan perbaikan

Format setiap temuan: **ID · Prioritas** (P1 wajib, P2 sangat disarankan, P3 polish), lalu bukti, prinsip skill, perbaikan, dan kriteria selesai.

### A. AI slop dan kurasi konten

**A1 · P1: Kartu promosi "feature widget" di Portal dan Consumable Room**

- Bukti: `packages/ui/src/stock-summary.tsx:322-334` berisi tagline _"Material siap, pekerjaan lancar."_, `feature-contours`, dan eyebrow "MATERIAL CONTROL". `packages/ui/src/dashboard.css:387-440` berisi radial-gradient lime, shadow bercahaya hijau (`box-shadow … --primary-700 55%`), dan kontur dekoratif berputar. `dashboard.tsx:417-422` berisi tilt 3D `perspective(800px) rotateX/rotateY` yang mengikuti pointer.
- Prinsip: §16 Purpose dan Delight ("delight is the result… not confetti tacked on top"), serta §1 (tilt dengan transisi 200 ms tertinggal dari pointer).
- Perbaikan:
  - Di **Consumable Room**, ganti `stock-action-card` dengan panel **Aksi cepat** biasa (surface putih/gelap, tanpa gradien atau kontur). Panel berisi 1 tombol primer ink sesuai role (Picklist / Consume Order / Cari material) dan maksimal 2 link sekunder. Tanpa tagline.
  - Di **Portal**, varian Portal tidak memakai feature widget sama sekali (lihat D1).
  - Hapus handler tilt dari _varian Portal_. Jangan mengubah `/bag-filter`.
- Selesai bila: tidak ada lagi gradien, kontur, atau tagline di Portal dan Consumable Room, serta tidak ada `perspective(` yang dirender di Portal.

**A2 · P1: Eyebrow huruf besar di hampir setiap blok**

- Bukti: "OPERATIONS HUB" (`apps/portal/app/page.tsx:14`), "MATERIAL CONTROL" (`apps/consumables/app/page.tsx:10`, `stock-summary.tsx:74`, `:324`), "AKTIVITAS MATERIAL" (`stock-summary.tsx:196`), "CONSUMABLE ROOM" di 7 halaman (`[section]/page.tsx:38`), "R22 · PENGAMBILAN" (`order-cart.tsx:227`), "FINALISASI ORDER" (`order-cart.tsx:430`), dan "WAREHOUSE SAP → R22" (`picklist.tsx:241`).
- Prinsip: §16 Simplicity ("every element earns its place") dan direct specific labels.
- Perbaikan: eyebrow hanya dipakai pada **judul halaman** sebagai penanda aplikasi untuk wayfinding (misalnya "Consumable Room" di atas "Consume Order"), ditulis _sentence case_ dalam Bahasa Indonesia, tanpa huruf besar semua. Hapus eyebrow di level kartu. Jika kartu butuh konteks, masukkan ke judul kartu (contoh: "Informasi Consume Order").
- Selesai bila: setiap halaman memiliki maksimal 1 eyebrow, dan tidak ada eyebrow berbahasa Inggris.

**A3 · P1: Ikon glyph Unicode dan badge yang selalu bernilai sama di Portal**

- Bukti: `apps/portal/app/page.tsx:35` (`▦`), `:46` (`↗`), dan `:66` (`□`). Badge "Aktif" di setiap kartu aplikasi (semua kartu yang tampil memang aktif). Badge "Akun aktif" dengan `live-dot` (`:18-21`), padahal pengguna yang melihat halaman pasti sedang aktif. Subjudul "Siap digunakan" (`:29`).
- Perbaikan: pakai `<Icon>` bersama (tambahkan ikon `filter`/`box` yang sesuai per aplikasi di `appCatalog`). Hapus badge "Aktif", "Akun aktif", dan subjudul "Siap digunakan". Status hanya ditampilkan jika ada pengecualian (misalnya role Viewer → "Hanya lihat").
- Selesai bila: tidak ada karakter `▦ □ ↗` di JSX, dan setiap badge di Portal membawa informasi yang dapat berubah.

**A4 · P2: Roadmap "Pengembangan berikutnya" di halaman kerja**

- Bukti: `apps/portal/app/page.tsx:56-73` merender kartu penuh untuk aplikasi `planned`.
- Prinsip: §16 Purpose, yaitu jangan membelanjakan perhatian pengguna untuk hal yang belum bisa dipakai.
- Perbaikan: hapus seksi ini, atau ganti dengan satu baris teks kecil di bagian bawah ("Segera hadir: …") tanpa kartu dan tanpa badge lavender.

**A5 · P2: Teks keterangan berlapis di dashboard Consumable Room**

- Bukti: `stock-summary.tsx:230-247` memuat 3 paragraf `.fine` di bawah chart. `:255` mengulang "Stok R22 · saat ini" di bawah setiap KPI. "Kesiapan saldo awal" (`:261-292`) dan kartu "Belum dihitung" di "Perlu perhatian" (`:307-311`) menunjuk ke filter yang sama, `?availability=uncounted`.
- Perbaikan: cukup satu baris status di bawah chart (tahun berjalan atau kalender). Pindahkan definisi perhitungan ke tooltip ikon info di samping judul chart. Tulis "Kondisi saat ini" satu kali sebagai label grup KPI. Gabungkan progres saldo awal dengan item "Belum dihitung" menjadi satu kartu.

**A6 · P2: Deskripsi boilerplate yang sama di 7 halaman**

- Bukti: `[section]/page.tsx:40` berbunyi _"Satu stok R22 untuk seluruh pengguna sesuai hak tindakan Anda."_ di semua section.
- Perbaikan: tulis deskripsi per section yang menjelaskan tugas halaman (contoh, Consume: "Ambil material dari R22 untuk satu HAC/SAC. Semua item disimpan sebagai satu dokumen."), atau hapus deskripsi jika judul sudah cukup jelas.

**A7 · P3: Bug karakter**

- `apps/consumables/app/workspace.tsx:442` berisi `'Memuat audit?'`; seharusnya `'Memuat audit…'`.

### B. Animasi dan interaksi

**B1 · P1: Overlay masuk dengan animasi tetapi keluar seketika**

- Bukti: `overlay.tsx:57` memanggil `dialog.close()` langsung. Keyframes `overlay-in`, `sheet-in`, dan `bottom-in` (`refresh.css:1001-1030`, `:1221`) hanya untuk arah masuk.
- Prinsip: §7, yaitu masuk dan keluar melalui jalur yang sama. Juga §3: keyframes tidak dapat diinterupsi, sedangkan CSS transition dapat ditarget ulang dari nilai saat ini.
- Perbaikan: ganti keyframes overlay dengan **CSS transition + `@starting-style` + `transition-behavior: allow-discrete`** pada `dialog[open]`, `overlay`, dan `display`. Untuk browser yang tidak mendukung, tambahkan atribut `data-closing` dan tunda `close()` hingga `transitionend`, dengan fallback timeout sebesar `--duration-moderate`. Fokus dikembalikan setelah dialog benar-benar tertutup. Jika pengguna membuka kembali di tengah animasi keluar, transisi harus berbalik dari posisi saat itu tanpa lompatan.
- Arah: menu/dialog memakai fade + scale 0.96→1 ke arah pemicu. Sheet kanan keluar ke kanan. Bottom sheet keluar ke bawah. Drawer kiri keluar ke kiri. **Sheet tidak di-fade**, cukup translate; scrim yang melakukan fade.

**B2 · P1: Origin menu tidak menempel pada pemicu**

- Bukti: `.overlay-menu` (`refresh.css:648`) diposisikan dengan `--anchor-top/left`, tetapi tidak memiliki `transform-origin`, sehingga scale terjadi dari tengah.
- Perbaikan: `overlay.tsx` menulis `--anchor-origin` (misalnya `top left`, atau `top right` jika menu didorong ke kiri oleh clamp viewport, atau `left top` untuk `placement="right"`). CSS memakai `transform-origin: var(--anchor-origin)`. Pada bottom sheet mobile, origin adalah `bottom center`.

**B3 · P1: Gesture drawer dan sheet tanpa kecepatan, spring, dan rubber-band**

- Bukti: `overlay.tsx:125-157`. Drawer ditutup jika `dragX < -80` dan sheet jika `drag > 100`, yaitu ambang posisi. Saat dilepas, `setDragX(0)`/`setDrag(0)` membuat panel melompat kembali tanpa transisi. Drag ke arah berlawanan dihentikan keras oleh `Math.max(0, …)`/`Math.min(0, …)`. Posisi diperbarui lewat React state di setiap `pointermove`.
- Prinsip: §2, §5, §6, §9, dan Quick Reference ("Decide reverse vs. commit: use velocity sign").
- Perbaikan:
  - Buat utilitas kecil `packages/ui/src/gesture.ts` (tanpa dependency) yang berisi riwayat posisi dan waktu (5 event terakhir), fungsi `velocity()`, `project(v, 0.998)` dari skill, serta `rubberband(overshoot, dimension, 0.55)`.
  - Saat drag, tulis `transform` langsung ke elemen melalui ref dan `requestAnimationFrame`, bukan melalui setState. Pakai `setPointerCapture` pada drawer juga. Ambang arah 10 px (hysteresis).
  - Saat dilepas, tentukan tutup atau kembali dari `posisi + project(velocity)` dibanding setengah dimensi panel, dengan arah ditentukan oleh **tanda kecepatan**.
  - Animasi lanjutan dimulai dari posisi saat ini dengan spring critically damped (`damping 1.0, response 0.3`). Lakukan dengan utilitas spring kecil berbasis rAF, atau dengan CSS transition `var(--ease-drawer)` yang durasinya diskalakan oleh sisa jarak dibagi kecepatan. Untuk flick, boleh sedikit bounce (`damping 0.8`) sesuai §4.
  - Drag ke arah yang tidak valid memakai rubber-band, bukan berhenti keras.
  - Selama `prefers-reduced-motion`, drag tetap 1:1 tetapi pelepasan langsung snap dengan cross-fade.

**B4 · P1: `:active scale(0.97)` global mengenai baris tabel lebar**

- Bukti: `refresh.css:133-136` menerapkan `button:active:not(:disabled) { transform: scale(0.97) }` ke semua `<button>`. Ini termasuk `.stock-table-row` (`consumables workspace.tsx:582` dan seterusnya, selebar konten) dan `.quarter-slot` (chart). Pada baris 1000 px, efeknya adalah pergeseran sekitar 30 px dan teks bergoyang.
- Prinsip: §1 (umpan balik saat press) dan §16 Craft. Scale hanya cocok untuk kontrol kecil.
- Perbaikan: batasi scale ke `button:where(:not(.stock-table-row, .quarter-slot, .menu-item, .nav-tree-row, [role='option']))`, atau lebih baik jadikan opt-in dengan class `.pressable` atau komponen `Button`. Baris dan opsi memakai highlight background **instan** saat `:active` (tanpa transisi masuk, dengan transisi keluar 140 ms).

**B5 · P1: Latensi buatan 200 ms pada semua filter dan pagination**

- Bukti: `apps/consumables/app/workspace.tsx:113-134`. Satu `setTimeout(…, 200)` membungkus setiap perubahan dependency `load`, termasuk Select kategori, ketersediaan, tanggal, checkbox, dan tombol Sebelumnya/Berikutnya.
- Prinsip: §1, "audit debounces… anything on the input path that isn't essential is a regression".
- Perbaikan: debounce hanya untuk `query` teks (simpan `debouncedQuery` terpisah). Perubahan lain langsung memicu fetch. Pertahankan `AbortController`. Selama memuat ulang, jangan kosongkan daftar. Tampilkan item lama dengan `aria-busy` dan indikator tipis (progress bar 2 px di atas tabel atau opacity 0.6). Ini menghindari lompatan layout.

**B6 · P1: `loading.tsx` tanpa shell membuat sidebar hilang saat navigasi**

- Bukti: `apps/portal/app/loading.tsx` dan `apps/consumables/app/loading.tsx` merender `<main className="panel" style={{ margin: 32 }}>Memuat…</main>`. `Shell` dirender per page, bukan di layout, sehingga setiap navigasi server membuat sidebar dan topbar lenyap lalu muncul kembali. Efek ini ditambah `@view-transition { navigation: auto }` (`refresh.css:1264`) yang men-crossfade seluruh halaman.
- Prinsip: §7 spatial consistency dan wayfinding ("Where am I?").
- Perbaikan (pilih satu dan dokumentasikan): (a) pindahkan `Shell` ke `layout.tsx` setiap app (identity diambil di layout, dan `active`/`activePath` dari segment), atau (b) buat `ShellSkeleton` di `packages/ui` dengan sidebar statis dan area konten berisi skeleton yang mirip tata letak halaman tujuan, lalu pakai di semua `loading.tsx`. Tambahkan `view-transition-name: app-sidebar` dan `app-topbar` agar chrome tidak ikut crossfade. Hanya `main` yang bertransisi.

**B7 · P2: Count-up angka di setiap KPI**

- Bukti: `AnimatedNumber` (`dashboard.tsx:38-62`) selalu mulai dari 0 saat mount (`previous = useRef(0)`) selama 600 ms. Komponen ini dipakai di semua KPI Portal dan Consumable Room.
- Prinsip: §16 Utility of feedback. Pada alat operasional, angka harus terbaca seketika.
- Perbaikan: saat mount pertama, tampilkan nilai final tanpa animasi. Animasi hanya ketika nilai **berubah** (misalnya ganti tahun), dengan durasi ≤ 300 ms dan `ease-out`.

**B8 · P2: Banner error memakai animasi overlay**

- Bukti: `.notice.error` di `refresh.css:535-541` memakai `overlay-in` (scale 0.96).
- Perbaikan: banner inline cukup memakai opacity 0→1 dalam 140 ms tanpa scale. Jika menggeser konten, buka tinggi dengan `grid-template-rows: 0fr → 1fr` (satu-satunya pengecualian properti layout, karena hanya satu elemen).

**B9 · P2: Baris keranjang muncul dan hilang tanpa umpan balik**

- Bukti: `order-cart.tsx:376-421` dan `picklist.tsx` (baris dirender langsung). Tombol "Hapus" menghapus seketika tanpa undo.
- Prinsip: §16 Agency, "forgiveness — easy undo… confirmation only for destructive". Juga feedback kategori _completion_.
- Perbaikan: baris baru diberi highlight background lembut (`--accentFillSoft` → transparan, 600 ms) dan di-scroll ke tampilan jika berada di luar viewport. Penghapusan baris dilakukan seketika, diikuti toast "Item dihapus · Urungkan" selama 5 detik. "Kosongkan keranjang" tetap memakai konfirmasi karena menghapus banyak baris.

**B10 · P2: Collapse sidebar menganimasikan properti layout**

- Bukti: `workspace.css:5` (`transition: grid-template-columns`) dan `:25` (`transition: width`). Seluruh konten (chart, tabel) melakukan reflow di setiap frame.
- Prinsip: §11, animasikan hanya `transform` dan `opacity`.
- Perbaikan: ukur dulu dengan DevTools Performance di halaman `/consumables` (chart dan tabel) dan Portal. Jika ada frame > 16 ms, ubah strateginya: kolom grid berpindah satu kali (tanpa transisi), sedangkan isi sidebar dianimasikan dengan `clip-path`/`transform`, dan label sidebar di-fade. Jika tidak ada jank, cukup tambahkan `contain: layout paint` pada `.page-content`, lalu catat hasil ukurnya di laporan.

**B11 · P3: Reduced transparency dan contrast belum ditangani**

- Bukti: overlay memakai `backdrop-filter: blur(16px)` dengan `--overlay` 88% (`refresh.css:613`), begitu pula `consumables.css:297`. Tidak ada media query `prefers-reduced-transparency` atau `prefers-contrast`.
- Perbaikan: tambahkan kedua media query di `tokens.css` dan `refresh.css` sesuai contoh §14 skill. Overlay menjadi solid tanpa blur, border overlay memakai `--borderStrong`, dan pada mode kontras tinggi `--divider` naik ke `--borderStrong`.

**B12 · P3: Lain-lain**

- Shake `field-error` (`refresh.css:1299`) muncul di setiap `:user-invalid`. Batasi hanya pada percobaan submit (class `form.was-submitted`).
- Tooltip shortcut `Ctrl B` / `Ctrl K` (`workspace.tsx:395`, `:441`) harus menampilkan `⌘` di macOS.
- Sheet detail: lihat D4.

### C. Typography

**C1 · P1: Font stack menyebut Inter tanpa pernah memuatnya**

- Bukti: `refresh.css:3` berisi `font-family: Inter, 'Segoe UI', system-ui, sans-serif`. Tidak ada `@font-face` di repo, dan aturan proyek melarang resource font eksternal. Akibatnya PC klien (Windows) merender Segoe UI, Mac merender SF, dan hanya mesin yang kebetulan memasang Inter yang melihat Inter. Metrik dan lebar teks berbeda di tiap mesin.
- Prinsip: §15, "default to the platform's system font… override only with a reason".
- Perbaikan: pakai `font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` dan `font-optical-sizing: auto`. (Alternatif yang perlu persetujuan pengguna: self-host Inter Variable `.woff2` di `packages/ui` beserta `size-adjust` fallback.) Pastikan angka tabular tetap aktif.

**C2 · P1: Skala tipe terlalu banyak dan terlalu kecil**

- Bukti: di `refresh/workspace/dashboard/consumables.css` ada 12 ukuran (10, 11, 12, 13, 14, 15, 18, 20, 24, 28, 32, 40 px). Ukuran 10–11 px dipakai 37 kali, misalnya header tabel stok 11 px (`consumables.css:1013`), metadata baris 11 px (`:1047`), label kuartal 10–11 px (`:591`, `:617`, `:673`, `:678`), dan nilai aktivitas 10 px (`:833`).
- Prinsip: §15 (hierarki dari weight, ukuran, dan leading sebagai satu set) dan §16 Craft. Aplikasi ini dipakai di plant/workshop.
- Perbaikan: definisikan token tipe di `tokens.css` dan pakai di semua file:

  | Token             | Ukuran / leading             | Tracking | Weight  | Pemakaian                                         |
  | ----------------- | ---------------------------- | -------- | ------- | ------------------------------------------------- |
  | `--type-caption`  | 0.75rem / 1rem (12/16)       | +0.01em  | 400–500 | metadata, header tabel, label chart (**minimum**) |
  | `--type-footnote` | 0.8125rem / 1.125rem (13/18) | 0        | 400     | teks sekunder                                     |
  | `--type-body`     | 0.875rem / 1.25rem (14/20)   | 0        | 400     | isi                                               |
  | `--type-headline` | 1rem / 1.5rem (16/24)        | -0.005em | 600     | judul kartu (h3)                                  |
  | `--type-title`    | 1.25rem / 1.75rem (20/28)    | -0.01em  | 600     | judul seksi (h2)                                  |
  | `--type-large`    | 1.75rem / 2.125rem (28/34)   | -0.02em  | 600     | judul halaman (h1)                                |
  | `--type-display`  | 2.5rem / 2.75rem (40/44)     | -0.025em | 600     | satu angka utama per halaman                      |

  Ukuran 10/11 px dan 15/18/24/32 px dihapus. Header tabel memakai caption dengan `font-weight: 500` dan warna `--textSecondary`, bukan huruf kecil 11 px.

**C3 · P1: Semua ukuran memakai px dengan root 14 px**

- Bukti: `refresh.css:7` (`:root { font-size: 14px }`). Seluruh ukuran dan spacing memakai px, sehingga pengaturan ukuran teks browser pengguna diabaikan.
- Prinsip: §15, respect the user's text-size setting.
- Perbaikan: root `font-size: 100%`, body `var(--type-body)`, dan token tipe dalam rem (lihat tabel). Spacing komponen yang berkaitan dengan teks (padding tombol, input, baris) memakai rem. Uji di Chrome dengan pengaturan font "Very large": layout tidak boleh patah.

**C4 · P2: Hierarki terbalik di ringkasan order**

- Bukti: `order-cart.tsx:432-434` menampilkan jumlah item dengan `display-lg` (32 px), padahal jumlah item sudah muncul di badge keranjang (`:335`). Tombol **Submit Order** (`:444-446`) tampil sebagai elemen biasa.
- Perbaikan: ringkasan berisi judul dokumen (`--type-title`), daftar `dl` (HAC/SAC, Peminta, Jumlah item), lalu tombol primer selebar panel. Hapus angka display. Satu angka display per halaman disediakan untuk informasi yang paling penting (di dashboard: jumlah transaksi atau stok tersedia).

**C5 · P2: Angka rata kiri di tabel**

- Bukti: `.stock-table-head, .stock-table-row` (`consumables.css:1003-1011`) memakai `text-align: left` untuk kolom Saldo/Jumlah. Hal yang sama terjadi di kolom Qty keranjang.
- Perbaikan: kolom numerik `text-align: right` + `tabular-nums`, dengan satuan sebagai teks sekunder di kanan angka. Status "Belum dihitung" ditampilkan sebagai badge netral, bukan `<strong>` setebal angka.

**C6 · P3: Bahasa campur dan label generik**

- "Critical stok nol" → "Kritis, stok nol". "Qty" → "Jumlah". "Submit Order" → "Simpan order" atau "Finalkan Consume Order". Eyebrow berbahasa Inggris dihapus (A2). Nama resmi dokumen klien tetap dipakai.

### D. Layout dan penempatan

**D1 · P1: Portal menduplikasi dashboard Bag Filter dan memiliki tiga jalur navigasi ke aplikasi yang sama**

- Bukti: `apps/portal/app/page.tsx:23` merender `<Dashboard />`, komponen yang sama persis dengan `/bag-filter` (`apps/bag-filter/app/page.tsx:17`). Komponen ini berisi chart hero, cakupan, tip card _"Satu batch, banyak posisi"_, distribusi umur, gauge, per-equipment, feature widget, dan aktivitas. Setelah itu ada `StockSummary compact`, lalu grid "Aplikasi Anda" di bagian bawah, lalu roadmap. Aplikasi bisa dicapai lewat sidebar, link "Buka aplikasi" di setiap ringkasan, dan kartu aplikasi.
- Prinsip: §16 Simplicity ("show the common path first, advanced options one level deeper") dan wayfinding.
- Perbaikan: Portal menjadi **hub**:
  1. Heading: "Selamat pagi/siang/sore, {nama}" (WIB) dengan deskripsi singkat, tanpa badge.
  2. Baris **Perlu perhatian** lintas aplikasi, hanya tampil jika ada isinya: bag ≥ 1.260 hari, material kritis stok nol, dan material belum dihitung. Setiap item adalah link ke filter yang tepat.
  3. Untuk setiap aplikasi yang diizinkan, satu **kartu ringkasan dengan pola yang sama**: judul aplikasi + ikon, 3 KPI, aktivitas terbaru maksimal 3 baris, dan satu link "Buka {aplikasi}". Buat `Dashboard variant="compact"` untuk Bag Filter yang mengikuti pola `StockSummary compact`, sehingga `/bag-filter` tidak berubah.
  4. Grid kartu aplikasi dihapus (fungsinya sudah tergantikan poin 3). Roadmap ikut A4.
- Selesai bila: Portal pada 1280 px muat dalam ± 1,5 viewport, tanpa chart besar, dan kedua kartu aplikasi simetris.

**D2 · P1: Pola detail tidak konsisten**

- Bukti: detail material dari tabel stok dibuka sebagai `kind="dialog"` (`apps/consumables/app/workspace.tsx:467-471`), begitu pula detail transaksi (`:524`). Detail dokumen R22 di Riwayat memakai `kind="sheet"` (`stock-history.tsx:230`).
- Prinsip: §16 Familiarity ("things that look the same must behave the same") dan §12 ("separate to keep flow": panel paralel tanpa scrim berat).
- Perbaikan: semua detail yang dibuka dari daftar memakai **sheet kanan** di desktop dan bottom sheet di mobile. Baris yang sedang dibuka diberi tanda `.selected`. Saat sheet terbuka, panah ↑/↓ berpindah ke record berikutnya. Dialog hanya untuk keputusan (konfirmasi, input jumlah).

**D3 · P2: Tombol Submit tenggelam di bawah 1100 px**

- Bukti: `consumables.css:437-444` membuat `.r22-cart-summary` menjadi `position: static` di bawah keranjang ketika lebar < 1100 px. Pada tablet atau HP, setelah 20 baris keranjang, tombol Submit berada jauh di bawah.
- Perbaikan: di bawah `1024px`, ringkasan menjadi **bilah bawah sticky** (jumlah item, HAC/SAC, dan tombol primer), mengikuti pola bilah pencatatan Bag Filter (lihat `docs/UI-THEME.md`, "Bilah pencatatan"). Tambahkan padding bawah halaman agar baris terakhir tidak tertutup.

**D4 · P2: Breakpoint ad-hoc**

- Bukti: media query 700, 900, 1100, dan 1550 px (`consumables.css:196`, `:437`, dll.) bercampur dengan 639/767/1023/1279. Keputusan proyek adalah memakai breakpoint default Tailwind.
- Perbaikan: normalisasi ke `640 / 768 / 1024 / 1280 / 1536`. Untuk komponen yang bergantung pada lebar kontainer (tabel, keranjang, chart), pakai container query seperti `bag-workspace`.

**D5 · P2: Loading dan empty state tidak seragam**

- Bukti: dashboard memakai skeleton, sedangkan tabel memakai teks "Memuat stok…" di dalam `.empty` (`workspace.tsx:604`, `:640`, `:682`), dan `order-cart.tsx:206-211` memakai panel teks "Memuat keranjang…".
- Perbaikan: buat komponen `TableSkeleton rows={n}` (baris setinggi 64 px, shimmer mengikuti reduced motion) dan `EmptyState` (ikon, judul, satu kalimat, satu aksi opsional). Dua komponen ini dipakai di semua tabel R22.

**D6 · P3: Heading halaman**

- Gunakan `Heading` dengan slot aksi kanan untuk aksi utama halaman (misalnya "Penerimaan baru" di Riwayat), daripada menaruh aksi di dalam kartu.

### E. White space dan ritme

**E1 · P1: Spacing di luar grid**

- Bukti: frekuensi nilai `gap/padding/margin` di file aktif adalah 12 (66×), 16 (64×), 8 (57×), 24 (38×), 20 (27×), 4 (26×), 10 (20×), 6 (15×), 5 (5×), 14 (3×), dan 30, 22, 11, 88 (masing-masing 1×). `legacy.css` masih memberi `.panel + .panel { margin-top: 20px }`, sedangkan `refresh.css` memberi 16 px.
- Perbaikan: token `--space-1 … --space-12` = 4, 8, 12, 16, 20, 24, 32, 40, 48 px (dalam rem), dan **hanya token**. Aturannya: 8 untuk jarak dalam satu kontrol atau baris, 12–16 antarkontrol dalam kartu, 24 untuk padding kartu, 32 antarkartu dalam satu seksi, dan 48 antarseksi halaman.

**E2 · P1: Jarak antarseksi sama dengan jarak antarkartu**

- Bukti: `.section-title { margin: 24px 0 16px }`, `.heading { padding: 8px 0 24px }`, sedangkan grid kartu memakai `gap: 16px`. Di Portal, semua blok tampak sama berat.
- Perbaikan: terapkan ritme pada E1. Kelompokkan dengan **proximity**, bukan dengan menambah border atau kartu (§16 Grouping & mapping).

**E3 · P2: Lapisan CSS yang saling menimpa**

- Bukti: 121 selector didefinisikan di lebih dari satu file. 88 di antaranya ada di `legacy.css` dan `refresh.css` (contoh: `.heading` ada di `legacy.css:293` dan `workspace.css:394`; `h1` 36 px/-1.3px di legacy ditimpa menjadi 28 px di refresh). Ada pula `!important` di `workspace.css:46-56` untuk monogram brand.
- Perbaikan: setelah fase tipe dan spacing selesai, pindahkan aturan yang masih hidup dari `legacy.css` ke file komponen yang sesuai, lalu hapus duplikatnya. Gunakan `@layer tokens, base, components, app, utilities` di `styles.css` agar urutan cascade eksplisit dan `!important` non-print dapat dihapus. Lakukan bertahap, dengan screenshot pembanding per halaman (termasuk Bag Filter, yang **tidak boleh berubah**).

### F. Warna

**F1 · P1: Warna seri chart Consumables bertabrakan dengan skala umur**

- Bukti: `stock-summary.tsx:18-24` memberi warna saldo awal = gray-500, Picklist = **lime** primary-500, Consume = **pumpkin** secondary-500, Return = **kuning** `--highlight`, dan Koreksi = primary-800. Di Portal, chart ini tampil berdampingan dengan skala umur bag (lime → kuning → oranye → merah = baru → tua/kritis), sehingga oranye pada "Consume" terbaca sebagai peringatan.
- Prinsip: §16 Craft ("nothing is random") dan Familiarity (warna yang sama berarti hal yang sama).
- Perbaikan: buat token seri data `--series-1 … --series-5` yang **tidak memakai hue skala umur atau warna status**. Usulan: ink/gray-800 (Consume, keluar), gray-400 (Return, masuk kembali), lime primary-500 (Picklist, penerimaan, satu-satunya aksen), gray-200 dengan hatch (Saldo awal), dan outline/hatch ink (Koreksi). Arah masuk/keluar juga ditunjukkan dengan ikon dan tanda ± di legenda serta tooltip. Pastikan setiap segmen berkontras ≥ 3:1 terhadap surface dan tetangganya, atau dipisahkan gap 2 px dengan warna surface.

**F2 · P1: Kontras elemen non-teks**

- Bukti (dihitung): `--highlight` #EDF25C di atas putih = **1,2:1**, lime #8CC233 di atas putih = 2,13:1, pumpkin #FB7F1F di atas putih = 2,57:1, dan highlight vs lime = 1,77:1. Semua di bawah WCAG 1.4.11 (3:1).
- Perbaikan: ikuti F1, dan jangan memakai `--highlight` sebagai isi data di tema terang. Jika lime tetap dipakai sebagai seri, beri hatch atau outline 1 px `--primary-700`.

**F3 · P2: Terlalu banyak aksen dekoratif**

- Bukti: gradien lime pada 2 feature widget (A1), badge hijau "Aktif"/"Akun aktif" (A3), badge lavender "Rencana" (`refresh.css:451`), kuning highlight, dan pumpkin dalam satu layar Portal.
- Perbaikan: **anggaran aksen** per layar terdiri dari (1) lime untuk satu elemen data utama dan fokus, (2) pumpkin hanya untuk titik notifikasi dan teks peringatan (`--warningText`), (3) danger hanya untuk error atau aksi destruktif, dan (4) hijau sukses hanya untuk konfirmasi yang baru terjadi (toast, dokumen tersimpan). Hapus pemakaian `--lavender` di Portal.

**F4 · P3: Asterisk merah pada semua field wajib**

- Bukti: perubahan yang belum di-commit menambahkan `.r22-required { color: var(--danger); font-weight: 700 }`.
- Perbaikan: karena sebagian besar field R22 wajib, tandai field **opsional** dengan teks "(opsional)" berwarna `--textSecondary`, dan hapus asterisk merah. Warna danger dicadangkan untuk error. Jika pengguna tetap menginginkan asterisk, gunakan `--textSecondary`, bukan merah.

---

## 6. Urutan pengerjaan (satu commit per fase)

1. **Fondasi token**: token tipe (C2, C3), spacing (E1), seri data (F1), media query reduced transparency/contrast (B11), dan font stack (C1). Belum mengubah tata letak.
2. **Interaksi bersama** (`packages/ui`): overlay exit dan origin (B1, B2), `gesture.ts` dan perbaikan drawer/sheet (B3), opt-in press scale (B4), `AnimatedNumber` (B7), banner error (B8), dan `ShellSkeleton` atau Shell di layout (B6).
3. **Portal**: hub baru (D1), kurasi (A1–A4), dan anggaran warna (F3).
4. **Consumable Room**: dashboard (A1, A5, F1, F2), section heading (A2, A6), tabel stok (B5, C5, D2, D5), keranjang dan picklist (B9, C4, D3, F4), serta bahasa (C6, A7).
5. **Pembersihan CSS**: breakpoint (D4) dan konsolidasi `legacy.css` dengan `@layer` (E3). Lakukan dengan diff screenshot di **semua** aplikasi, termasuk Bag Filter dan Auth.

## 7. Kriteria penerimaan

- [ ] Tidak ada gradien, kontur, tilt, tagline, atau glyph Unicode sebagai ikon di Portal dan Consumable Room.
- [ ] Maksimal 1 eyebrow per halaman, tanpa huruf besar semua dan tanpa bahasa Inggris (kecuali nama dokumen resmi).
- [ ] Tidak ada `font-size` di bawah 12 px (kecuali cetak bukti, jika perlu), dan semua ukuran tipe berasal dari token rem.
- [ ] Semua spacing berasal dari token, dan `grep -E "(gap|padding|margin)[^;]*\b(5|6|10|14|18|22|30)px"` pada file yang disentuh kosong.
- [ ] Setiap overlay memiliki animasi keluar yang mengikuti jalur masuk, dan membuka atau menutup cepat berulang tidak menimbulkan lompatan.
- [ ] Menu men-scale dari pemicunya.
- [ ] Drawer dan sheet dapat di-flick untuk ditutup (ditentukan oleh kecepatan), kembali dengan spring dari posisi saat ini, dan memakai rubber-band ke arah yang tidak valid.
- [ ] Baris tabel tidak ter-scale saat ditekan.
- [ ] Mengganti Select atau pagination di tabel stok langsung memicu fetch (0 ms debounce), dan daftar lama tetap tampil selama memuat.
- [ ] Sidebar dan topbar tidak pernah hilang saat navigasi antarhalaman.
- [ ] Semua detail dari daftar dibuka sebagai sheet.
- [ ] Portal pada 1280 px tidak lagi merender chart besar Bag Filter, sedangkan `/bag-filter` identik piksel dengan sebelumnya (kecuali perubahan font dan token global yang disengaja; sebutkan di laporan).
- [ ] Kontras segmen chart ≥ 3:1. Teks memenuhi 4,5:1 (gunakan aturan caption-di-canvas yang ada di `UI-THEME.md`).
- [ ] `prefers-reduced-motion`, `prefers-reduced-transparency`, dan `prefers-contrast: more` diuji dengan DevTools Rendering emulation.
- [ ] Pengaturan teks browser "Very large" tidak mematahkan layout Portal, dashboard, keranjang, atau tabel.
- [ ] Lint, typecheck, unit, dan Playwright hijau. Jika sebuah test bergantung pada markup lama (eyebrow, kartu aplikasi), perbarui test tersebut dan jelaskan alasannya.
- [ ] `docs/UI-THEME.md` diperbarui: bagian Portal, Consumable Room, motion, tipe, dan spacing.

## 8. Format laporan akhir

Tulis `docs/testing/ui-audit-2026-11/REPORT.md` yang berisi:

1. Tabel ID temuan → status (selesai / sebagian / ditunda + alasan) → commit.
2. Pasangan screenshot sebelum/sesudah untuk 6 halaman × 4 lebar × 2 tema (boleh berupa tautan ke folder).
3. Catatan pengukuran B10 (frame time sidebar collapse) dan hasil uji gesture B3 (video pendek atau GIF jika memungkinkan).
4. Daftar keputusan yang perlu dikonfirmasi pengguna, misalnya self-host Inter vs system font, tema warna seri data final, dan penghapusan roadmap.

Jangan menandai pekerjaan selesai jika ada kriteria §7 yang belum terpenuhi. Laporkan apa adanya.
