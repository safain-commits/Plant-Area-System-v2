# Consumable Room v1.1 — R22

Revisi 2 November 2026. R22 memakai satu ruang stok bersama, terhubung ke Portal dan SSO pada `/consumables`. Revisi ini menggantikan pengelolaan stok per lokasi pada v1. Rujukan proses: brief R22 dan empat slide privat `ref-client/R22 Business Process.pptx`; berkas perusahaan tidak diterbitkan.

## Peran dan akses

| Label       | Role API      | Hak                                                     |
| ----------- | ------------- | ------------------------------------------------------- |
| Viewer      | `viewer`      | Membaca seluruh stok, dokumen dan riwayat R22           |
| Client      | `operator`    | Hak Viewer + Consume/Return mandiri                     |
| R22 Cashier | `storekeeper` | Hak Client + Picklist dan input atas nama client        |
| Admin       | `admin`       | Seluruh hak, master, rak, saldo awal, koreksi dan audit |

Grant Consumables hanya `{appId:"consumables",role}`. Seluruh pemegang grant membaca ruang stok serta dokumen yang sama, termasuk dokumen pengguna lain. Admin portal mengatur grant; status admin portal dan jabatan tidak otomatis memberi hak operasional. Grant Bag Filter tetap memakai equipment. Tidak ada checkbox, selector, filter, atau pengelolaan lokasi stok.

## Master, stok dan penghitungan awal

Master dipisahkan dari daftar material dikelola. Katalog hasil impor tidak otomatis menjadi inventory dan tidak membawa saldo SAP atau nilai finansial. MMID wajib, unik dan tidak dapat diganti. Nama SAP dipertahankan; nama umum dan maksimal 10 alias (40 karakter per alias) membantu pencarian.

Material mempunyai satuan terkecil R22, satuan SAP, faktor konversi nullable, aturan pecahan, kategori, MRP Type, critical, status, versi dan provenance impor. Satuan R22 dikunci setelah ledger pertama. Snapshot transaksi tidak berubah ketika nama atau faktor diperbarui.

Admin mendaftarkan material langsung ke stok R22. **Rak opsional**, maksimal 100 karakter. Saldo nol pertama berstatus **Belum dihitung**, bukan stok habis. Admin mengonfirmasi saldo fisik sekali, termasuk nol, dengan alasan. Sesudah itu Consume/Return dan Picklist dapat digunakan. Koreksi memasukkan jumlah fisik target, alasan dan versi saldo; versi kedaluwarsa menghasilkan 409. Tidak ada edit, pembatalan, hard delete atau saldo negatif. Penonaktifan master/inventory dengan saldo positif ditolak.

## Dokumen operasional

**Consume Order:** 1–50 material unik, jumlah positif dalam satuan R22, HEC wajib, WO dan catatan opsional. Identitas peminta self-service berasal dari sesi. Cashier/Admin dapat mencatat atas nama client dengan nama wajib dan NIK opsional. Saldo terkunci diperiksa lagi saat finalisasi; seluruh kekurangan dilaporkan per baris dan tidak ada perubahan parsial.

**Return Order:** alur keranjang yang sama, menambah stok. HEC wajib; nomor Consume Order asal opsional. Tidak membutuhkan approval atau pencocokan otomatis dengan dokumen asal.

**Penerimaan Picklist:** 1–100 material unik dari katalog, nomor reservasi dan WO wajib. Deskripsi WO, Equipment No., Functional Location SAP, Cost Center dan Required Date opsional. Satu baris memakai jumlah SAP dan versi master yang dikonfirmasi, atau jumlah R22 langsung. Server menghitung konversi tepat dan menolak konfigurasi kedaluwarsa. Reservasi berulang memberi peringatan, bukan penolakan: penerimaan parsial diperbolehkan.

K3: material yang belum terdaftar otomatis didaftarkan tanpa rak, dengan ledger opening nol terkonfirmasi lalu receipt, dalam transaksi Picklist yang sama. Inventory existing yang belum dihitung/nonaktif ditolak; sistem tidak menebak saldo aktual.

HEC tujuan pekerjaan **berbeda dari lokasi stok yang telah dihapus**. Consume/Return tetap mewajibkan format `XXX-XXX`, misalnya `452-BU1`; trim, kapitalisasi dan penghapusan prefiks `TQ.` dilakukan konsisten. Saran berasal dari dokumen sebelumnya, maksimal 8 hasil. Functional Location SAP pada Picklist tetap teks opsional.

## Presisi, atomisitas dan idempotensi

Kuantitas memakai `DECIMAL(18,6)` dan string JSON. Aritmetika fixed-point bigint; input berlebih presisi/kapasitas ditolak tanpa pembulatan. UI menerima koma desimal. Satuan hitung (`COUNT_UNITS` pada kontrak) menolak pecahan kecuali diaktifkan secara eksplisit oleh admin.

Setiap dokumen mengunci ruang internal, master menurut ID, inventory, idempotensi dan sekuens; menyimpan header, seluruh ledger, saldo, nomor dokumen, audit dan hasil retry secara atomik. Actor dan waktu berasal dari server. Timestamp UTC ditampilkan WIB. Nomor `R22-CO/RO/PL-YYYY-NNNNNN` menggunakan tahun WIB dan sekuens per jenis/tahun.

Header `Idempotency-Key` wajib (8–128 karakter `[A-Za-z0-9._:-]`). Key unik per actor. Payload kanonis sama mengembalikan hasil lama; payload berbeda 409. Izin diperiksa sebelum replay. Retry bersamaan tidak menduplikasi ledger. Timeout mempertahankan key; sukses POST langsung menjadi bukti tersimpan tanpa bergantung pada refresh dashboard.

## UI

Menu: Ringkasan, Cari material, Consume Order, Return Order, Penerimaan Picklist, Riwayat, Pengelolaan, Audit. Pengelolaan mempunyai **Master material** dan **Stok, rak & saldo awal**. Detail material berisi satu `stock` nullable. Tidak ada input atau kolom lokasi stok pada layar maupun cetak.

Pencarian adaptif MMID/nama/alias/SAP, modal jumlah, keranjang persisten per pengguna dan jenis order, lalu konfirmasi finalisasi. Draft per lokasi versi lama diabaikan; tidak digabung otomatis. Logout membersihkan draft. Tema, keyboard, klik luar, focus dan desain mengikuti `@plant/ui` serta Bag Filter. Mobile memakai form satu kolom dan kartu stok.

KPI **Material dikelola** menghitung inventory, bukan seluruh katalog. Stok nol dibedakan dari belum dihitung. Grafik Q1–Q4 menghitung dokumen per jenis serta opening/koreksi mandiri, dengan tahun WIB. Ledger receipt/issue lama tidak dihitung kembali sebagai dokumen. Riwayat mempunyai tab Dokumen dan Pergerakan stok, pagination server default 50. Bukti bernomor dapat dicetak A4 tanpa shell aplikasi.

## Database dan upgrade

Database `plant_consumables`: materials, locations (internal), inventory, stock_movements, stock_documents, stock_document_sequences, stock_idempotency, consumables_audit dan catalog_imports. Tidak ada FK lintas database. Satu ruang internal `R22` ber-ID tetap dibuat migrasi; pengguna tidak mengelolanya.

`0002_*` menambahkan dokumen dan metadata secara aditif. Faktor pack legacy tetap ada, tetapi ditandai belum ditinjau agar makna pack lama tidak otomatis dianggap konversi SAP. `0003_r22_single_room.sql` menambahkan ruang internal tanpa menghapus master/ledger/audit/idempotensi. Preflight read-only memeriksa inventory/ledger/dokumen noncanonical dan konflik ruang tujuan. Jika ada data yang perlu digabungkan, upgrade berhenti; tidak menjumlahkan, memindahkan, atau menghapus otomatis. Instalasi kosong, master-only dan rerun didukung. Scope Consumables lama dibersihkan sekali, mempertahankan role, status aplikasi dan grant Bag Filter.

Panduan rilis, CLI penamaan, backup dan rollback: [operasi R22](deployment/R22-UPGRADE.md). Pengujian aktual: [VALIDATION](VALIDATION.md). Audit ekspor v1 tetap catatan historis.

## Batas rilis dan asumsi

Belum mencakup approval, reservasi stok, transfer khusus, stock opname bersesi, barcode/QR (opsional fase 6), pengadaan, valuasi, integrasi SAP otomatis atau pengurangan stok dari Bag Filter. Asumsi brief A1–A5 dipertahankan: self-service tanpa approval/jam terbatas, nama peminta untuk kanal cashier, dan dokumen langsung final. Format HEC, kewajiban WO Picklist, nomor dokumen dan `COUNT_UNITS` masih dapat disesuaikan lewat revisi kebutuhan; implementasi saat ini mengikuti aturan di atas.
