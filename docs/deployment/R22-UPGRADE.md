# Upgrade Consumable Room R22

Rilis ini memperbarui empat aplikasi karena kontrak grant, notifikasi dan dokumen bersama berubah. Deploy melalui SHA teruji mengikuti [Development → VPS](DEVELOPMENT-TO-VPS.md). Jangan merestore database laptop ke produksi yang sudah live. Tidak ada tindakan VPS yang dilakukan oleh perubahan source ini.

Untuk update dari GitHub, gunakan [handover OpenClaw R22](OPENCLAW-R22-UPDATE.md), dengan full SHA dari pemilik dan CI commit tersebut yang lulus. Panduan itu mencakup rehearsal migrasi memakai salinan database VPS sebelum perubahan produksi.

## Checkpoint OpenClaw

1. Catat SHA produksi, image digest, pin MySQL, status layanan dan kapasitas disk. Tinjau diff SQL `0002` serta `0003`; jangan mengubah migrasi terdahulu.
2. Buat backup **VPS terkini** tiga database dan konfigurasi terenkripsi, verifikasi offsite serta restore drill sesuai runbook. Masukkan `stock_documents`, `stock_document_sequences` dan `stock_idempotency` dalam pemeriksaan pemulihan.
3. Jalankan preflight read-only dengan image tools rilis baru dan kredensial runtime/migrasi yang sudah tersedia pada deployment:

   ```sh
   dc run --rm --no-deps migrate consumables:preflight
   ```

   `dc` adalah fungsi Compose dengan override VPS/pin pada runbook VPS. Perintah keluar nonzero jika menemukan inventory/ledger/dokumen pada ruang selain ID R22 tetap, nama R22 milik ID lain, atau konfigurasi tujuan nonaktif/tidak sesuai. Laporan hanya berisi jumlah, bukan data material atau rahasia. **Berhenti dan laporkan** bila blocked; jangan menghapus, menggabungkan atau mengubah FK untuk meloloskannya. Kondisi produksi yang dikonfirmasi pemilik: baru mempunyai master material.

4. Pertahankan maintenance dan hentikan empat aplikasi/penulis terjadwal sebelum backup final dan migrasi. Ulangi preflight. Jalankan migrator rilis yang sama; migrator melakukan preflight sebelum migrasi database lain. Jangan bootstrap atau impor katalog ulang.

   ```sh
   dc run --rm --no-deps migrate db:migrate
   ```

5. Verifikasi jurnal, jumlah master serta hash **kolom lama** tidak berubah, ruang R22 tepat satu, role/status/grant Bag Filter dipertahankan. Kolom SAP/alias/aturan pecahan/peninjauan konversi yang baru memang bertambah; hash `SELECT *` sebelum/sesudah perubahan schema tidak diharapkan identik. Scope Consumables tidak lagi diperlukan. Jalankan `consumables:reconcile`; hasil kosong untuk master-only. Rerun migrator tidak membuat ruang/grant/dokumen tambahan.
6. Recreate keempat aplikasi dari image rilis tersebut, tunggu readiness, cek prefix/aset/gateway. Uji login existing dan SSO, hak empat role, pencabutan grant, metadata lokasi 404 serta API lokasi 410. Setelah izin pemilik, lakukan penerimaan operasional tanpa memasukkan fixture sintetis ke produksi. Buka maintenance sesuai checkpoint rilis, lalu pantau error/backup.

Rollback aplikasi tidak menjalankan down migration. Tabel baru dan riwayat dipertahankan. Jangan menurunkan aplikasi Consumables ke versi per lokasi setelah stok R22 sudah digunakan: versi lama dapat mengubah hak/semantik data. Gunakan maintenance + perbaikan maju atau pulihkan backup bersama pemilik dengan memperhitungkan transaksi setelah backup. Jangan menghapus volume.

## Saldo awal, rak dan konversi

Admin membuka Pengelolaan → Stok, rak & saldo awal, memilih master dan rak opsional. Konfirmasi hitung fisik termasuk nol. Saldo awal hanya sekali; koreksi berikutnya memerlukan alasan dan versi saldo. Picklist boleh auto-enroll material baru dengan opening nol; inventory existing belum dihitung harus diperiksa admin lebih dahulu.

Tinjau faktor pack legacy sebelum dipakai sebagai konversi SAP → R22. Satuan SAP dan satuan terkecil R22 dapat berbeda; UI menampilkan preview. Satuan R22 terkunci sesudah transaksi pertama. Perubahan faktor tidak mengubah snapshot lama.

## CLI penamaan privat

Gunakan CSV UTF-8 (BOM diperbolehkan), MMID sebagai teks dan tepat tujuh header; urutan kolom dapat berbeda:

```csv
mmid,common_name,aliases,unit,sap_unit,pack_size,decimal_allowed
SYNTHETIC-001,Baut M16,"bolt, mur",PCS,SET,2,false
```

Baris tersebut hanya contoh format, bukan data produksi. Field kosong berarti **tidak mengubah nilai lama**, bukan menghapus. `pack_size` memakai titik desimal positif maksimal enam angka pecahan; `decimal_allowed` true/false atau 1/0. MMID harus sudah ada. Kode duplikat, kolom/format invalid, kode tidak dikenal dan perubahan satuan yang terkunci membatalkan seluruh apply. Nama SAP dan MMID tidak diubah CLI.

```sh
pnpm consumables:import-naming /private/naming.csv --dry-run
pnpm consumables:import-naming /private/naming.csv --apply
pnpm consumables:reconcile
```

Default dry-run; apply eksplisit dan atomik. Simpan laporan checksum/count secara privat. Replay file identik tidak mengubah versi; jika master berubah manual setelah apply, replay yang akan menimpanya ditolak. Buat file revisi yang ditinjau. CSV, arsip, dump, rahasia dan source klien tetap di luar Git/image. Jangan meletakkan CSV perusahaan di dokumentasi publik.

## Prompt handover

```text
Lanjutkan update TQ-CMMS yang sudah live, memakai SHA rilis R22 yang saya tentukan.
Ikuti docs/deployment/R22-UPGRADE.md dan DEVELOPMENT-TO-VPS.md.
Jangan restore dump laptop, bootstrap ulang, impor ulang master, atau menghapus volume.
Bangun/pilih empat image dari SHA yang sama. Catat digest dan checkpoint.
Backup VPS terkini serta restore drill dahulu. Jalankan preflight stok tunggal.
Jika ditemukan inventory/transaksi noncanonical atau konflik R22, berhenti dan laporkan
jumlahnya tanpa menggabungkan atau menghapus data. Produksi seharusnya master saja.
Saat maintenance, hentikan penulis, ulangi backup/preflight, jalankan migrator rilis,
cek master/role/grant, rekonsiliasi dan readiness. Uji SSO, empat role, API, aset,
stok tunggal, rak opsional, HEC wajib, dokumen dan cetak. Pemilik menguji login sendiri.
Laporkan bukti, pekerjaan pending dan opsi rollback; jangan klaim selesai sebelum
penerimaan pemilik. Pertahankan backup terenkripsi dan sumber laptop lama yang beku.
```
