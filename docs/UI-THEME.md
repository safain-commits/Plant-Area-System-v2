# UI refresh v2 — Plant Area System

Acuan aktif: [brief visual](design/UI-REFRESH.md) dan [token sheet](design/ui-brief.jsonc), menggantikan aturan warna sebelumnya. Nilai palette, semantic light/dark, radius, dan motion diekstrak ke packages/ui/src/tokens.css. Komponen mengonsumsi token semantik. Tidak menambahkan dependency UI atau resource font eksternal; komponen memakai React dan primitive dialog browser untuk focus trap, Escape, dan pengembalian focus.

## Shell dan data aktual

Sidebar 248 px / rail 76 px mengikuti tema dan mengingat pilihan browser. Ctrl/Cmd+B mengubah sidebar; Ctrl/Cmd+K membuka command palette. Tablet memakai rail dan ekspansi overlay; mobile memakai drawer. Equipment mengikuti grant; link halaman admin mengikuti role. Header berisi pencarian, menu tema, aktivitas batch, akun, dan aksi aplikasi.

Dashboard membaca endpoint Bag Filter dengan sesi pengguna: grafik pemasangan per hari WIB (7/30 hari, per brand), KPI total/terpasang/kosong/≥900 hari, distribusi umur aktif, gauge cakupan, progress equipment, dan aktivitas terbaru. Tidak membuat tren atau notifikasi dummy. Data pemasangan tidak mempunyai nilai negatif; pola bar negatif tidak digunakan. Peringatan kapasitas batch memakai ambang 450 dari batas 500, bukan target operasional yang dibuat-buat.

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
- Ukuran sel overview menyesuaikan lebar/jumlah kompartemen agar peta keseluruhan tetap muat; detail menyediakan target sentuh 44 px. Nilai 10–12 px overview dalam brief adalah target pada ruang yang cukup.
- Reduced motion mematikan reveal, count-up, shimmer, tilt, dan gerak; konten dan fungsi tetap tersedia.

Hasil pemeriksaan aktual dicatat di [VALIDATION.md](VALIDATION.md). Referensi primitive: [HTML dialog](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement), [View Transitions](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition), dan [React flushSync](https://react.dev/reference/react-dom/flushSync).
