# UI refresh v2 — Plant Area System

Acuan aktif: [brief visual](design/UI-REFRESH.md) dan [token sheet](design/ui-brief.jsonc), menggantikan aturan warna sebelumnya. Nilai palette, semantic light/dark, radius, dan motion diekstrak ke packages/ui/src/tokens.css. Komponen mengonsumsi token semantik. Tidak menambahkan dependency UI atau resource font eksternal; komponen memakai React dan primitive dialog browser untuk focus trap, Escape, dan pengembalian focus.

## Shell dan data aktual

Identitas produk memakai [artwork TQ-CMMS](../brand/README.md): logo penuh pada sidebar expanded/form login/ganti password, serta simbol ringkas pada sidebar collapsed dan favicon. Komponen bersama memakai token teks dan aksen primary agar mengikuti tema tanpa mengubah proporsi artwork. Hero login memakai logo satu warna gelap di atas lime. Favicon masing-masing aplikasi tersedia tanpa login pada prefix aplikasinya, mengikuti preferensi warna browser/OS dan memakai revision hash untuk cache.

Sidebar 248 px / rail 76 px mengikuti tema dan mengingat pilihan browser. Ctrl/Cmd+B mengubah sidebar; Ctrl/Cmd+K membuka command palette. Tablet memakai rail dan ekspansi overlay; mobile memakai drawer. Equipment mengikuti grant; link halaman admin mengikuti role. Header berisi pencarian, menu tema, aktivitas batch, akun, dan aksi aplikasi.

Dashboard membaca endpoint Bag Filter dengan sesi pengguna: grafik pemasangan Q1–Q4 per tahun (per brand, batas tanggal WIB), KPI total/terpasang/kosong/≥900 hari, distribusi umur aktif, gauge cakupan, progress equipment, dan aktivitas terbaru. Tahun default mengikuti waktu server WIB; pilihan tahun 2000 sampai tahun berjalan. Q1 Januari–Maret, Q2 April–Juni, Q3 Juli–September, Q4 Oktober–Desember. Tahun berjalan diberi keterangan bahwa datanya belum satu tahun penuh; pembanding adalah total tahun sebelumnya. KPI dan distribusi tetap menunjukkan kondisi terkini, tidak mengikuti filter tahun grafik. Tidak membuat tren atau notifikasi dummy. Data pemasangan tidak mempunyai nilai negatif; pola bar negatif tidak digunakan. Peringatan kapasitas batch memakai ambang 450 dari batas 500, bukan target operasional yang dibuat-buat.

Notifikasi berarti aktivitas batch dalam scope. Penanda dibaca, riwayat halaman terbaru, preferensi tema, dan sidebar disimpan pada browser, dipisahkan per pengguna untuk aktivitas/riwayat. Timer membaca sessionExpiresAt dari Auth dan tidak memperpanjang sesi.

## Komponen

Menu/select memakai panel frosted dengan keyboard dan pencarian; di bawah 640 px menjadi bottom sheet. Input berlabel memakai focus halo, clear, textarea auto-grow/counter, serta kalender WIB dan shortcut Sekarang. Pencatatan penggantian memakai sheet kanan desktop/bottom mobile; draft dipertahankan ketika sheet atau tema berganti. Aksi destruktif mempunyai konfirmasi. Pesan berhasil memakai toast.

Tema tersedia melalui menu ikon Terang/Gelap/Sistem; Sistem tetap default. Pilihan tersimpan lintas aplikasi dan tab. Inisialisasi di head mencegah kilatan tema; perubahan memakai circular view transition jika didukung dan tanpa reduced motion. Storage yang diblokir, sessionStorage, dan pemulihan halaman dari cache ditangani provider.

## Peta bag

Enam equipment tetap memakai 18.784 identitas koordinat, orientasi, label, dan jeda stiffener yang sudah dikoreksi. Skala continuous dari stop 0/150/300/450/600/750/900 hari: #8FCB2F, #BDD62E, #EBD52F, #F7B32B, #F4862A, #E65A2A, #CF2E2E. Umur ≥900 menetap merah dan mendapat notch. Posisi kosong mengikuti gray-150 / gray-800, dengan border putus-putus di detail. Umur tidak memakai hatch.

Seleksi mempertahankan fill umur, memakai double ring dan centang. Mendukung klik, Shift-click rentang dalam kompartemen, marquee mouse, arrows/Space, dan Shift+arrows; seluruh cara tetap dibatasi 500 posisi unik. Filter legenda hanya meredupkan tampilan, tidak menghapus pilihan. Hover menyajikan koordinat, umur, tanggal WIB, dan brand. Detail mobile menggunakan sel ≥44 px dalam area scroll internal dengan label baris di kiri; overview tetap muat tanpa scroll horizontal halaman.

## Kontras dan adaptasi yang disengaja

- Gray-500 di atas canvas gray-100 hanya 4,27:1. Caption pada canvas memakai gray-600/700; gray-500 digunakan pada surface putih. Dark mode memakai tingkat yang lebih terang.
- Putih di atas danger light hanya 3,91:1; tombol danger memakai teks ink yang memenuhi kontras. Pesan error mempertahankan penanda error dan teks gelap/terang yang terbaca.
- Gray-950 tidak mencapai 4,5:1 dekat ujung merah skala continuous. Teks sel dipilih dari luminansi aktual, memakai gray-1000 atau putih; switch terjadi ketika pasangan lain lebih terbaca, bukan batas umur 900 yang kaku. Sel tua tetap ditandai notch.
- Ukuran sel overview menyesuaikan lebar/jumlah kompartemen pada kontainer luas. Pada kontainer di bawah 960 px, peta memakai satu kanvas scroll horizontal dengan kompartemen berukuran tetap; detail menyediakan target sentuh 44 px. Tidak menimbulkan scroll horizontal pada halaman.
- Reduced motion mematikan reveal, count-up, shimmer, tilt, dan gerak; konten dan fungsi tetap tersedia.

Hasil pemeriksaan aktual dicatat di [VALIDATION.md](VALIDATION.md). Referensi primitive: [HTML dialog](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement), [View Transitions](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition), dan [React flushSync](https://react.dev/reference/react-dom/flushSync).

### Overview kompartemen pada ruang sempit

Kedua sisi equipment berada pada satu kanvas agar posisi atas–bawah selalu sejajar saat digeser. Container query membaca lebar area peta, termasuk perubahan saat sidebar diciutkan: di bawah 960 px setiap kompartemen berukuran 140 px dengan jarak 10 px. Ukuran ini sekitar 20% lebih ringkas dari iterasi awal 176 px. Nomor baris memakai 10 px, identitas kolom 8 px, dan judul lengkap kompartemen 10 px dengan target sentuh minimal 44 px. Pada kontainer yang lebih luas, peta tetap mengikuti susunan desktop. Kartu statistik equipment disusun vertikal di bawah viewport 768 px, tanpa memengaruhi statistik halaman lain.

Judul dan legenda berada di luar area scroll. Petunjuk geser dan tombol sebelumnya/berikutnya tersedia pada mode scroll; setiap klik menggeser satu kolom. Tombol dinonaktifkan pada ujung peta, dan indikator tepi hanya muncul pada arah yang masih memiliki konten tersembunyi. Indikator berada di luar kanvas sehingga tidak menutupi label. Region peta dapat difokuskan: panah kiri/kanan menggeser satu kolom dan Home/End menuju ujung; tombol kompartemen tetap membuka detail. Reduced motion menonaktifkan animasi scroll.

Scroll sentuh memakai perilaku native browser, mendukung geser horizontal, gulir vertikal halaman dan pinch zoom. Gerakan pan tidak mengaktifkan bag atau judul kompartemen. Pergantian tema, filter umur dan pilihan bag mempertahankan posisi scroll; membuka equipment berbeda memulai peta dari kiri. Observer ukuran dan posisi scroll menjaga tombol tetap sesuai setelah resize, rotasi perangkat atau perubahan sidebar. Orientasi, koordinat, warna data dan jeda stiffener tetap mengikuti konfigurasi equipment.

# Perluasan Consumable Room

Consumable Room memakai token dan komponen UI refresh yang sama: shell, tema Sistem/Terang/Gelap, input/select, overlay, confirmation, dan tabel responsif. Tidak menambahkan palette. Penerimaan/pemakaian menggunakan aksen fungsional dengan label, grafik Q1–Q4 menghitung transaksi, dan “Belum dihitung” berbeda dari stok nol. Portal menampilkan ringkasan aplikasi secara terpisah.

Penyempurnaan mengikuti [Consumable Room UI Polish](design/CONSUMABLE-ROOM-UI-POLISH.md). Halaman aplikasi memakai satu judul, hero chart dengan tiga KPI di samping, kartu kesiapan saldo awal/perhatian, serta rail aksi dan aktivitas. Portal memakai ringkasan compact. Data kuartal adalah jumlah transaksi, sedangkan KPI stok dan aktivitas terbaru tetap kondisi saat ini.

Sidebar mengelompokkan menu menurut aplikasi. Submenu hanya terbuka pada aplikasi aktif; Portal/Profil/Kelola akses menampilkan daftar aplikasi ringkas. Nama induk menuju ringkasan, chevron mengubah ekspansi, dan rail ikon membuka flyout. Akun/sesi berada di area tetap; navigasi mempunyai scroll sendiri. Session card ringkas membuka detail kedaluwarsa WIB tanpa memperpanjang sesi. Pada mobile, CSS langsung menyembunyikan sidebar desktop sebelum drawer terpasang agar tidak menambah tinggi halaman pada hydration/perubahan viewport.

Submenu memakai `NavigationTree` berupa daftar `ul/li` bersarang. Setiap `.nav-tree-item` menggambar satu segmen batang 1 px dan cabang membulat menuju tengah `.nav-tree-row`; item terakhir menghentikan batang pada cabangnya. Tinggi baris 36 px pada desktop dan 44 px di drawer mobile ditentukan `--nav-tree-row-height`, sehingga garis, label, dan penanda aktif tetap sejajar. Indentasi 22 px, lengan 14 px dan radius 6 px dipusatkan pada token komponen `.nav-tree`. Subgrup Equipment mengikuti struktur yang sama. Warna garis memakai `--sidebar-treeLine`; hover dan pilihan mengikuti token sidebar. Fokus keyboard berada di dalam baris agar tidak terpotong area scroll, dan garis dekoratif tidak menerima pointer. Spasi subgrup memakai padding agar tidak memutus garis antarnode.

Chart Consumables memakai skala count bilangan bulat dengan baseline nol, empat kuartal, batas bar 72 px, dan panel rincian yang dapat dipilih dengan pointer/keyboard/tap. Tidak ada tinggi minimum untuk membuat bar nol atau memperbesar kuartal kecil. Activity row dipakai bersama varian Portal dan halaman aplikasi; deskripsi maksimal dua baris, metadata dipendekkan secara visual dengan teks lengkap pada detail/title, nilai dan satuan berada di kanan, dan delapan baris dibatasi scroll internal. Style dashboard Bag Filter tidak diubah.

## Batas interaksi hover dan overlay

Hover dasar tombol memakai `button:where(:hover:not(:disabled))` agar tidak menimpa pasangan permukaan/teks komponen khusus. Kontrol akun/sesi memakai hover permukaan netral, navigasi memakai token sidebar, dan logout mempertahankan pasangan token tombol utama pada kedua tema. Komponen baru yang mempunyai warna khusus harus menentukan pasangan warna serta hover sendiri.

Overlay dirender melalui portal ke `document.body` setelah mount agar tidak berada di dalam label atau form pemanggil. Event pointer/click berhenti pada batas dialog; klik backdrop ditutup hanya jika penekanan dimulai di luar panel. Interaksi dalam menu dan drag keluar tidak dianggap dismissal. Escape serta penutupan normal mengembalikan fokus ke trigger; draft form tetap berada pada state pemanggil. Hasil audit TestSprite dan verifikasi lokal dicatat di [UI interaction results](testing/UI-INTERACTION-RESULTS.md).
