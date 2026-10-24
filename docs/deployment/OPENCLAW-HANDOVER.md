# Handover OpenClaw — deployment tq-cmms.com

**Tujuan:** clone repository Plant Area System v2 ke VPS pemilik dan selesaikan deployment hingga Portal, Auth, Bag Filter, dan Consumable Room dapat diakses melalui HTTPS publik `https://tq-cmms.com`, dengan website lama tetap berfungsi.

**Kondisi terkonfirmasi pemilik, 24 Oktober 2026:** Ubuntu 24.04 x86_64; 5 vCPU; RAM 8,7 GB, snapshot terpakai 3,7 GB; disk 48,4 GB, snapshot kosong sekitar 22 GB; Nginx sudah berjalan langsung di host pada port 80/443; Docker belum ada; domain masih disiapkan. Ukur ulang saat eksekusi.

Ini adalah instruksi operasional untuk agen di VPS, bukan bukti bahwa deployment sudah berjalan. Perintah harus mengikuti source yang di-clone, hasil preflight, dan [runbook lengkap](VPS-TQ-CMMS.md).

**Untuk membawa data aktual Docker lokal, pakai [prompt database](OPENCLAW-DATABASE-HANDOVER.md) dan [panduan pemindahan](DATABASE-LOCAL-TO-VPS.md).** Jalur restore menggantikan C5 dan C10 di bawah: restore sebelum migrator, tanpa bootstrap, login memakai akun existing setelah sesi lama dicabut. Angka awal kosong pada handover instalasi baru tidak berlaku untuk database hasil restore.

## Pesan siap salin untuk OpenClaw

```text
Deploy repository https://github.com/safain-commits/Plant-Area-System-v2.git
ke VPS ini untuk domain https://tq-cmms.com.

Baca lebih dahulu docs/deployment/OPENCLAW-HANDOVER.md dan
docs/deployment/VPS-TQ-CMMS.md dari source repository. Ikuti seluruh checkpoint,
catat commit yang dipakai, dan jalankan langkah yang sudah dapat dikerjakan
tanpa menunggu kesiapan DNS. File handover di repository adalah sumber mandat
teknis; README quick start bukan topologi VPS ini.

Jika pemilik membawa paket database lokal, gunakan
docs/deployment/OPENCLAW-DATABASE-HANDOVER.md dan DATABASE-LOCAL-TO-VPS.md
sebagai pengganti langkah pengisian database kosong: restore sebelum migrator,
tanpa bootstrap/impor master ulang, dan login memakai akun existing.

VPS sudah mempunyai Nginx host untuk website lain dan belum mempunyai Docker.
Pertahankan Nginx host pada port publik80/443. Gunakan Compose project tq-cmms
di /opt/tq-cmms dengan compose.yaml + infra/deploy/compose.vps.yaml.
Gateway Docker hanya boleh dipublikasikan ke loopback18080/18443.
Sertifikat publik berada pada Nginx host; gunakan webroot ACME tanpa
menghentikan Nginx. Koneksi ke gateway memakai HTTPS dengan verifikasi trust.

Jangan menghapus data/volume atau mengubah website lain. Jangan mengunggah
.env, private key, katalog internal, backup, atau password ke Git/chat/log.
Jangan menonaktifkan guard SSO, verifikasi TLS, atau scope agar smoke test lolos.

Lanjutkan pekerjaan rutin yang sudah tercakup mandat ini tanpa meminta
konfirmasi berulang. Minta hanya informasi/akses yang benar-benar belum ada,
atau keputusan jika hasil preflight menunjukkan konflik layanan/data.
Jika DNS belum siap, selesaikan staging dan laporkan record DNS yang diperlukan
beserta checkpoint untuk melanjutkan. Jangan mengklaim aplikasi live sebelum
HTTPS dari jaringan luar, routing/API, login/SSO, dan pemeriksaan website lama
benar-benar diverifikasi. Laporkan backup/offsite/restore secara terpisah.

Setelah deployment, berikan laporan tersanitasi dengan status tiap checkpoint,
SHA/image/version, lokasi file, hasil pengujian, pekerjaan tertunda, serta
instruksi login admin melalui kanal privat. Pemilik akan mengganti password
bootstrap pada login pertama; jangan mengubah password pemilik diam-diam.
```

Jika dokumen ini belum tersedia pada branch yang di-clone, pemilik harus memublikasikan commit dokumentasi terlebih dahulu atau mengirim bundle dokumen/config pendamping. Jangan mencoba merekonstruksi topologi dari screenshot.

## Data masuk dan secret handling

Sebelum tahap terkait, kumpulkan:

| Data                  | Cara memperoleh / keputusan                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| IPv4 VPS              | Konfirmasi dengan panel/provider dan interface server; jangan mengarang IP                              |
| IPv6                  | Pakai AAAA hanya jika routing/akses80/443 benar; record A saja cukup untuk rilis awal                   |
| Akses sudo/SSH        | Gunakan sesi/credential yang telah diberikan; simpan port SSH dan recovery access                       |
| Akun deployment       | Pakai akun operasional yang disepakati, bukan mengganti kepemilikan seluruh `/opt`                      |
| Email/nama admin      | Tanyakan jika belum diberikan; password digenerate di VPS, tidak diminta di chat                        |
| Email ACME            | Alamat yang benar-benar dipantau pemilik                                                                |
| DNS                   | Pemilik dapat memasang A/AAAA/CAA, atau memberikan akses terbatasi; jangan mengubah record layanan lain |
| Backup offsite        | Tujuan, SSH/storage credential privat, public encryption recipient, pemegang recovery key               |
| Katalog Consumables   | File JSON privat opsional setelah publikasi aplikasi; tidak tersedia dari GitHub                        |
| Baseline website lama | Daftar vhost/domain dan pemeriksaan publik sebelum/sesudah perubahan                                    |

Bila email/DNS/tujuan backup belum tersedia, jangan menghentikan inventarisasi dan pekerjaan independen. Jangan membuat akun/email palsu atau memakai master/transaksi demo. Bila DNS belum siap, tidak ada sertifikat publik atau klaim akses publik yang dapat diselesaikan secara sah.

Jangan mencetak `docker compose config` yang sudah terinterpolasi, `.env`, output credential helper, header cookie/token, private key, atau isi katalog. Gunakan `config --quiet`, status/checksum/counts, serta log terbatas yang sudah ditinjau. `.deploy/`, `.env`, certificate private key, dan `backups/` tetap privat. Jangan merekam token DNS/SSH pada command line atau shell history.

## Ruang lingkup yang sudah diotorisasi

- Inventarisasi read-only host, layanan, firewall, dan source.
- Memasang Docker Engine/Compose resmi bila tidak bentrok dengan komponen yang sedang dipakai.
- Membuat direktori, environment rahasia, backend certificate, image, serta database baru khusus project.
- Menambah satu vhost Nginx host khusus `tq-cmms.com`, menguji konfigurasi, dan melakukan reload graceful.
- Memperoleh/merawat certificate domain ini melalui mekanisme ACME yang disepakati, saat DNS/akses tersedia.
- Bootstrap admin pada database baru, menyiapkan grant yang memang dibuat script, backup, monitoring, dan restore drill terpisah.
- Menguji routing/akses dan memperbaiki konfigurasi project dalam mandat ini; simpan perubahan deployment lokal serta jelaskan jika perlu perubahan source.

**Batas:** tidak menghapus/mengganti konfigurasi website lain, tidak me-restart host Nginx untuk ACME, tidak reboot/reset firewall/SSH, tidak mengganti provider nameserver/MX, tidak mereset akun/data, tidak membuka port database/Next publik, tidak menjalankan tes/reset produksi, tidak `down -v`/prune volume global. Jika konflik membutuhkan tindakan di luar mandat tersebut, jelaskan konflik konkret dan minta keputusan pemilik.

## Checkpoint eksekusi

Jalankan per batch Bash dengan penghentian saat error (`set -euo pipefail` pada script batch yang sesuai). Jangan menempel seluruh runbook sekaligus. Setelah error, periksa status aktual dan pulihkan hanya komponen project yang relevan. Tidak ada perintah reset sebagai fallback otomatis.

| ID  | Pekerjaan                                                                | Bukti keluar                                                                            |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| C0  | Preflight kapasitas, sudo, port, Nginx, layanan lama; backup konfigurasi | Disk/RAM cukup, baseline tersimpan privat, port18080/18443 kosong, Nginx valid          |
| C1  | Docker Engine dan Compose; smoke test website lama lagi                  | Engine≥28, Compose≥2.24.4, hello-world, website lama tetap sehat                        |
| C2  | Clone `/opt/tq-cmms`, catat release/CI; `.env` baru tanpa overwrite      | SHA diketahui, working tree dipahami, projectname tetap, rahasia tidak dicetak          |
| C3  | Override resource/log/loopback, backend TLS, placeholder Real-IP         | `dc config --quiet` valid, file certificate/trust ada, tidak ada binding publik project |
| C4  | Build kelima image secara serial                                         | Setiap build sukses; image ID/tag tercatat; disk/RAM tetap cukup                        |
| C5  | MySQL → migrasi → bootstrap → Auth → runtime/gateway/backup              | Migrate exit0, layanan healthy/running sesuai jenis; tanpa fixture atau reset           |
| C6  | Real-IP exact peers dan backend smoke test                               | HTTPS18443 tervalidasi certificate, login200/health204, port lokal saja                 |
| C7  | DNS A/AAAA/CAA dan HTTP ACME probe dari luar                             | Record benar, HTTP80 probe200, website lama tetap sehat                                 |
| C8  | Certificate publik, vhost HTTPS, renewal                                 | Certificate dipercaya, host Nginx valid, dry-run renewal dan hook berhasil              |
| C9  | Public HTTP/API/path/assets, akses internal tertutup                     | 308/200/204/303/JSON401/404 sesuai tabel runbook; no TLS bypass                         |
| C10 | Pemilik login/ganti bootstrap; SSO dan role/scope                        | Tiga aplikasi diakses satu sesi, logout bekerja, password bootstrap dihapus dari env    |
| C11 | Backup, offsite, restore drill, monitoring                               | Dump/gzip/checksum, bukti offsite/dekripsi, rekonsiliasi0, timer/alert pemilik jelas    |
| C12 | Periksa website lama dan serahkan laporan                                | Hasil aktual/pekerjaan tertunda, lokasi konfigurasi, release dan prosedur rollback      |

Referensi perintah C0–C12 ada di runbook. Definisikan ulang fungsi `dc` pada shell baru. Jangan memakai `.test-runtime` atau Compose project `plant-v2-test` pada VPS produksi. Jangan menjalankan `pnpm test:e2e`, `scripts/test-operations.ts`, `test-gateway-recovery.ts`, atau reset fixtures terhadap data produksi: script tersebut adalah alat deployment uji yang sengaja mengubah akun/service.

## Kondisi domain belum siap dan cara melanjutkan

Selesaikan C0–C6 sejauh data pemilik tersedia. Catat checkpoint dan gunakan status **STAGED_WAITING_DNS**. Berikan permintaan DNS yang spesifik:

```text
A     @     <IPv4 VPS yang telah diverifikasi>     TTL300
AAAA  @     <IPv6 terverifikasi>                  opsional
CAA         izinkan letsencrypt.org              jika kebijakan CAA membatasi
```

Domain utama hanya `tq-cmms.com`; tidak ada `www` pada certificate awal. Jangan mengubah `PUBLIC_ORIGIN` menjadi IP/localhost untuk melewati kesiapan domain. Resume mulai dari pemeriksaan DNS/probe, bukan mengulang `.env`, key, bootstrap, migrasi awal, atau clone. Sebelum resume, cek perubahan source/layanan existing dan kapasitas ulang.

Jika reverse proxy atau instalasi certificate yang ditemukan berbeda dari asumsi, catat perbedaan dan adaptasi hanya vhost baru dengan menjaga website lain. Jangan memasang ACME client kedua tanpa meninjau client/timer yang sudah ada.

## Penerimaan bisnis dan data

Portal dan login dapat dipublikasikan sebelum impor katalog. Awal Bag Filter: enam equipment dengan 18.784 posisi dan nol pemasangan/penggantian. Awal Consumables: kosong sampai file master privat dan onboarding lokasi tersedia. Tidak perlu mengisi dummy agar kartu statistik berangka.

Pernyataan awal kosong ini hanya untuk instalasi baru tanpa pemindahan data. Jika ada paket database lokal, jangan menerima kondisi kosong sebagai hasil akhir dan jangan mengganti akun hasil restore dengan bootstrap. Ikuti checkpoint M0–M8 pada handover database.

Pemilik memegang password admin akhir. Jangan meminta password baru pemilik untuk laporan atau automation. Gunakan browser pemilik untuk penerimaan SSO, atau akun terpisah yang dibuat pemilik dengan akses sesuai tes jika diperlukan. Pengujian transaksi nyata harus disepakati sebagai data operasional; jangan mencatat/menghapus transaksi palsu di database produksi.

Sebelum membuka data penting untuk operasi, tuntaskan backup di luar VPS dan restore drill. Jika tujuan offsite atau aksi penerimaan pemilik belum tersedia, laporkan kekurangan tersebut secara eksplisit sambil mempertahankan aplikasi yang sudah sehat; jangan mengklaim seluruh penerimaan selesai.

## Format laporan akhir OpenClaw

Simpan versi lengkap privat di `/opt/tq-cmms/.deploy/HANDOVER-RESULT.md`; bagikan ringkasan tersanitasi kepada pemilik:

```markdown
Tanggal/jam: ... WIB
Status: STAGED_WAITING_DNS / PUBLIC_HTTPS_READY / WAITING_OWNER_FIRST_LOGIN / LIVE_ACCEPTED
Commit full SHA / RELEASE_TAG: ...
Versi Docker / Compose / Nginx host / image ID: ...
Directory / Compose project / volume: ...
Domain A / AAAA / CAA yang diperiksa: ...
Bindings: host80/443; project127.0.0.1:18080/18443; database/Next tidak publik
Layanan dan health / migrasi exit code: ...
Certificate publik issuer/expiry / backend expiry: ...
Renewal client/timer/dry-run/hook: ...
Status HTTP/API/internal routes dan prefix aset: ...
Login pertama / SSO / role/scope / logout: siapa menguji, hasil aktual
Real client IP: bukti pemeriksaan tanpa token/cookie
Website lama sebelum/sesudah: ...
Backup terbaru/checksum/ukuran, offsite, encryption recipient fingerprint: ...
Restore drill: target terpisah, jumlah/rekonsiliasi, durasi, cleanup
Monitoring/alert/penanggung jawab: ...
Lokasi konfigurasi dan backup konfigurasi: ...
Release/image sebelumnya dan langkah rollback: ...
Checkpoint C0–C12: PASSED / PENDING / BLOCKED / FAILED, dengan bukti
Pekerjaan tertunda / input yang diperlukan / langkah resume: ...
```

Jangan menaruh password, secret/token, private key, atau isi katalog pada laporan tersebut. Email admin dan lokasi penyimpanan privat boleh diserahkan kepada pemilik; nilai password hanya melalui kanal privat yang disepakati. Hapus file kredensial sementara milik drill sesudah selesai, tetapi pertahankan `.env` produksi dan kunci pemulihan di penyimpanan privat yang benar.
