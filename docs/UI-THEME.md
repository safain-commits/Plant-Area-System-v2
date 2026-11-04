# UI refresh v2 — Plant Area System

Acuan aktif: [brief visual](design/UI-REFRESH.md) dan [token sheet](design/ui-brief.jsonc), menggantikan aturan warna sebelumnya. Nilai palette, semantic light/dark, radius, dan motion diekstrak ke packages/ui/src/tokens.css. Komponen mengonsumsi token semantik. Tidak menambahkan dependency UI atau resource font eksternal; komponen memakai React dan primitive dialog browser untuk focus trap, Escape, dan pengembalian focus.

## Shell dan data aktual

Label legenda umur pada peta dan distribusi ditulis ringkas: **0–209**, **210–419**, **420–629**, **630–839**, **840–1049**, **1050–1259**, **≥ 1260 hari**, kemudian **Belum tercatat** pada peta. Satuan hanya tampil di kategori terakhir; nama aksesibel filter tetap menyebut hari pada setiap kategori. Batas, warna dan logika filter tidak berubah.

Pembatalan Bag Filter memakai dialog konfirmasi dengan ringkasan equipment/batch, alasan wajib dan tombol destruktif merah. Aksi pemicu di riwayat tetap ringan. Badge **Dibatalkan** serta panel alasan menggunakan token danger light/dark dengan teks terbaca; record tidak diredupkan sampai kehilangan kontras. Dialog responsif, mendukung Escape/pengembalian fokus, dan menahan penutupan selama pengiriman. Bilah pemilihan halaman disembunyikan selama dialog terbuka; pilihan dan draft tidak dibersihkan. Riwayat koordinat mempertahankan record batal tanpa label pemasangan aktif atau umur.

Identitas produk memakai [artwork TQ-CMMS](../brand/README.md): logo penuh pada sidebar expanded/form login/ganti password, serta simbol ringkas pada sidebar collapsed dan favicon. Komponen bersama memakai token teks dan aksen primary agar mengikuti tema tanpa mengubah proporsi artwork. Hero login memakai logo satu warna gelap di atas lime. Favicon masing-masing aplikasi tersedia tanpa login pada prefix aplikasinya, mengikuti preferensi warna browser/OS dan memakai revision hash untuk cache.

Sidebar 248 px / rail 76 px mengikuti tema dan mengingat pilihan browser. Ctrl/Cmd+B mengubah sidebar; Ctrl/Cmd+K membuka command palette. Tablet memakai rail dan ekspansi overlay; mobile memakai drawer. Equipment mengikuti grant; link halaman admin mengikuti role. Header berisi pencarian, menu tema, aktivitas batch, akun, dan aksi aplikasi.

Header drawer mobile memakai satu baris logo TQ-CMMS 160 px dan tombol tutup di kanan dengan target 44 × 44 px. Judul “Navigasi” hanya menjadi nama aksesibel dialog; tidak ada baris judul atau blok abu-abu terpisah. Sidebar mengisi tinggi drawer dan navigasi tetap mempunyai scroll sendiri. Escape, klik backdrop serta tombol X menutup drawer dan mengembalikan fokus ke pembukanya.

Dashboard membaca endpoint Bag Filter dengan sesi pengguna: grafik pemasangan Q1–Q4 per tahun (per brand, batas tanggal WIB), KPI total/terpasang/kosong/≥1.260 hari, distribusi umur aktif, gauge cakupan, progress equipment, dan aktivitas terbaru. Tahun default mengikuti waktu server WIB; pilihan tahun 2000 sampai tahun berjalan. Q1 Januari–Maret, Q2 April–Juni, Q3 Juli–September, Q4 Oktober–Desember. Tahun berjalan diberi keterangan bahwa datanya belum satu tahun penuh; pembanding adalah total tahun sebelumnya. KPI dan distribusi tetap menunjukkan kondisi terkini, tidak mengikuti filter tahun grafik. Tidak membuat tren atau notifikasi dummy. Data pemasangan tidak mempunyai nilai negatif; pola bar negatif tidak digunakan. Peringatan kapasitas batch memakai ambang 450 dari batas 500, bukan target operasional yang dibuat-buat.

Notifikasi berarti aktivitas batch dalam scope. Penanda dibaca, riwayat halaman terbaru, preferensi tema, dan sidebar disimpan pada browser, dipisahkan per pengguna untuk aktivitas/riwayat. Tidak ada timer sesi pada UI; masa berlaku sesi ditentukan Auth.

## Komponen

Menu/select memakai panel frosted dengan keyboard dan pencarian opsional; di bawah 640 px menjadi bottom sheet. Dropdown Bag Filter (kompartemen, area kolom/baris, Brand/Pabrikan, tahun grafik termasuk ringkasan di Portal) tidak memakai kolom pencarian. Saat dibuka, opsi terpilih menerima fokus dan digulir ke area terlihat; panah, Home/End, Enter/Space, Escape dan klik luar tetap tersedia. `Select` bersama memakai `searchable=true` secara default, sehingga dropdown aplikasi lain tetap mempunyai pencarian. Input berlabel memakai focus halo, clear, textarea auto-grow/counter, serta kalender WIB dan shortcut Sekarang. Pencatatan penggantian memakai sheet kanan desktop/bottom mobile; draft dipertahankan ketika sheet atau tema berganti. Aksi destruktif mempunyai konfirmasi. Pesan berhasil memakai toast.

Tema tersedia melalui menu ikon Terang/Gelap/Sistem; Sistem tetap default. Pilihan tersimpan lintas aplikasi dan tab. Inisialisasi di head mencegah kilatan tema; perubahan memakai circular view transition jika didukung dan tanpa reduced motion. Storage yang diblokir, sessionStorage, dan pemulihan halaman dari cache ditangani provider.

## Peta bag

Enam equipment tetap memakai 18.784 identitas koordinat, orientasi, label, dan jeda stiffener yang sudah dikoreksi. Skala continuous dari stop 0/210/420/630/840/1050/1260 hari: #8FCB2F, #BDD62E, #EBD52F, #F7B32B, #F4862A, #E65A2A, #CF2E2E. Tujuh kategori: 0–209, 210–419, 420–629, 630–839, 840–1049, 1050–1259, dan 1260+ hari. Umur ≥1.260 menetap merah dan mendapat notch; KPI perhatian mengikuti ambang yang sama. Posisi kosong mengikuti gray-150 / gray-800, dengan border putus-putus di detail. Umur tidak memakai hatch.

Seleksi mempertahankan fill umur: overview memakai garis inset dua warna, sedangkan detail memakai double ring dan centang. Mendukung klik, Shift-click rentang dalam kompartemen, marquee mouse, arrows/Space, dan Shift+arrows; seluruh cara tetap dibatasi 500 posisi unik. Filter legenda hanya meredupkan tampilan, tidak menghapus pilihan. Hover menyajikan koordinat, umur, tanggal WIB, dan brand. Detail mobile menggunakan sel ≥44 px dalam area scroll internal dengan label baris di kiri; overview tetap muat tanpa scroll horizontal halaman.

### Pemilihan banyak bag

Detail dan **Area bag** menggunakan satu dropdown **Kompartemen** yang mencakup kedua sisi, tanpa dropdown Sisi terpisah. Urutannya 1–24 pada 561/562, 1A–15A lalu 1B–15B pada 421/422, dan 1–16 pada L61/L62. Pilihan tetap menunjuk sisi/nomor lokal fisik; misalnya Comp. 13 pada 561/562 adalah Selatan lokal 12, dan Comp. 9 pada L61/L62 adalah Barat lokal 8. Badge sisi dan orientasi peta mengikuti kompartemen yang dipilih. Pilihan bag sebelumnya tetap tersimpan.

Operator/admin dapat membuka sheet **Pilih banyak** setelah kontrol Kompartemen. Mode **Kompartemen penuh** memakai checkbox berkelompok menurut sisi dan nama lapangan; kartu cukup menampilkan `1A`, `2A`, dan seterusnya, dengan nama aksesibel tetap `Comp. 1A`. Header menampilkan **1 kompartemen = 136/128 bag** sesuai equipment dan batas 500. Mode **Area bag** memakai satu kompartemen, rentang kolom dan rentang baris inklusif. Titik awal/akhir yang terbalik dinormalisasi. Keduanya menambah pilihan sebelumnya tanpa duplikasi. Contoh 421/422: tiga kompartemen penuh 408 bag ditambah area A–G/baris 1–6 pada kompartemen keempat 42 bag menjadi 450.

Kuota kompartemen diperiksa sebelum checkbox dapat dipilih. Item yang tidak muat dinonaktifkan, tetapi checkbox draft yang sudah dicentang tetap dapat dibatalkan. Kompartemen parsial dihitung dari bag unik yang belum ada, bukan selalu membebankan 136/128 bag penuh. Sisa kuota kecil mengarahkan pengguna ke Area bag. Validasi final 500 posisi tetap berlaku; area yang berlebih memperlihatkan angka total merah dan pesan singkat **Lebih N bag. Perkecil area.**, tanpa banner besar atau pemilihan sebagian otomatis.

Panel memakai header/footer tetap dan satu region gulir internal dengan pembatas serta fade ketika masih ada isi tersembunyi. Footer menyatu dengan latar overlay, menampilkan **Sudah ada + Tambahan = Total / 500** dengan baseline angka sejajar, serta pesan sisa kuota/overlap seperlunya. Tombol Batal dan Tambahkan pilihan memenuhi lebar footer dengan rasio 1:2 pada desktop maupun mobile. Mode memakai garis aktif, berbeda dari kartu checkbox. Khusus panel ini handle geser tidak ditampilkan; kontrol tutup visual hanya X dan Batal. Batal, Escape dan backdrop membuang draft tanpa mengubah pilihan aktif. Setelah diterapkan, sheet menutup dan pembukaan berikutnya memulai draft baru. Filter umur tetap hanya mengubah tampilan, sehingga seluruh koordinat area yang ditentukan tetap masuk perhitungan.

**Urungkan pilihan terakhir** memulihkan satu perubahan seleksi, termasuk penambahan massal, klik individual, rentang keyboard dan Bersihkan semua. Gerakan marquee mouse dihitung sebagai satu perubahan; drag yang dibatalkan atau melampaui kapasitas memulihkan pilihan sebelum drag. Penyimpanan berhasil mengosongkan pilihan dan riwayat undo. Tidak ada persistensi seleksi ke database/browser storage atau perubahan kontrak batch.

Form pencatatan menampilkan kelompok kompartemen beserta jumlah bag dalam `details/summary` yang mula-mula tertutup. Membuka kelompok memperlihatkan koordinat yang dapat dikeluarkan satu per satu. Semua cara seleksi tetap memakai satu tanggal, brand, alasan dan WO per batch. Viewer tidak memperoleh kontrol pemilihan/tulis; operasi dikunci selama penyimpanan. UI memakai token, Select dan Overlay platform yang sama dalam terang/gelap serta desktop/mobile.

## Kontras dan adaptasi yang disengaja

- Gray-500 di atas canvas gray-100 hanya 4,27:1. Caption pada canvas memakai gray-600/700; gray-500 digunakan pada surface putih. Dark mode memakai tingkat yang lebih terang.
- Putih di atas danger light hanya 3,91:1; tombol danger memakai teks ink yang memenuhi kontras. Pesan error mempertahankan penanda error dan teks gelap/terang yang terbaca.
- Gray-950 tidak mencapai 4,5:1 dekat ujung merah skala continuous. Teks sel dipilih dari luminansi aktual, memakai gray-1000 atau putih; switch terjadi ketika pasangan lain lebih terbaca, bukan batas umur 900 yang kaku. Sel tua tetap ditandai notch.
- Ukuran sel overview menyesuaikan lebar/jumlah kompartemen pada kontainer luas. Pada kontainer di bawah 960 px, peta memakai satu kanvas scroll horizontal dengan kompartemen berukuran tetap; detail menyediakan target sentuh 44 px. Tidak menimbulkan scroll horizontal pada halaman.
- Reduced motion mematikan reveal, count-up, shimmer, tilt, dan gerak; konten dan fungsi tetap tersedia.

Hasil pemeriksaan aktual dicatat di [VALIDATION.md](VALIDATION.md). Referensi primitive: [HTML dialog](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement), [View Transitions](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition), dan [React flushSync](https://react.dev/reference/react-dom/flushSync).

### Overview kompartemen pada ruang sempit

Kedua sisi equipment berada pada satu kanvas agar posisi atas–bawah selalu sejajar saat digeser. Container query membaca lebar area peta, termasuk perubahan saat sidebar diciutkan: di bawah 960 px setiap kompartemen berukuran 140 px dengan jarak 10 px. Ukuran ini sekitar 20% lebih ringkas dari iterasi awal 176 px. Nomor baris memakai 10 px, identitas kolom 9 px, dan judul lengkap kompartemen 10 px dengan tinggi 40 px; tombol navigasi tetap 44 px. Pada kontainer yang lebih luas, peta tetap mengikuti susunan desktop. Kartu statistik equipment disusun vertikal di bawah viewport 768 px, tanpa memengaruhi statistik halaman lain.

Kolom nomor pada seluruh baris dan header kolom memakai gutter bersama `--overview-row-gutter`: `clamp(12px, 0.75vw, 16px)` pada desktop dan 16 px pada mode scroll. Lebar gutter tidak dihitung dari isi nomor tiap baris, sehingga baris 1–9 dan 10–17 menghasilkan ukuran serta posisi kotak yang sama. Header kolom memakai track dan jarak horizontal 2 px yang sama dengan grid bag. Nomor memakai angka tabular dan line-height eksplisit agar tinggi/jarak baris konsisten; stiffener tetap menambahkan margin yang telah dikonfigurasi.

Judul dan legenda berada di luar area scroll. Petunjuk geser dan tombol sebelumnya/berikutnya tersedia pada mode scroll; setiap klik menggeser satu kolom. Tombol dinonaktifkan pada ujung peta, dan indikator tepi hanya muncul pada arah yang masih memiliki konten tersembunyi. Indikator berada di luar kanvas sehingga tidak menutupi label. Region peta dapat difokuskan: panah kiri/kanan menggeser satu kolom dan Home/End menuju ujung; tombol kompartemen tetap membuka detail. Reduced motion menonaktifkan animasi scroll.

Scroll sentuh memakai perilaku native browser, mendukung geser horizontal, gulir vertikal halaman dan pinch zoom. Gerakan pan tidak mengaktifkan bag atau judul kompartemen. Pergantian tema, filter umur dan pilihan bag mempertahankan posisi scroll; membuka equipment berbeda memulai peta dari kiri. Observer ukuran dan posisi scroll menjaga tombol tetap sesuai setelah resize, rotasi perangkat atau perubahan sidebar. Orientasi, koordinat, warna data dan jeda stiffener tetap mengikuti konfigurasi equipment.

# Perluasan Consumable Room

Consumable Room memakai token dan komponen UI refresh yang sama: shell, tema Sistem/Terang/Gelap, input/select, overlay, confirmation, dan tabel responsif. Tidak menambahkan palette. Penerimaan/pemakaian menggunakan aksen fungsional dengan label, grafik Q1–Q4 menghitung transaksi, dan “Belum dihitung” berbeda dari stok nol. Portal menampilkan ringkasan aplikasi secara terpisah.

Penyempurnaan mengikuti [Consumable Room UI Polish](design/CONSUMABLE-ROOM-UI-POLISH.md). Halaman aplikasi memakai satu judul, hero chart dengan tiga KPI di samping, kartu kesiapan saldo awal/perhatian, serta rail aksi dan aktivitas. Portal memakai ringkasan compact. Data kuartal adalah jumlah transaksi, sedangkan KPI stok dan aktivitas terbaru tetap kondisi saat ini.

Sidebar mengelompokkan menu menurut aplikasi. Submenu hanya terbuka pada aplikasi aktif; Portal/Profil/Kelola akses menampilkan daftar aplikasi ringkas. Nama induk menuju ringkasan, chevron mengubah ekspansi, dan rail ikon membuka flyout. Navigasi mempunyai scroll sendiri. Sidebar tidak lagi memiliki kartu/countdown/ikon sesi, popup sesi atau logout. Logout tetap tersedia melalui Menu akun dan Profil; pengaturan sesi server tidak berubah. Pada mobile, CSS langsung menyembunyikan sidebar desktop sebelum drawer terpasang agar tidak menambah tinggi halaman pada hydration/perubahan viewport.

Submenu memakai `NavigationTree` berupa daftar `ul/li` bersarang. Setiap `.nav-tree-item` menggambar satu segmen batang 1 px dan cabang membulat menuju tengah `.nav-tree-row`; item terakhir menghentikan batang pada cabangnya. Tinggi baris 36 px pada desktop dan 44 px di drawer mobile ditentukan `--nav-tree-row-height`, sehingga garis, label, dan penanda aktif tetap sejajar. Indentasi 22 px, lengan 14 px dan radius 6 px dipusatkan pada token komponen `.nav-tree`. Subgrup Equipment mengikuti struktur yang sama. Warna garis memakai `--sidebar-treeLine`; hover dan pilihan mengikuti token sidebar. Fokus keyboard berada di dalam baris agar tidak terpotong area scroll, dan garis dekoratif tidak menerima pointer. Spasi subgrup memakai padding agar tidak memutus garis antarnode.

Chart Consumables memakai skala count bilangan bulat dengan baseline nol, empat kuartal, batas bar 72 px, dan panel rincian yang dapat dipilih dengan pointer/keyboard/tap. Tidak ada tinggi minimum untuk membuat bar nol atau memperbesar kuartal kecil. Activity row dipakai bersama varian Portal dan halaman aplikasi; deskripsi maksimal dua baris, metadata dipendekkan secara visual dengan teks lengkap pada detail/title, nilai dan satuan berada di kanan, dan delapan baris dibatasi scroll internal. Style dashboard Bag Filter tidak diubah.

## Batas interaksi hover dan overlay

Hover dasar tombol memakai `button:where(:hover:not(:disabled))` agar tidak menimpa pasangan permukaan/teks komponen khusus. Kontrol akun memakai hover permukaan netral, navigasi memakai token sidebar, dan logout pada Menu akun/Profil mempertahankan pasangan token tombol utama pada kedua tema. Komponen baru yang mempunyai warna khusus harus menentukan pasangan warna serta hover sendiri.

Overlay dirender melalui portal ke `document.body` setelah mount agar tidak berada di dalam label atau form pemanggil. Event pointer/click berhenti pada batas dialog; klik backdrop ditutup hanya jika penekanan dimulai di luar panel. Interaksi dalam menu dan drag keluar tidak dianggap dismissal. Escape serta penutupan normal mengembalikan fokus ke trigger; draft form tetap berada pada state pemanggil. Hasil audit TestSprite dan verifikasi lokal dicatat di [UI interaction results](testing/UI-INTERACTION-RESULTS.md).

## Halaman equipment Bag Filter

KPI umur memakai pemasangan aktif pada snapshot, bukan nilai konstanta palet. Rentang hari tidak dibatasi; nilai tertua ≥1.260 memakai token `--danger` dan disertai jumlah posisi tua. Posisi tanpa pemasangan tidak dihitung sebagai umur nol.

KPI Kompartemen mempertahankan angka jumlah kompartemen sebagai nilai utama; di bawahnya terdapat total bag dan bag per kompartemen. Metadata memakai angka tabular, bobot medium, dan token teks utama/sekunder, tanpa badge dekoratif tambahan. Kartu kanan **Penggantian bag {tahun}** memakai total bag yang dicatat menurut tanggal pemasangan WIB, dengan pembanding tahun sebelumnya berlabel **Jan–Des**. Rincian sisi dan catatan tanggal/WIB tidak ditampilkan di bawah kartu agar tetap ringkas. Penggantian berulang ikut terhitung setiap kejadian; total tahunan berbeda dari posisi terpasang aktif. Tidak memakai warna sukses/error atau persentase naik/turun untuk menilai frekuensi penggantian. Ketiga kartu mempunyai hierarki label/angka yang sama, tinggi sejajar pada desktop dan metadata membungkus pada mobile.

Header equipment memakai teks ringkas **Diperbarui 4 Nov 2026**, berdasarkan waktu pencatatan batch terbaru (`updatedAt`), dengan tanggal WIB dan jam lengkap pada tooltip. Tanpa batch tampil **Belum ada pembaruan**. Tanggal pemasangan mundur dan filter riwayat tidak memengaruhi penentuan waktu pembaruan.

Pada mobile teks pembaruan berada di bawah deskripsi, satu baris tanpa rincian jam; pada desktop tetap di kanan.

Sel overview terpilih memakai dua garis inset tipis (`--selectionGap`/`--selectionRing`) tanpa mengubah ukuran atau jarak. Hover tidak memperbesar sel. Penanda bag tua maksimal sepertiga sel dan maksimal 3 px. Kompartemen aktif memakai bingkai luar tipis dan garis pada judul dengan `aria-current`; statusnya terpisah dari pilihan posisi.

Kontainer `bag-workspace` menentukan layout: minimal 960 px memakai kolom 520 px dan sisa ruang untuk timeline/pekerjaan; di bawahnya satu kolom maksimal 520 px. Target detail mobile tetap minimal 44 px dengan scroll internal. Timeline maksimal 320 px dan pekerjaan 560 px. Bilah pencatatan hanya muncul jika ada pilihan, tersembunyi selama sheet terbuka; Pilih banyak memakai tombol sekunder dan Undo/Clear memakai ghost. Ruang bawah halaman menjaga kontrol terakhir dapat digulir melewati bilah.

Tooltip peta mengikuti jenis input: hover mouse dan fokus keyboard tetap memberi info cepat; sentuhan/pen tidak membuka tooltip. Pointer sentuh membatalkan timer tooltip sebelum fokus sel, dan gulir/Escape menghilangkan tooltip. Tap memilih/membatalkan bag dan memperbarui panel **Riwayat koordinat** yang sudah ada, tanpa membuka popup atau menggulir halaman otomatis. Tidak ada bar ringkasan, tombol **Lihat info**, atau sheet informasi tambahan di atas grid.

Informasi pemasangan, umur, pabrikan dan riwayat tetap tersedia pada satu panel Riwayat koordinat, termasuk loading/error/retry/pagination. Viewer dapat memeriksa informasi tanpa memilih untuk pencatatan. Penentuan tooltip tidak memakai breakpoint layar, sehingga mouse pada tampilan sempit dan sentuhan pada desktop tetap sesuai inputnya.

Tooltip menunggu **400 ms** pada setiap koordinat, tanpa percepatan setelah tooltip sebelumnya terbuka. Berpindah sel memulai ulang delay; klik/pemilihan, meninggalkan sel, gulir dan Escape membatalkan timer serta menutup tooltip. Klik beruntun tidak membuka tooltip setelah pemilihan selesai; info cepat tetap tersedia dengan mengarahkan mouse kembali pada bag.
