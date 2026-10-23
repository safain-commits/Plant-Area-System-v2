# Consumable Room v1

Status: implementasi rilis pertama, 23 Oktober 2026. Sumber kebutuhan adalah komponen Consumable Room dan backend prototype dalam arsip ekspor 22 Oktober 2026, dengan keputusan operasional pengguna yang dicatat di bawah.

## Tujuan dan keputusan

Aplikasi mandiri untuk pemeriksaan stok, penerimaan, pemakaian mandiri, saldo awal, dan koreksi material. ID aplikasi `consumables`, URL `/consumables`, SSO sama dengan Portal dan Bag Filter. Menggunakan design system UI refresh saat ini, termasuk tema, komponen form, sidebar, command palette, dan notifikasi.

- Impor seluruh master katalog arsip; jangan mengimpor stok, nilai finansial, transaksi lama, atau data dummy.
- Pisahkan katalog master dari material yang benar-benar dikelola pada lokasi. Hanya pasangan material–lokasi operasional yang masuk statistik stok.
- Lokasi dibuat admin sesuai keadaan aktual; tidak ada lokasi/rak/isi pack yang ditebak.
- Penerimaan dalam pack atau satuan dasar. Pemakaian dalam satuan dasar, termasuk pecahan maksimal enam desimal.
- SAP/MMID wajib dan unik, disimpan sebagai teks. Waktu pencatatan berasal dari server, disimpan UTC dan ditampilkan WIB.
- Tidak ada approval, reservasi, atau pengurangan stok otomatis saat mencatat penggantian Bag Filter.

## Audit source lama

Versi arsip mempunyai pencarian token AND, MMID/nama, kategori, area, ketersediaan, detail, penerimaan pack, pemakaian eceran, WO, pekerjaan, dan history. UI aktif memakai 18 material prototype. Katalog asli terpisah memiliki 17.744 kode unik, 43 satuan dan 13 kategori; tidak mempunyai lokasi, rak, atau isi pack.

Kelemahan yang diperbaiki: area tetap, izin jabatan global, quantity floating point, audit setelah transaksi terpisah, tanpa idempotensi, pengiriman semua master ke browser, serta history yang dipotong menjadi 300 transaksi sebelum filter. Source Cloudflare D1 digunakan sebagai referensi kebutuhan, bukan fondasi persistence baru.

## Peran

| Role        | Hak                                                                     |
| ----------- | ----------------------------------------------------------------------- |
| viewer      | Baca stok, detail, ringkasan, riwayat sesuai lokasi                     |
| operator    | Hak viewer + pemakaian sendiri                                          |
| storekeeper | Hak operator + penerimaan                                               |
| admin       | Seluruh lokasi, master, lokasi, daftar stok, saldo awal, koreksi, audit |

Admin portal mengelola grant. Status admin portal dan jabatan tidak otomatis memberi hak transaksi. Viewer/operator/storekeeper wajib mempunyai lokasi valid; admin aplikasi mencakup semua lokasi termasuk lokasi baru. Cakupan diterapkan pada API, query, dashboard, pencarian, dan notifikasi.

## Master dan lokasi

Master: MMID maksimal 80 karakter, nama asli 160, nama umum 160, satuan 30, kategori 100, MRP Type 30, critical boolean, isi pack nullable, status dan versi. MMID tidak dapat diubah; satuan dikunci setelah transaksi pertama. Isi pack yang dipakai disimpan sebagai snapshot transaksi.

Lokasi: nama unik maksimal 100 karakter, status dan versi. Pasangan material–lokasi unik, mempunyai rak maksimal 100 karakter, saldo, status penghitungan awal, status aktif, dan versi. Tidak ada hard delete. Penonaktifan ditolak bila masih mempunyai saldo. History tetap dapat dibaca dalam scope, termasuk untuk entitas nonaktif.

## Onboarding stok

1. Admin membuat lokasi, lalu memilih master dan mendaftarkannya ke lokasi.
2. Saldo awal sistem nol dan berstatus **Belum dihitung**; tidak dihitung sebagai stok habis.
3. Admin mencatat jumlah fisik, termasuk nol, disertai alasan.
4. Saldo awal hanya sekali. Setelahnya penerimaan dan pemakaian dapat dilakukan.

Koreksi memasukkan jumlah fisik target, alasan, dan versi saldo yang dilihat. Sistem membuat ledger selisih terhadap saldo terkunci. Versi berubah menghasilkan 409; admin harus meninjau ulang. Koreksi tanpa selisih ditolak. Tidak ada edit/delete transaksi historis.

## Transaksi

Satu penyimpanan untuk satu material dan satu lokasi. Semua angka stok memakai DECIMAL(18,6); JSON menggunakan string desimal kanonis. Tidak ada perhitungan jumlah melalui floating point.

- Penerimaan satuan dasar: quantity positif dan referensi wajib maksimal 200 karakter.
- Penerimaan pack: 1–100.000 pack bulat, isi pack terkonfigurasi, versi master yang dikonfirmasi. Jumlah dasar dihitung server; perubahan konfigurasi menghasilkan 409.
- Pemakaian: quantity positif, pekerjaan/equipment wajib maksimal 500, WO opsional 100, referensi opsional 200. Actor dari sesi.
- Saldo awal/koreksi: quantity fisik tidak negatif, alasan wajib maksimal 500, expectedVersion wajib.

Saldo tidak boleh negatif. Server memeriksa ulang quantity/status/izin; pencarian stok tidak mencadangkan barang. Ledger, saldo, audit, dan idempotensi disimpan atomik dengan row lock inventory dan penguncian master/lokasi untuk menahan perubahan konfigurasi selama transaksi.

Idempotency-Key wajib 8–128 karakter `[A-Za-z0-9._:-]`. Unik per actor; payload terkanonisasi yang sama replay, berbeda menghasilkan 409. Izin diperiksa sebelum replay. Timeout dapat dicoba ulang dengan key sama. Kegagalan refresh sesudah POST berhasil tidak boleh ditampilkan sebagai kegagalan menyimpan.

## UI

Halaman: Ringkasan, Cek stok, Penerimaan, Pemakaian, Riwayat, Pengelolaan, Audit. Daftar besar memakai pagination server 50; autocomplete 8. Stok lokasi dan katalog master mempunyai tampilan terpisah. Detail menunjukkan saldo dan rak hanya pada lokasi yang boleh dibaca.

KPI menghitung pasangan material–lokasi: operasional, tersedia, stok nol terkonfirmasi, critical stok nol, belum dihitung. Grafik Q1–Q4 berdasarkan waktu catat WIB dan tahun pilihan menghitung jumlah transaksi per jenis; tidak menjumlahkan quantity berbeda satuan.

Dashboard mengikuti susunan visual Bag Filter: hero chart dan KPI, dua kartu kesiapan saldo awal/perhatian, serta kolom aksi dan aktivitas. Tahun hanya memfilter chart; KPI dan aktivitas tetap terkini. Chart mempunyai sumbu integer, panel rincian kuartal, dan input keyboard/tap. Kesiapan saldo awal dihitung dari operasional dikurangi belum dihitung; kondisi tanpa inventory tidak menghasilkan persentase palsu. Portal memakai varian ringkas. Sidebar menampilkan submenu aplikasi aktif dengan role/scope yang sama seperti guard server.

Portal menampilkan ringkasan terpisah. Command palette dan notifikasi memanggil API setiap aplikasi sesuai grant, mempertahankan hasil sumber lain bila salah satu gagal. Status dibaca disimpan per browser, pengguna, dan aplikasi. Form tetap utuh saat tema berubah; seluruh halaman mempunyai loading, kosong, error/retry, dan konfirmasi berhasil. Tabel stok mobile menjadi kartu.

## Persistence dan deployment

Database `plant_consumables`, user runtime DML terpisah. Tidak ada FK lintas database. Kelompok tabel: materials, locations, inventory, stock_movements, stock_idempotency, consumables_audit, catalog_imports. Ledger mempunyai snapshot material, unit, lokasi, pack, actor, serta saldo sesudah pencatatan. Rekonsiliasi hanya membaca perbedaan ledger–saldo, tidak memperbaiki otomatis.

Migrasi Auth aditif menambah scope nullable, mempertahankan equipment Bag Filter. Checkpoint katalog memindahkan Consumables dari planned ke active, mempertahankan disabled, dan memberi admin aplikasi hanya kepada bootstrap aktif yang masih admin portal, sekali. Pengguna lain diatur manual.

Provisioning database berjalan eksplisit sebelum migrasi agar volume lama didukung. Empat container aplikasi mempunyai build mandiri. Hanya Nginx dipublikasikan; prefix/internal health dan metadata tidak terbuka. Backup mencakup tiga database dan retensi 14 hari. Rollback tidak menghapus tabel baru.

## Impor privat

CLI dry-run default, apply eksplisit. Mapping array sepuluh kolom: MMID, description, commonName, unit, mrpType, critical, sourceDate, stok lama (diabaikan), nilai lama (diabaikan), category.

Seluruh file divalidasi sebelum apply. Kode duplikat, field wajib kosong, tanggal invalid, checksum batch berubah, atau konflik master menghentikan impor. Apply atomik dengan insert bertahap, tidak membuat inventory atau transaksi. Pengulangan batch/checksum sama no-op; tidak menimpa edit manual. Arsip tetap lokal, tidak masuk Git/image; CI memakai data sintetis.

## Penerimaan rilis

Lulus typecheck, unit, integrasi MySQL dan browser HTTPS: presisi; opening nol/sekali; concurrency tanpa minus; rollback audit; idempotensi; pack stale; koreksi stale; snapshot historis; pagination; impor/konflik; empat role/scope; SSO/gateway; tema dan mobile; upgrade volume lama/checkpoint; backup/restore dan rekonsiliasi; regresi enam equipment Bag Filter. Hasil aktual dicatat pada VALIDATION.md.

Di luar rilis: approval, reservasi, retur/transfer khusus, sesi stock opname, multi-item dokumen, barcode, pengadaan, valuasi, integrasi SAP, dan integrasi transaksi otomatis dengan Bag Filter.
