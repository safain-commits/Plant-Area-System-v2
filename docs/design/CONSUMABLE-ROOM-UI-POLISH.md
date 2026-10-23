# Rencana perbaikan sidebar dan dashboard Consumable Room

Tanggal: 23 Oktober 2026. Status: **diimplementasikan; hasil pemeriksaan dicatat pada VALIDATION.md**.

Acuan visual utama adalah screenshot Bag Filter yang disetujui pengguna sebagai gold standard, [UI refresh](UI-REFRESH.md), serta [token bersama](ui-brief.jsonc). Kebutuhan di bawah berasal dari audit tiga screenshot pengguna dan source. Bukti implementasi serta batas pengujian tersedia di [VALIDATION.md](../VALIDATION.md).

## 1. Temuan dari gambar dan source

| Temuan                                                                                                             | Penyebab yang ditemukan                                                                                                | Perbaikan yang direncanakan                                                            |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Di Consumable Room, daftar enam equipment Bag Filter masih terbuka                                                 | `Workspace` merender `equipmentLinks` pada seluruh halaman yang mempunyai grant, tanpa mempertimbangkan aplikasi aktif | Tampilkan submenu sesuai konteks aplikasi aktif                                        |
| Menu Equipment terpisah dari induk Bag Filter dan tersisip setelah Consumable Room                                 | Link aplikasi dan kelompok operasional dirender sebagai daftar terpisah                                                | Satukan induk aplikasi dan anak menunya dalam model navigasi yang sama                 |
| Consumable Room tampil sebagai link aplikasi sekaligus label kelompok lain; Ringkasan tidak tampak sebagai submenu | Rendering submenu memakai `stockLinks.slice(1)`                                                                        | Satu induk aplikasi dengan submenu Ringkasan dan halaman operasional                   |
| Penanda halaman aktif pada anak menu kurang jelas                                                                  | Aturan visual aktif utama hanya menargetkan link langsung pada `nav`                                                   | Bedakan konteks aplikasi aktif dan halaman aktif secara konsisten                      |
| Sidebar panjang dan bagian akun/sesi berpotensi keluar viewport                                                    | `nav` memakai `overflow: visible`; dua kelompok panjang dirender bersamaan, kartu sesi besar                           | Area navigasi dapat scroll, bagian akun/sesi tetap terjangkau, kartu sesi diringkas    |
| Judul dan eyebrow Consumable Room muncul dua kali                                                                  | Halaman mempunyai `Heading`, sedangkan `StockSummary` menambahkan judul yang sama                                      | Satu judul halaman; bedakan varian ringkasan halaman dan Portal                        |
| Lima KPI mempunyai bobot sama dan dashboard terasa datar                                                           | Lima kartu sejajar mendahului chart, tanpa susunan utama dan pendamping seperti Bag Filter                             | Hero chart dengan tiga KPI di samping, dua kartu ringkas di bawah, dan rail aktivitas  |
| Chart terlalu lebar per kuartal, tanpa sumbu Y/grid dan rincian kuartal                                            | Implementasi tersendiri berupa empat flex stack; lebar stack memenuhi slot                                             | Gunakan geometri dan interaksi chart Bag Filter, dengan data transaksi Consumables     |
| Garis gelap mengelilingi segmen dan legenda terasa kasar                                                           | `.stock-bar:not([style*='height: 0%'])` memberi outline, termasuk pada swatch legenda                                  | Pisahkan style swatch dan segmen; gunakan pemisah serta focus yang sesuai token        |
| Kartu chart memanjang dengan ruang kosong besar                                                                    | Grid dua kolom mengikuti tinggi daftar aktivitas; daftar tidak dibatasi tinggi                                         | Batasi tinggi feed, scroll di dalamnya, dan pisahkan ukuran chart dari panjang daftar  |
| Nama material panjang mendominasi aktivitas; jenis dan jumlah transaksi sulit dipindai                             | Baris hanya berupa tiga blok teks tanpa hierarki, ikon jenis, atau nilai di kanan                                      | Baris aktivitas ringkas mengikuti pola Bag Filter                                      |
| Nama `BROWSER-`, `TEST-`, dan Stock Browser terlihat pada aktivitas                                                | Preview yang digunakan memuat fixture pengujian                                                                        | Pisahkan preview/pilot dari test otomatis dan tambahkan cleanup fixture berdasarkan ID |

Dominasi Q4 pada gambar adalah distribusi data: 1.179 transaksi dibanding dua transaksi pada kuartal lainnya. Tinggi bar harus tetap proporsional. Perbaikan keterbacaan dilakukan lewat sumbu, label angka, dan rincian kuartal; tidak mengubah jumlah atau skala menjadi persentase setiap kuartal.

## 2. Sidebar: satu hierarki dan konteks aplikasi yang jelas

Link aplikasi yang diberikan tetap tersedia untuk perpindahan lintas aplikasi. Hanya aplikasi yang sedang dibuka menampilkan submenu operasionalnya. Pada Portal, Profil, dan Kelola akses, daftar aplikasi tampil ringkas tanpa membuka submenu operasional.

Contoh saat Consumable Room aktif:

```text
PLANT AREA
WORKSPACE
  Portal
  Bag Filter                         6
  Consumable Room                    [aktif]
    Ringkasan
    Cek stok
    Penerimaan
    Pemakaian
    Riwayat
    Pengelolaan
    Audit
────────────────────────────────────────
  Profil saya
  Kelola akses
  Sesi aktif                  0j 53m
  Keluar akun
  Ciutkan sidebar
```

Saat Bag Filter aktif, submenu Ringkasan, Equipment beserta kode equipment, dan Audit menggantikan submenu Consumables. Peran dan scope tetap menentukan menu yang tersedia: Penerimaan untuk storekeeper/admin, Pemakaian untuk operator ke atas, Pengelolaan/Audit untuk admin, serta equipment hanya dari grant Bag Filter.

- Induk aplikasi mempunyai tanda konteks aktif; satu link halaman memakai `aria-current="page"`. Induk dan anak tidak sama-sama diumumkan sebagai halaman aktif.
- Nama aplikasi menuju ringkasan melalui navigasi dokumen penuh. Chevron terpisah membuka/menutup submenu tanpa mengubah halaman; tidak ada button di dalam link.
- Gaya ikon mengikuti SVG bersama. Gunakan ikon yang berbeda untuk Bag Filter dan material; ukuran, stroke, dan garis pohon konsisten.
- Pertahankan lebar 248 px dan rail 76 px. Dalam rail, ikon aplikasi membuka flyout berlabel dengan link Ringkasan dan halaman sesuai izin. Portal tetap dapat dibuka langsung.
- Logo tetap di atas. Area menu memakai `min-height: 0` dan scroll internal; bagian profil/akses/sesi di bawah mempunyai ukuran terkontrol. Periksa viewport pendek agar kontrol logout dan collapse tetap terjangkau.
- Ringkas sesi menjadi label, sisa waktu, dan logout. Waktu kedaluwarsa WIB tersedia pada detail sesi; perhitungan tetap berasal dari Auth.
- Drawer mobile memakai hierarki yang sama, target sentuh minimal 44 px, serta perilaku focus/Escape yang sudah ada. Flyout dan submenu dapat dioperasikan dengan keyboard.

## 3. Susunan dashboard mengikuti Bag Filter

Satu `Heading`: eyebrow MATERIAL CONTROL, judul Consumable Room, dan deskripsi singkat. Konten utama dimulai dengan jarak yang sama seperti halaman Bag Filter; tidak ada judul aplikasi kedua.

| Bagian                    | Isi dan proporsi                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Kolom utama, bagian atas  | Hero dengan panel chart di kiri dan rail KPI di kanan; rail KPI 240 px mulai breakpoint yang sama dengan Bag Filter       |
| Header hero               | AKTIVITAS MATERIAL, total transaksi tahun pilihan berukuran 40 px, keterangan jumlah transaksi, dan pemilih tahun ringkas |
| KPI hero                  | Material–lokasi, Tersedia, Stok nol; angka 32 px dan keterangan cakupan                                                   |
| Kolom utama, bagian bawah | Dua kartu: Kesiapan saldo awal dan Perlu perhatian                                                                        |
| Kesiapan saldo awal       | Jumlah yang telah dihitung terhadap seluruh pasangan material–lokasi, progress aktual, dan tautan ke stok belum dihitung  |
| Perlu perhatian           | Critical stok nol dan Belum dihitung, dengan label serta tautan filter yang tepat                                         |
| Rail kanan                | Kartu aksi ringkas dengan aksen lime sesuai Bag Filter, lalu Aktivitas terbaru dengan scroll internal                     |

Kartu aksi menampilkan tautan sesuai peran: viewer menuju Cek stok; operator dapat menuju Pemakaian; storekeeper/admin memperoleh Penerimaan. Aksi pengelolaan hanya tampil bagi admin. Tetapkan satu aksi utama, dengan aksi tambahan berbentuk link/ghost.

Pada lebar 1280–1535 px, rail kanan mengikuti Bag Filter 300 px; mulai 1536 px menjadi 360 px. Pada tablet, rail turun ke susunan yang tersedia, dan pada mobile menjadi satu kolom. Radius kartu 16 px, padding 24 px/20 px, gap 16 px/12 px, ukuran huruf, dan motion memakai token yang sudah ada.

Portal memakai varian ringkas `StockSummary`: judul aplikasi tetap berguna sebagai identitas sumber, KPI serta aktivitas diringkas, dan tautan membuka aplikasi lengkap. Halaman Consumables memakai varian penuh tanpa judul ganda. Pilihan tahun chart tidak mengubah KPI stok saat ini atau daftar aktivitas terbaru; konteks waktunya diberi keterangan.

## 4. Chart: kualitas visual Bag Filter, semantik transaksi stok

- Tetap empat kuartal Q1–Q4 dan pilihan tahun 2000–tahun berjalan WIB. Total besar adalah jumlah empat jenis transaksi pada tahun tersebut.
- Tambahkan sumbu Y berlabel **transaksi**, baseline bersama, 4–5 tick bilangan bulat dengan interval wajar, dan grid tipis. Tinggi plot sekitar 280 px desktop/220 px mobile mengikuti Bag Filter.
- Bar mempunyai lebar maksimum 72 px, berada di tengah slot kuartal, dengan radius dan pemisah segmen konsisten. Hapus outline gelap dekoratif pada bar/legenda; focus keyboard tetap jelas.
- Gunakan urutan Saldo awal, Penerimaan, Pemakaian, Koreksi. Warna memakai token netral, lime, pumpkin, dan hijau pendamping yang sudah tersedia; legenda berbentuk swatch persegi kecil seperti Bag Filter.
- Ikuti perilaku kuartal aktif Bag Filter: aktif berwarna, kuartal lain netral. Pilihan dapat diubah lewat pointer, keyboard, dan tap; area interaksi tidak bergantung pada tinggi segmen yang kecil.
- Panel rincian selalu menampilkan kuartal/tahun, total, dan empat jumlah per jenis. Default kuartal berjalan untuk tahun berjalan dan Q4 untuk tahun lampau.
- Kuartal kecil tetap mempunyai angka yang terbaca meskipun bar sangat tipis. Nilai nol tidak dibuat menjadi bar transaksi. Semua nilai diplot positif karena satuan chart adalah jumlah pencatatan; arah pergerakan saldo dijelaskan oleh jenis transaksinya.
- Tahun tanpa transaksi menampilkan nol dan keadaan kosong yang jelas. Jangan menampilkan persentase perubahan tahunan sebelum ada data pembanding yang didukung API.
- Pertahankan tabel data yang dapat dibaca screen reader, penjelasan WIB, dan catatan bahwa kuantitas berbeda satuan tidak dijumlahkan. Tahun berjalan diberi keterangan data sampai saat ini.

## 5. Aktivitas, kondisi halaman, dan keterbacaan

Baris aktivitas mempunyai ikon jenis di kiri, nama material maksimal dua baris, MMID/lokasi sebagai metadata, actor dan waktu WIB, serta jumlah dengan satuannya di kanan. Jenis transaksi selalu mempunyai teks. Nilai saldo awal/koreksi diberi label yang menjelaskan artinya; angka koreksi menggunakan delta ledger yang tercatat, bukan dianggap sebagai jumlah fisik target.

Target tinggi baris sekitar 72–88 px. Nama/MMID lengkap tersedia dalam detail transaksi. Feed menampilkan delapan aktivitas yang sudah diberikan API, dibatasi tinggi sekitar 420–560 px pada desktop, dan menyediakan tautan Lihat riwayat. Panjang feed tidak memanjangkan plot chart. Nilai dengan presisi panjang memakai format kuantitas bersama dan tetap dapat dilihat lengkap pada detail.

Loading menggunakan skeleton dengan susunan kartu yang sama. Error/retry mempertahankan konteks dan pilihan tahun; kegagalan satu ringkasan aplikasi di Portal tidak menghilangkan ringkasan aplikasi lain. Bedakan nol transaksi, nol stok terkonfirmasi, dan saldo belum dihitung. Periksa teks, garis chart, focus, legenda, metadata aktivitas, serta kartu lime dalam tema terang/gelap; reduced motion tetap dihormati.

Data sintetis tidak dipakai sebagai contoh capaian operasional. Fixture baru harus mempunyai cleanup berdasarkan ID di database uji terisolasi, termasuk ketika test gagal. Data preview yang sudah ada dipertahankan selama pekerjaan visual; pemisahan preview/pilot dan penanganan fixture lama dicatat sebagai pekerjaan lingkungan tersendiri. Tidak menyembunyikan transaksi berdasarkan prefix MMID pada query dashboard.

## 6. Implementasi yang direncanakan

| Tahap                  | Perubahan                                                                                                        | Bukti sebelum lanjut                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1. Navigasi            | Susun model menu per aplikasi, active state, flyout, scroll, dan sesi ringkas di `workspace.tsx`/`workspace.css` | Screenshot sidebar Portal, Bag Filter, Consumables, Profil/Admin; expanded, rail, drawer           |
| 2. Struktur dashboard  | Pisahkan varian penuh/ringkas `StockSummary`; hero, KPI, kartu pendamping, dan rail                              | Screenshot terang/gelap dengan satu judul dan proporsi sesuai referensi                            |
| 3. Chart dan aktivitas | Gunakan primitive chart/aktivitas bersama yang menerima data/label domain; batasi CSS dan tinggi feed            | Angka kuartal cocok dengan API, navigasi keyboard/tap berfungsi, nama panjang tidak merusak layout |
| 4. Regresi             | Verifikasi tema, izin, mobile, Portal, SSO, dan tampilan Bag Filter                                              | Checklist penerimaan dan perbandingan screenshot Bag Filter                                        |
| 5. Dokumentasi         | Perbarui UI-THEME, PRD terkait, dan VALIDATION berdasarkan pemeriksaan aktual                                    | Catatan membedakan hasil yang diuji dan batas validasi                                             |

File utama: `packages/ui/src/workspace.tsx`, `workspace.css`, `stock-summary.tsx`, `consumables.css`, `apps/consumables/app/page.tsx`, dan `apps/portal/app/page.tsx`. Primitive visual ditambahkan di `@plant/ui` bila dipakai bersama. Jika mengekstrak bagian Bag Filter, pertahankan output dan perilaku halaman referensi serta jalankan perbandingan screenshot.

Data `StockDashboard` yang tersedia sudah cukup: `operational`, `available`, `empty`, `criticalEmpty`, `uncounted`, `series`, dan `recent`. Turunkan `counted = operational - uncounted` dan total transaksi dari series. Saat total operasional nol, progress menampilkan keadaan kosong. Tidak diperlukan migrasi database, endpoint baru, atau perubahan role/scope untuk rancangan ini.

## 7. Kriteria penerimaan

- Pada Consumables, daftar equipment tidak tampil; pada Bag Filter, menu transaksi stok tidak terbuka. Seluruh aplikasi yang diberikan tetap dapat dijangkau.
- Ringkasan dan seluruh submenu memiliki active state yang benar; menu yang tidak diizinkan tidak dirender. Guard server tetap memeriksa akses langsung.
- Sidebar diuji pada tinggi 768 dan 900 px; logout, profil, serta akses admin tetap dapat dijangkau tanpa elemen bertumpuk. Expanded/rail/drawer dan Ctrl/Cmd+B tetap bekerja.
- Halaman Consumables mempunyai satu judul, hero dengan hierarki angka jelas, chart dengan sumbu/grid, dan feed ringkas. Feed delapan nama panjang tidak membuat kartu chart memanjang.
- Contoh data uji: seluruh kuartal nol, hanya satu jenis, seluruh jenis, distribusi merata, distribusi ekstrem 2/2/2/1.179, nama material panjang, quantity pecahan, dan scope kosong. Angka chart/rincian sama dengan respons API.
- `operational = available + empty + uncounted`; `criticalEmpty` merupakan bagian dari stok nol. Statistik dan aktivitas tetap mengikuti lokasi yang diberikan.
- Ukuran 1440 dan 1920 px dibandingkan dengan referensi Bag Filter; 1024/768 px memeriksa tablet; 390 px memeriksa mobile. Kedua tema tidak mempunyai scroll horizontal halaman, kontrol terpotong, atau layout bergeser ketika loading selesai.
- Teks memenuhi kontras minimal 4,5:1 dan kontrol/focus yang relevan 3:1. Keyboard, Escape, focus return, screen reader, serta reduced motion diperiksa.
- Jalankan typecheck, unit relevan, browser alur role/SSO/transaksi, dan build empat aplikasi karena shell bersama berubah. Jalankan integrasi MySQL bila query/kontrak ikut berubah. Periksa kembali gateway sesudah restart aplikasi.

Implementasi menggunakan navigasi aplikasi bersama, varian ringkasan penuh/compact, primitive chart kuartal, dan activity row bersama. Tidak ada perubahan query, schema, atau izin domain. Pemisahan preview/pilot dari database pengujian dan penanganan fixture historis tetap pekerjaan lingkungan tersendiri, sesuai batas pada bagian 5; fixture baru serta suite transaksi browser membersihkan ID miliknya sendiri.
