# Handover OpenClaw — database lokal ke VPS

Gunakan untuk memindahkan data perusahaan dari Docker lokal ke VPS `tq-cmms.com`. Ini menggantikan jalur **database kosong → bootstrap → impor master** ketika paket database lokal digunakan. Baca [panduan lengkap](DATABASE-LOCAL-TO-VPS.md) dan [topologi VPS](VPS-TQ-CMMS.md).

## Prompt siap salin

```text
Lanjutkan penyiapan Plant Area System v2 pada VPS ini dan pulihkan database
aktual dari Docker lokal pemilik. Target publik https://tq-cmms.com.
Repository: https://github.com/safain-commits/Plant-Area-System-v2.git
Directory / Compose project: /opt/tq-cmms / tq-cmms.

Baca dokumen berikut dari release repository:
1. docs/deployment/DATABASE-LOCAL-TO-VPS.md
2. docs/deployment/OPENCLAW-DATABASE-HANDOVER.md
3. docs/deployment/VPS-TQ-CMMS.md

Mulai dengan inventarisasi read-only: status instalasi existing, volume,
layanan/port, Nginx host, kapasitas, commit, konfigurasi dan keberadaan paket.
Pemilik terakhir mengonfirmasi project belum dipasang di VPS; verifikasi ulang.
VPS memiliki Nginx host untuk website lain. Pertahankan port publik 80/443
pada Nginx host; gateway Docker project hanya 127.0.0.1:18080/18443.
Jangan mengganggu website lain atau proses OpenClaw.

Paket dari pemilik berada di direktori privat tq-cmms-transfer-incoming pada
home akun penerima SSH, kecuali pemilik memberikan path absolut lain.
Konfirmasi path yang benar, bukan mengarang paket. Isi paket:
database.sql.gz, database.sql.gz.json, source.json, RELEASE.txt,
mysql-image.txt dan SHA256SUMS.

Jika paket belum ada, selesaikan preflight/build/staging yang independen,
lalu laporkan WAITING_TRANSFER_PACKAGE beserta path penerima dan input yang
diperlukan. Jangan membuat master/transaksi demo atau mengklaim migrasi selesai.
Jika dokumen/script baru belum ada di GitHub, minta release/bundle yang benar;
jangan merekonstruksi prosedur dari screenshot.

Gunakan full SHA dari RELEASE.txt dan image MySQL resmi yang dipin berdasarkan
digest paket. Verifikasi checksum/gzip dan identitas paket sebelum impor.
Simpan rahasia VPS yang independen; PUBLIC_ORIGIN=https://tq-cmms.com.
Jangan menyalin .env laptop, private key lokal, atau schema sistem mysql.

Database yang dipindahkan:
- plant_auth: semua akun/hash password, aplikasi, grant/scope, audit/checkpoint.
- plant_bag_filter: seluruh katalog/koordinat, batch, pemasangan, actor, brand,
  UTC timestamp, audit, idempotensi, checkpoint dan histori migrasi.
- plant_consumables: master, lokasi, inventory/saldo, ledger, audit,
  idempotensi, impor dan histori migrasi.
source.json adalah acuan jumlah/fingerprint, bukan angka lama di dokumentasi.

Pastikan pemilik telah membekukan pencatatan lokal dan memilih paket final.
Jangan mulai cutover dengan backup rehearsal yang sumbernya masih ditulis.
Pada VPS aktifkan maintenance hanya untuk domain ini dan hentikan aplikasi
project selama restore. Target wajib kosong; jangan overwrite target yang
sudah bootstrap/seed atau menerima data. Jika ada data, backup dan laporkan
DATABASE_TARGET_NOT_EMPTY, lalu minta keputusan merge/target baru/cutover.
Jangan menghapus tabel/volume untuk meloloskan guard kosong.

Restore tiga database sebelum migrator/bootstrap. Bandingkan fingerprint
seluruh tabel persis dengan source.json memakai scripts/database-snapshot.ts.
Setelah cocok, jalankan migrator release yang sama, rekonsiliasi Consumables,
dan bandingkan lagi. Jangan bootstrap admin, import ulang Excel/master,
reset fixtures, atau menimpa data lama. Jika restore gagal, target bisa parsial;
biarkan aplikasi berhenti dan jangan menyatakan rollback otomatis.

Cabut sessions, verifications dan login_attempts hanya pada Auth di VPS,
lalu verifikasi --after-session-revoke. Akun/password/grant dan seluruh audit
serta data bisnis harus tetap persis. Akun existing digunakan untuk login;
BOOTSTRAP_PASSWORD tidak dipakai pada jalur restore ini.

Mulai Auth, lalu Portal/Bag Filter/Consumables, kemudian gateway/backup.
Periksa runtime credentials, readiness, Real-IP trust, TLS backend yang
terverifikasi, routing/deep link/aset/API serta website lama. Jangan
menonaktifkan SSO, scope, TLS verification, atau memberi role tambahan agar
tes lolos. Tidak menjalankan test:e2e, reset-test-data, prepare-test,
test-operations atau gateway-recovery pada data nyata.

Jika DNS/certificate belum siap, selesaikan staging dan laporkan
STAGED_WAITING_DNS. PUBLIC_ORIGIN tetap domain final. Sebelum menyatakan live,
uji HTTPS dari luar dan minta pemilik menguji login akun existing, SSO,
grant/scope serta data. Jangan meminta password pemilik untuk laporan.
Transaksi pengujian palsu tidak boleh dimasukkan ke database produksi.

Sumber lokal harus tetap berhenti ketika VPS mulai menerima pencatatan.
Jika VPS sudah menerima transaksi baru, jangan rollback dengan menyalakan
salinan laptop lama; bekukan dan backup VPS dahulu, lalu rekonsiliasi.

Buat backup pascamigrasi, salinan terenkripsi di luar VPS dan restore drill
di database terpisah. Catat hasil aktual, durasi, retensi serta monitoring.
Jangan menghapus volume sumber/target lama, down -v, prune global, atau
mengunggah database/.env/password/token/private key ke Git/chat/log publik.

Kerjakan langkah yang sudah tercakup mandat ini tanpa meminta konfirmasi
berulang. Tanyakan hanya informasi yang belum ada atau keputusan konflik
data/layanan yang benar-benar diperlukan. Simpan checkpoint agar resume tidak
mengulang restore/seed setelah target mulai dipakai.

Simpan laporan privat di /opt/tq-cmms/.deploy/DATABASE-MIGRATION-RESULT.md.
Laporkan status data dan status publikasi secara terpisah, full SHA/digest,
fingerprint/checksum, hasil rekonsiliasi, sesi dicabut, SSO/login existing,
website lama, lokasi backup/offsite, restore drill, waktu cutover WIB/UTC,
penanggung jawab, pekerjaan tertunda, serta langkah resume/rollback.
Jangan mengisi lulus untuk pemeriksaan yang belum dijalankan.
```

## Informasi pemilik melalui kanal privat

| Informasi                   | Keterangan                                                          |
| --------------------------- | ------------------------------------------------------------------- |
| Path paket absolut pada VPS | Akun penerima SSH dan lokasi file; jangan mengasumsikan `/root`     |
| Paket final atau rehearsal  | Paket final dibuat setelah seluruh penulis lokal berhenti           |
| Full SHA dan checksum dump  | Cocokkan dengan `RELEASE.txt`/receipt dan kanal transfer pemilik    |
| Keadaan database VPS        | Belum dipasang, hanya seed/bootstrap, atau sudah menerima transaksi |
| Waktu pembekuan/cutover     | WIB dan UTC; tidak ada pencatatan ganda lokal/VPS                   |
| SSH/sudo dan domain         | Gunakan akses yang telah diberikan; DNS/ACME dapat masih pending    |
| Penerimaan akun existing    | Pemilik login sendiri; tidak perlu membagikan password dalam chat   |
| Offsite/pemegang kunci      | Tujuan privat, recipient enkripsi dan pemegang recovery key         |

## Checkpoint dan bukti

| ID    | Bukti wajib                                                                             |
| ----- | --------------------------------------------------------------------------------------- |
| M0    | Release/script tersedia, state sumber/target diketahui, baseline website lama           |
| M1    | Kapasitas, build serial, rahasia/TLS/loopback benar; bootstrap belum dijalankan         |
| M2    | Pemilik menyatakan penulisan lokal dibekukan; tidak ada importer/migrator aktif         |
| M3–M4 | Paket lengkap, SHA/image/checksum/gzip benar, sumber sebelum/sesudah dump identik       |
| M5    | Target kosong; raw restore selesai; semua fingerprint persis                            |
| M6    | Migrator exit 0, rekonsiliasi nol selisih; pengecualian hanya tiga tabel sesi sementara |
| M7    | Login existing/SSO/scope/data diterima pemilik; TLS publik dan website lama lulus       |
| M8    | Backup pascamigrasi, offsite dan restore drill dibuktikan; sumber tidak dibuka menulis  |

## Format laporan privat

```markdown
Status data: WAITING_TRANSFER_PACKAGE / DATABASE_TARGET_NOT_EMPTY / RESTORE_VERIFIED / SESSIONS_REVOKED / FAILED
Status publikasi: STAGED_WAITING_DNS / PUBLIC_HTTPS_READY / WAITING_OWNER_EXISTING_LOGIN / LIVE_ACCEPTED
Waktu WIB / UTC:
Release full SHA / image aplikasi / MySQL digest:
Target path / Compose project / volume aktual / target kosong dibuktikan:
Paket sumber / checksum / timestamp sumber / sumber masih dibekukan:
Raw restore: exit code dan durasi:
Fingerprint sebelum/sesudah migrator: passed / differences:
Rekonsiliasi Consumables:
Pencabutan sesi: waktu, jumlah tiga tabel sebelum/sesudah; akun/grant/audit tetap:
Equipment/koordinat/batch/pemasangan/master/inventory/ledger sesuai source.json:
Health, TLS/Real-IP, routing/assets/API/internal endpoint:
Pemilik menguji login existing/SSO/scope/data/logout:
Website lain sebelum/sesudah:
Waktu cutover dan VPS sebagai satu-satunya penulis:
Backup pascamigrasi/checksum/offsite/enkripsi/retensi:
Restore drill: target terpisah, hasil, durasi dan cleanup:
Artefak privat/konfigurasi/release sebelumnya untuk rollback:
Checkpoint M0–M8, pekerjaan tertunda dan langkah resume:
```

Tanpa paket final terverifikasi, proses tetap persiapan. Tanpa penerimaan pemilik dan bukti offsite/restore drill, jangan menyatakan seluruh migrasi operasional selesai.
