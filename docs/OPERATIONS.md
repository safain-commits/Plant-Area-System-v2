# Operasional pilot

## Topologi dan rahasia

Nginx berada pada jaringan gateway dan private. Auth, Portal, Bag Filter, MySQL, dan backup berada pada private network. Hanya80/443 Nginx dipublikasikan; override pengujian membuka MySQL13306 di loopback. Aplikasi berjalan sebagai user non-root dalam image Node26.12.1. MySQL menyimpan data dalam volume `mysql-data` milik project Compose.

Database `plant_auth` dan `plant_bag_filter` memiliki akun DML terpisah. Kredensial root hanya digunakan job migrasi/backup/restore. Environment URL lokal pada `.env.example` tidak diperlukan dalam container: Compose menyusun URL internal. Password database harus URL-safe24–128 karakter; gunakan random hex. `AUTH_SECRET` dan `SERVICE_TOKEN` harus independen minimal32 karakter. Jangan mencatat password, cookie, header token, atau output konfigurasi Compose yang telah terinterpolasi ke log publik.

Untuk deployment yang lebih besar, pindahkan rahasia ke secret manager, simpan image dalam registry organisasi, dan tetapkan retensi log. Session cookie tidak menggunakan Domain atau cookie cache. Rotasi `AUTH_SECRET` mengakhiri kemampuan memakai cookie lama; rotasi `SERVICE_TOKEN` harus serempak pada Auth, Portal, Bag Filter, dan Nginx.

## Health dan diagnosa

`/gateway-health` publik memberi204. Health aplikasi hanya tersedia pada jaringan internal: `/health/live`, `/health/ready`; tambahkan prefix `/auth` atau `/bag-filter` sesuai layanan. Readiness memeriksa dependency database/Auth. Compose mempunyai healthcheck untuk ketiga aplikasi dan MySQL.

```sh
docker compose ps
docker compose logs --tail=100 auth portal bag-filter nginx backup
docker compose exec nginx nginx -t
```

API failure tak terduga memberi requestId dan log JSON bertipe error tanpa payload/SQL. Audit bisnis tersimpan di database dengan actor dan waktu server. Log Nginx tidak berisi cookie atau body. Batasi akses log karena URI/pencarian dapat memuat informasi pekerjaan.

Jika Auth tidak tersedia, API/halaman terlindungi mengembalikan503. Jangan menonaktifkan guard untuk memulihkan akses. Pulihkan database/Auth, cek readiness, kemudian uji login. Jika IP container berubah setelah recreate, reload/restart Nginx agar upstream di-resolve ulang.

## Backup harian

Sidecar backup membuat dump konsisten dua database dengan `--single-transaction`, mengompres, memverifikasi gzip, lalu rename atomik. File selesai `backups/plant-YYYYMMDDTHHMMSSZ.sql.gz`; file sementara memakai `.tmp`. Retensi lokal14hari. File bersifat rahasia karena memuat hash akun dan sesi.

```sh
docker compose run --rm -e RUN_ONCE=true backup
docker compose logs --tail=10 backup
```

Jadwal adalah setiap86400detik sejak container dimulai. Pantau `backup.complete` dan usia file terbaru; buat alarm bila tidak ada backup sukses dalam26jam. Kegagalan dump membuat container keluar dan restart sesuai kebijakan Compose. Salin backup terenkripsi ke storage organisasi di luar server utama setiap hari; folder lokal saja tidak melindungi kegagalan disk/server.

## Restore

Target: RTO maksimal4jam, RPO maksimal sejak backup harian terakhir. Ukur durasi dengan volume data aktual; uji fixture kecil bukan bukti kapasitas produksi.

1. Pilih backup yang sudah lulus gzip/integritas dan catat checksum serta waktu pencatatannya. Hentikan akses tulis dengan menghentikan gateway dan aplikasi.
2. Pulihkan ke MySQL8.4 kosong/terpisah terlebih dahulu. Jalankan init database/user dengan rahasia deployment tujuan. Hindari menimpa database berjalan sebelum verifikasi selesai.
3. Salin backup ke container tujuan, verifikasi gzip, dan impor melalui pipeline berikut pada **container tujuan**:

```sh
docker cp backups/plant-YYYYMMDDTHHMMSSZ.sql.gz plant-restore:/tmp/restore.sql.gz
docker exec plant-restore bash -c 'set -o pipefail; gzip -t /tmp/restore.sql.gz; gzip -dc /tmp/restore.sql.gz | MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot'
```

4. Bandingkan jumlah users, grants, batch, installations, audit, dan coordinates; periksa beberapa timeline terbaru dan tanggal mundur. Periksa versi migrasi `__drizzle_migrations` pada kedua database.
5. Cabut sesi hasil restore sebelum membuka akses: jalankan `DELETE FROM plant_auth.sessions` pada database hasil pemulihan. Akun/perubahan izin setelah waktu backup harus direkonsiliasi oleh admin.
6. Arahkan aplikasi ke volume/database yang telah diverifikasi, jalankan migrasi hanya jika image tujuan memerlukannya, mulai Auth lalu Portal/Bag Filter lalu Nginx. Uji login, scope, dan satu operasi yang disetujui operator.
7. Simpan bukti durasi pemulihan, waktu backup, jumlah data, image/tag, dan hasil smoke test.

`scripts/test-operations.ts` mengotomatisasi restart, fail-closed Auth, dan restore terpisah untuk project uji. Script tidak menerima target produksi.

## Pembaruan dan rollback

Sebelum rilis, jalankan test/typecheck, build image terpisah, backup, dan review migrasi SQL. `drizzle-kit generate` hanya membuat file; deployment menjalankan migrasi melalui job terpisah. Jangan menjalankan schema push langsung di produksi. Migrasi awal hanya membuat tabel/index/FK dan seed referensi, tanpa data transaksi.

Catat image digest ketiga aplikasi sebelum perubahan. Untuk memperbarui Bag Filter saja, build/tag image Bag Filter dan `docker compose up -d --no-deps bag-filter`, lalu restart Nginx agar upstream baru di-resolve. Auth/Portal memiliki prosedur setara. `RELEASE_TAG` dapat dipakai build rilis lengkap; ketika rilis layanan berbeda, pin image per layanan dalam override Compose dan simpan override tersebut bersama catatan deployment.

Rollback aplikasi: kembalikan image layanan ke digest sebelumnya, mulai ulang layanan serta Nginx, lalu jalankan smoke test. Jangan otomatis menghapus kolom/tabel atau memutar balik migrasi. Migrasi berikutnya harus memakai pola tambah dahulu, perpindahan penggunaan, lalu penghapusan pada rilis terpisah. Restore database hanya dipilih bila rollback image tidak cukup dan kehilangan data sejak backup telah dipertimbangkan.
