# Handover OpenClaw — update R22 dari GitHub

Gunakan pada deployment existing `https://tq-cmms.com`. Full SHA diberikan pemilik pada pesan pengantar. Semua keputusan di bawah berlaku untuk **commit itu**, dengan CI GitHub yang lulus. Status pengujian lokal ada di [VALIDATION](../VALIDATION.md); hasil lokal tidak menggantikan CI atau pemeriksaan VPS.

Acuan: [upgrade R22](R22-UPGRADE.md), [development sampai VPS](DEVELOPMENT-TO-VPS.md), dan [runbook VPS](VPS-TQ-CMMS.md). Instruksi R22 ini mengatur urutan khusus rilis yang membawa migrasi database. Pemilik menyalin prompt di bawah bersama SHA rilis; jangan memilih HEAD branch yang berubah saat proses berlangsung.

## Cakupan dan perubahan data yang diharapkan

| Bagian                     | Dampak rilis                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image                      | Build `migrate`/tools, Auth, Portal, Bag Filter dan Consumables dari SHA yang sama; runtime lama disimpan untuk rollback                                      |
| `0002_high_shaman.sql`     | Tabel dokumen/sekuens, relasi idempotensi/ledger, metadata satuan SAP, alias, aturan pecahan dan status peninjauan konversi                                   |
| Backfill `0002`            | `sap_unit=unit`, alias kosong, aturan pecahan menurut `COUNT_UNITS`; pack legacy tetap tersimpan dan ditandai belum ditinjau bila non-null                    |
| `0003_r22_single_room.sql` | Satu ruang internal R22; seluruh master/ledger/audit/idempotensi tetap dipertahankan                                                                          |
| Auth checkpoint            | `consumables-r22-single-room` menghapus scope lokasi Consumables yang sudah usang; role dan grant equipment Bag Filter tetap                                  |
| UI/API                     | Dokumen Consume/Return/Picklist, HEC wajib Consume/Return, rak opsional, stok tunggal, grant role-only, navigasi/tree sidebar                                 |
| Environment                | Tidak membutuhkan rahasia baru; `CONSUMABLES_INTERNAL_URL` sudah tidak digunakan. Pertahankan rahasia, certificate, pin MySQL dan konfigurasi privat existing |

Kondisi produksi yang terakhir dikonfirmasi: Consumables baru memiliki master. **Periksa kembali keadaan aktual.** Inventory atau transaksi pada ruang noncanonical menghentikan preflight. Tidak ada jalur penggabungan/penghapusan otomatis. Tabel lokasi lama tetap ada untuk kompatibilitas; UI/API pengelolaannya dihentikan.

## Prompt siap salin

```text
Perbarui TQ-CMMS yang sudah live di https://tq-cmms.com ke full commit SHA
yang saya berikan pada pesan pengantar. Repo:
https://github.com/safain-commits/Plant-Area-System-v2.git

Baca docs/deployment/OPENCLAW-R22-UPDATE.md, R22-UPGRADE.md,
DEVELOPMENT-TO-VPS.md dan VPS-TQ-CMMS.md pada SHA target tersebut.
Lanjutkan dari keadaan deployment aktual dan checkpoint yang sudah ada.
Jangan mengulang instalasi, bootstrap, impor master atau restore awal laptop.

1. INVENTARISASI DAN KUNCI RILIS
   Identifikasi deployment aktif, biasanya /opt/tq-cmms dengan project tq-cmms.
   Catat SHA/tag/image digest lama, semua override Compose dan pin MySQL,
   volume database, jaringan, certificate/trust, baseline website lama,
   kapasitas disk/RAM serta backup/offsite terakhir. Simpan bukti privat.
   Pertahankan Nginx host dan website lain; port project tetap loopback.

   Periksa working tree VPS. Jika ada perubahan source lokal, berhenti untuk
   review; jangan reset --hard, clean, menimpa file, atau auto-stash.
   Fetch origin dan verifikasi SHA target tersedia serta berada pada main.
   Verifikasi workflow Platform checks / validate lulus untuk SHA persis itu.
   CI pending/gagal/tidak dapat diverifikasi: persiapan read-only boleh lanjut,
   tetapi jangan mengubah schema/layanan produksi atau membuka rilis.
   Checkout detached SHA target secara terkontrol. Jangan memakai git pull
   tanpa pin SHA atau berpindah ke commit baru di tengah checkpoint.

2. SIAPKAN IMAGE DAN PREFLIGHT
   Pakai konfigurasi deployment existing dan fungsi dc produksi yang benar,
   termasuk infra/deploy/compose.vps.yaml dan override pin MySQL bila tersedia.
   Verifikasi dc config --quiet, project, volume dan binding. Jangan mencetak
   config terinterpolasi atau rahasia. Simpan .env/override lama secara privat;
   ubah hanya RELEASE_TAG untuk lima image baru. Jangan rotasi password/token.

   Build lima image secara serial sebelum maintenance bila kapasitas cukup.
   Pastikan layanan lama tetap memakai image running sebelumnya; jangan up
   seluruh Compose atau menyalakan migrator melalui dependency secara implisit.
   Jalankan preflight read-only memakai image tools target:
       dc run --rm --no-deps migrate consumables:preflight
   Jika blocked, laporkan jumlah inventory/ledger/dokumen noncanonical atau
   konflik R22; hentikan upgrade tanpa menggabungkan, menghapus atau memindah
   data dan tanpa mengedit jurnal/schema untuk memaksakan keberhasilan.

3. BACKUP DAN REHEARSAL DENGAN DATA VPS
   Buat backup tiga database VPS terkini dan konfigurasi privat, verifikasi
   gzip/checksum. Enkripsi dan unggah ke OneDrive backup-vps memakai mekanisme
   existing yang telah disetujui. Verifikasi unduh/checksum ciphertext.
   Private recovery key tetap milik pemilik; jangan meminta/menyimpannya di VPS.

   Restore backup tersebut ke MySQL drill terpisah, memakai versi/image MySQL
   yang sama, volume/network/nama unik dan tanpa port publik. Buktikan semua
   URL runtime/migrasi drill menunjuk instance drill, tidak ke produksi.
   Dengan kode target yang sama, cocokkan fingerprint raw restore terhadap
   backup sebelum migrasi. Lalu uji preflight, migrator target, rerun migrator
   dan rekonsiliasi pada drill. Snapshot mencakup seluruh tabel, termasuk
   stock_documents, stock_document_sequences dan stock_idempotency jika ada.
   Setelah perubahan schema, bandingkan data lama pada kolom lama dan catat
   perubahan metadata/tabel/checkpoint yang memang diharapkan oleh rilis.
   Jika rehearsal gagal atau resource belum cukup, berhenti dan laporkan.
   Jangan mengganti drill dengan tes/reset pada database produksi.

4. MAINTENANCE, BACKUP FINAL DAN MIGRASI
   Setelah checkpoint sebelumnya lulus, aktifkan maintenance khusus tq-cmms
   melalui mekanisme existing. Hentikan penulis project, termasuk keempat app,
   gateway project dan backup terjadwal yang dapat bertabrakan. Nginx host,
   website lain, MySQL dan volume produksi tetap dipertahankan.

   Buat backup FINAL VPS saat penulis sudah berhenti. Catat SHA, waktu, checksum,
   jumlah/hash data lama, jurnal dan lokasi backup; verifikasi offsite sesuai
   prosedur existing. Ulangi preflight sebelum menjalankan SATU job migrator:
       dc run --rm --no-deps migrate consumables:preflight
       dc run --rm --no-deps migrate db:migrate
       dc run --rm --no-deps migrate consumables:reconcile

   Jangan menjalankan bootstrap, seed demo, impor naming/master, penggantian
   database, down -v, prune volume, drizzle-kit push, atau menonaktifkan FK.
   Jangan menghapus sesi atau mereset password pengguna sebagai bagian update.
   MySQL DDL dapat ter-commit sebagian. Jika migrasi error: pertahankan
   maintenance, simpan status jurnal/tabel/log tersanitasi dan berhenti.
   Jangan mengulang migrasi dalam loop atau menandai migrasi selesai manual.

5. VERIFIKASI DATA DAN MULAI RUNTIME
   Pastikan ID/jumlah/nilai kolom lama master, ledger, audit dan idempotensi
   dipertahankan; akun dan hash password tetap. Periksa perubahan yang memang
   diharapkan pada metadata baru, ruang R22, checkpoint dan scope Consumables.
   Role/status aplikasi/grant Bag Filter tidak berubah. Data Bag Filter dan
   seluruh history equipment cocok dengan baseline. Rekonsiliasi harus kosong.

   Start Auth dahulu, kemudian Portal, Bag Filter, Consumables dan gateway
   secara terkontrol dengan --no-deps; tunggu readiness tiap layanan.
   Jangan menjalankan migrator/bootstrap lagi melalui up dependency.
   Jalankan QA backend/HTTPS loopback dengan TLS trust yang benar. Periksa
   prefix, aset, JSON API, endpoint internal tertutup, metadata lokasi 404,
   lokasi lama 410, grant role-only dan penolakan field lokasi.

6. QA PUBLIK DAN PENERIMAAN PEMILIK
   Setelah backend/data lulus, buka maintenance untuk QA publik dan pantau 5xx.
   Pemilik login sendiri dengan akun existing: SSO, role, data, logout,
   sidebar mobile/tree submenu, light/dark, serta halaman R22 dan Bag Filter.
   Uji tulis empat role/Consume/Return/Picklist dilakukan pada drill; jangan
   membuat akun atau transaksi sintetis di produksi. Transaksi produksi nyata
   hanya dilakukan sesuai kebutuhan dan instruksi pemilik.
   Verifikasi website lama, aktifkan kembali backup/jadwal monitoring existing,
   dan periksa backup setelah rilis. Jangan menyatakan LIVE_ACCEPTED sebelum
   penerimaan pemilik dan seluruh checkpoint wajib lengkap.

7. BILA GAGAL DAN LAPORAN AKHIR
   Aktifkan/pertahankan maintenance bila backend, data atau QA publik gagal.
   Rollback image hanya jika kompatibilitas schema/data sudah dibuktikan.
   Scope role-only dan stok tunggal mengubah semantik akses: jangan menyalakan
   Consumables versi per lokasi setelah R22 dipakai tanpa kajian kompatibilitas.
   Utamakan perbaikan maju atau restore ke target terpisah yang direview,
   mempertahankan transaksi sesudah backup. Jangan down migration otomatis
   atau menimpa database existing dengan backup lama.

   Laporkan tiap checkpoint PASSED/PENDING/BLOCKED, URL CI, full SHA aktif,
   image/version, file backup dan checksum, offsite, drill, durasi maintenance,
   hasil verifikasi data/QA, risiko/pekerjaan pending dan opsi pemulihan.
   Jangan mencetak password, token, cookie, private key, dump atau katalog.
   Lanjutkan pekerjaan rutin dalam mandat ini tanpa konfirmasi berulang;
   minta keputusan hanya jika akses/informasi penting belum tersedia atau
   preflight/keadaan aktual menunjukkan konflik yang memerlukan keputusan.
```

## Catatan pemeriksaan hash dan rollback

Fingerprint raw restore harus identik **sebelum migrasi**, memakai kode/migration files yang sama pada capture dan compare. Hash `SELECT *` tidak diharapkan tetap sama setelah penambahan kolom, tabel, backfill metadata dan checkpoint. Setelah migrasi, periksa proyeksi kolom lama serta perubahan yang diharapkan secara terpisah; jangan mengabaikan selisih yang tidak dijelaskan.

Paket dump laptop awal bukan sumber pemulihan update ini. Data VPS tetap otoritatif. Backup final sebelum migrasi menjadi titik pemulihan rilis, sedangkan pencatatan yang terjadi sesudah pembukaan layanan harus tetap dipertahankan jika kelak memerlukan pemulihan.
