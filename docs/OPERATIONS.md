# Operasional pilot

## Topologi dan rahasia

Nginx berada pada jaringan gateway dan private. Auth, Portal, Bag Filter, Consumable Room, MySQL, dan backup berada pada private network. Hanya80/443 Nginx dipublikasikan; override pengujian membuka MySQL13306 di loopback. Aplikasi berjalan sebagai user non-root dalam image Node26.12.1. MySQL menyimpan data dalam volume `mysql-data` milik project Compose.

Database `plant_auth`, `plant_bag_filter`, dan `plant_consumables` memiliki akun DML terpisah. Kredensial root hanya digunakan job migrasi/backup/restore. Environment URL lokal pada `.env.example` tidak diperlukan dalam container: Compose menyusun URL internal. Password database harus URL-safe24–128 karakter; gunakan random hex. `AUTH_SECRET` dan `SERVICE_TOKEN` harus independen minimal32 karakter. Jangan mencatat password, cookie, header token, atau output konfigurasi Compose yang telah terinterpolasi ke log publik.

Untuk deployment yang lebih besar, pindahkan rahasia ke secret manager, simpan image dalam registry organisasi, dan tetapkan retensi log. Session cookie tidak menggunakan Domain atau cookie cache. Rotasi `AUTH_SECRET` mengakhiri kemampuan memakai cookie lama; rotasi `SERVICE_TOKEN` harus serempak pada Auth, Portal, Bag Filter, dan Nginx.

## Health dan diagnosa

`/gateway-health` publik memberi204. Health aplikasi hanya tersedia pada jaringan internal: `/health/live`, `/health/ready`; tambahkan prefix `/auth`, `/bag-filter`, atau `/consumables` sesuai layanan. Readiness memeriksa dependency database/Auth. Compose mempunyai healthcheck untuk keempat aplikasi dan MySQL.

```sh
docker compose ps
docker compose logs --tail=100 auth portal bag-filter consumables nginx backup
docker compose exec nginx nginx -t
```

API failure tak terduga memberi requestId dan log JSON bertipe error tanpa payload/SQL. Audit bisnis tersimpan di database dengan actor dan waktu server. Log Nginx tidak berisi cookie atau body. Batasi akses log karena URI/pencarian dapat memuat informasi pekerjaan.

Jika Auth tidak tersedia, API/halaman terlindungi mengembalikan503. Jangan menonaktifkan guard untuk memulihkan akses. Pulihkan database/Auth, cek readiness, kemudian uji login.

Gateway memakai resolver DNS Docker `127.0.0.11` dengan cache 5 detik, upstream `zone`, dan `server ... resolve` pada keempat layanan (memerlukan Nginx OSS minimal 1.27.3; lihat [dokumentasi upstream Nginx](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#resolve)). Perubahan IP sesudah restart/recreate aplikasi diikuti otomatis tanpa restart gateway. Tunggu readiness serta pembaruan DNS sebelum smoke test; saat layanan belum siap, akses dapat sementara gagal. Restart Nginx tetap diperlukan bila template, sertifikat, atau environment gateway diubah, agar template dirender ulang.

Jika dashboard menampilkan kesalahan JSON berawalan `<!DOCTYPE` atau halaman aplikasi memuat aset milik aplikasi lain, periksa routing terlebih dahulu: API seharusnya mengembalikan `application/json`, halaman dan aset seharusnya mengikuti prefix aplikasinya. Healthcheck container saja tidak membuktikan routing gateway benar. Verifikasi sesi/grant melalui Auth; jangan menambahkan role untuk menutupi kesalahan routing.

## Backup harian

Sidecar backup membuat dump konsisten tiga database dengan `--single-transaction`, mengompres, memverifikasi gzip, lalu rename atomik. File selesai `backups/plant-YYYYMMDDTHHMMSSZ.sql.gz`; file sementara memakai `.tmp`. Retensi lokal14hari. File bersifat rahasia karena memuat hash akun dan sesi.

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

`scripts/test-operations.ts` mengotomatisasi restart, fail-closed Auth, dan restore terpisah untuk project uji. Jalankan sesudahnya `node --env-file=.test-runtime/host.env --import tsx scripts/test-gateway-recovery.ts` untuk memaksa kedua IP aplikasi berubah: alamat lama ditempati layanan HTML sentinel, lalu dashboard terautentikasi, halaman SSO, dan aset CSS/JS diperiksa tanpa restart Nginx. Akun verifikasi dan sentinel dibersihkan otomatis. Kedua script hanya menerima deployment uji terisolasi; jangan jalankan bersamaan dengan browser test.

## Pembaruan dan rollback

### Penyempurnaan sidebar dan dashboard Consumables

Penyempurnaan memakai shell serta komponen bersama di empat aplikasi. Build dan perbarui `auth portal bag-filter consumables` bersama pada rilis pertama ini. Tidak ada migrasi schema/data untuk UI. Setelah readiness, uji Portal, ringkasan Consumables, pilihan tahun/kuartal, sidebar sesuai aplikasi/peran, serta halaman Audit Bag Filter. Endpoint, perhitungan stok, dan izin tetap memakai kontrak sebelumnya. Preferensi sidebar/tema browser tetap digunakan.

Tes visual memakai respons dashboard sintetis hanya pada browser pengujian, tanpa memasukkan transaksi sintetis ke database. Akun/lokasi sementara serta fixture transaksi suite Consumables dibersihkan berdasarkan ID milik run. Preview lokal yang lama masih berbagi database dengan riwayat pengujian sebelumnya; pemisahan database/Compose project untuk preview pilot harus dikerjakan terpisah sebelum memasukkan data aktual. Jangan menyaring prefix MMID pada query untuk menghilangkan riwayat fixture. Jangan menjalankan reset terhadap data preview yang telah dipakai pengguna.

### UI refresh v2

Pembaruan ini menambah endpoint ringkasan/pencarian/aktivitas dan metadata waktu kedaluwarsa sesi, tanpa migrasi database. Bangun serta perbarui ketiga image agar komponen bersama dan kontrak sesi konsisten:

```sh
docker compose build auth portal bag-filter
docker compose up -d --no-deps --wait auth portal bag-filter
docker compose restart nginx
```

Periksa login, dashboard sesuai scope, pencatatan, dan logout. Preferensi tema/sidebar tersimpan per browser; riwayat pencarian dan penanda aktivitas dibaca dipisahkan menurut ID pengguna. Dashboard menghitung tanggal pemasangan WIB; notifikasi berdasarkan waktu pencatatan batch, sehingga transaksi bertanggal mundur tetap muncul sebagai aktivitas terbaru. Timer sesi hanya indikator, bukan perpanjangan sesi. Rollback memakai ketiga image sebelumnya; tidak perlu membatalkan migrasi UI.

### Upgrade katalog equipment v2.1

Rilis ini menambah L61/L62 (masing-masing 2.048 posisi), merename 422-BF2 menjadi 422-BF1, dan mengubah sisi 421/422 menjadi A/B. Simpan backup sebelum upgrade dan image lama. Hentikan gateway dan ketiga aplikasi selama migrasi karena versi lama memakai kode/koordinat berbeda.

```sh
docker compose build auth portal bag-filter migrate
docker compose stop nginx portal bag-filter auth
docker compose run --rm -e RUN_ONCE=true backup
docker compose up --no-deps --force-recreate --exit-code-from migrate migrate
docker compose up -d --wait auth portal bag-filter nginx backup
docker compose restart nginx
```

Lanjutkan perintah berikutnya hanya jika migrasi keluar dengan kode 0. Gunakan `up --force-recreate` untuk job migrasi, bukan `start`: `start` dapat menjalankan container lama yang men-seed ulang koordinat lama. Untuk preview lokal, tambahkan `--env-file .test-runtime/stack.env -p plant-v2-test -f compose.yaml -f .test-runtime/compose.yaml` setelah `docker compose`. Jangan gunakan script reset untuk upgrade.

Migrasi SQL `0001_equipment_layout_checkpoint` menambah tabel `data_migrations` pada kedua database. Job menjalankan DML `20261022-equipment-layout-v2` dalam transaksi per database di bawah advisory lock. Checkpoint disimpan hanya saat transaksi berhasil. Jika salah satu database gagal, biarkan aplikasi berhenti, periksa konflik, lalu jalankan ulang job; database yang sudah selesai tidak dimigrasikan ulang. Katalog dan koordinat tetap diverifikasi pada pengulangan.

Konflik 422-BF2 dan 422-BF1 yang sama-sama ada, atau koordinat lama dan baru yang bercampur pada 421/422, menghentikan transaksi Bag Filter. Tinjau backup; jangan menghapus konflik otomatis. Foreign key tetap aktif. ID, actor, waktu, batch dan nomor lokal posisi dipertahankan. Hash idempotensi diperbarui sesuai representasi baru. Audit historis Auth tetap menyimpan snapshot asli; perubahan scope mempunyai audit `equipment.scope_migrated` dengan actor sistem migrasi.

Bootstrap yang dikenali lewat `bootstrap.created` mendapat L61/L62 pada grant Bag Filter yang sudah ada; role serta akses pengguna lain dipertahankan. Jika grant bootstrap sudah dicabut atau catatan bootstrap tidak tersedia, atur akses melalui admin portal. Migrasi ulang tidak menambahkan kembali scope yang sengaja dicabut sesudah upgrade.

Verifikasi enam equipment, 18.784 koordinat, ID/jumlah transaksi lama tetap, dan scope 422-BF1 benar. Periksa sudut peta A/B serta Timur/Barat, stiffener, history, dan retry. Minta pengguna reload browser; URL 422-BF2 menghasilkan 404. Instalasi baru langsung menggunakan enam equipment tanpa transaksi contoh.

Rollback khusus rilis ini memerlukan pasangan backup sebelum upgrade dan image lama; image lama tidak mendukung koordinat baru. Jika transaksi baru sudah masuk, rekonsiliasikan dahulu sebelum memilih restore.

### Pembaruan rutin

Penambahan Brand/Pabrikan memakai migrasi aditif `0002_batch_brand.sql`: kolom nullable `replacement_batches.brand`, tanpa backfill atau perubahan hash batch lama. Terapkan migrasi dengan image tools terbaru sebelum memperbarui Bag Filter, mengikuti urutan stop/backup/migrate/up di atas. Tidak perlu reset data. Setelah upgrade, reload form; pencatatan baru wajib memilih brand. Replay batch lama tanpa brand tetap didukung.

Sebelum rilis, jalankan test/typecheck, build image terpisah, backup, dan review migrasi SQL. `drizzle-kit generate` hanya membuat file; deployment menjalankan migrasi melalui job terpisah. Jangan menjalankan schema push langsung di produksi. Migrasi awal hanya membuat tabel/index/FK dan seed referensi, tanpa data transaksi.

Catat image digest keempat aplikasi sebelum perubahan. Untuk memperbarui Bag Filter saja, build/tag image Bag Filter dan `docker compose up -d --no-deps --wait bag-filter`, lalu uji halaman, API, dan aset melalui gateway. Resolver mengikuti IP baru otomatis. Auth/Portal/Consumables memiliki prosedur setara. `RELEASE_TAG` dapat dipakai build rilis lengkap; ketika rilis layanan berbeda, pin image per layanan dalam override Compose dan simpan override tersebut bersama catatan deployment.

Rollback aplikasi: kembalikan image layanan ke digest sebelumnya, mulai ulang layanan, lalu jalankan smoke test. Restart Nginx jika konfigurasi gateway juga berubah. Jangan otomatis menghapus kolom/tabel atau memutar balik migrasi. Migrasi berikutnya harus memakai pola tambah dahulu, perpindahan penggunaan, lalu penghapusan pada rilis terpisah. Restore database hanya dipilih bila rollback image tidak cukup dan kehilangan data sejak backup telah dipertimbangkan.

## Consumable Room v1: instalasi dan upgrade

Rilis ini menambah container `consumables`, database `plant_consumables`, dan user runtime DML tersendiri. Isi `CONSUMABLES_DB_PASSWORD` dengan random URL-safe 24–128 karakter. Script host juga memerlukan `CONSUMABLES_DATABASE_URL` dan `CONSUMABLES_MIGRATION_DATABASE_URL`; URL internal Compose disusun dari secret. `CONSUMABLES_INTERNAL_URL` dipakai Auth untuk metadata lokasi.

Migrasi memprovisi database/user secara eksplisit sehingga volume MySQL lama didukung. Init script saja tidak cukup untuk upgrade. Migrasi Auth hanya menambah scope nullable, mempertahankan equipment Bag Filter. Checkpoint aktivasi/grant tidak mengaktifkan kembali aplikasi disabled atau mengembalikan grant yang dicabut sesudah upgrade.

Urutan upgrade, sesudah environment baru diisi:

```sh
docker compose build auth portal bag-filter consumables migrate
docker compose stop nginx portal bag-filter consumables auth
docker compose run --rm migrate exec tsx scripts/provision-consumables.ts
docker compose run --rm -e RUN_ONCE=true backup
docker compose up --no-deps --force-recreate --exit-code-from migrate migrate
docker compose up -d --wait auth portal bag-filter consumables nginx backup
docker compose restart nginx
```

Jangan mereset volume atau memakai script reset test. Provisioning hanya membuat database/user baru dan memverifikasi kredensial, sehingga backup dibuat sebelum migrasi schema/data baseline. Hentikan urutan jika job provisioning/migrasi gagal. Pada upgrade ini, restart Nginx diperlukan untuk merender template baru yang mencakup rute Consumables dan resolusi DNS dinamis; restart aplikasi berikutnya tidak memerlukan restart gateway. Pemeriksaan MySQL awal tetap menunggu dua database baseline agar provisioning database ketiga tidak mengalami dependency buntu; readiness Consumables memeriksa schema barunya dan Auth.

Bootstrap aktif yang masih admin portal memperoleh grant admin Consumables sekali. Pengguna lain diatur pada Kelola akses. Grant admin aplikasi dapat diberikan sebelum lokasi dibuat; tiga peran lainnya memerlukan lokasi aktif. Portal admin tanpa grant aplikasi tidak mempunyai akses stok.

### Impor master privat dan onboarding

Jangan salin katalog internal ke Git atau image. Jalankan dari checkout privat dengan URL database runtime yang benar, atau pasang file read-only ke job tools secara eksplisit:

```sh
node --env-file=.env --import tsx scripts/import-consumables.ts /private/catalog.json --dry-run
node --env-file=.env --import tsx scripts/import-consumables.ts /private/catalog.json --apply
node --env-file=.env --import tsx scripts/reconcile-consumables.ts
```

Pada server Compose, MySQL tidak membuka port host. Gunakan job tools dan mount file privat read-only (ganti path absolut sebelum menjalankan):

```sh
docker compose run --rm --no-deps --volume /absolute/private/catalog.json:/imports/catalog.json:ro migrate exec tsx scripts/import-consumables.ts /imports/catalog.json --dry-run
docker compose run --rm --no-deps --volume /absolute/private/catalog.json:/imports/catalog.json:ro migrate exec tsx scripts/import-consumables.ts /imports/catalog.json --apply
docker compose run --rm --no-deps migrate exec tsx scripts/reconcile-consumables.ts
```

Dry-run memvalidasi format, duplikasi, checksum dan konflik master. Apply atomik, tidak menyalin saldo/nilai historis atau membuat inventory. Pengulangan batch/checksum sama no-op. Script tidak menimpa master yang sudah berbeda; tinjau konflik secara manual. Output ringkasan tidak mencetak isi katalog atau kredensial.

Setelah impor, admin membuat lokasi aktual, mendaftarkan material yang benar-benar disimpan, mengisi rak/kemasan bila diketahui, lalu mengonfirmasi saldo awal fisik termasuk nol. “Belum dihitung” menutup penerimaan/pemakaian. Koreksi setelahnya memakai jumlah fisik dan alasan, bukan edit transaksi lama.

Health internal: `/consumables/health/live`, `/consumables/health/ready`. Metadata internal hanya service-token dan tidak dipublikasikan. API langsung tetap memeriksa sesi, tindakan dan lokasi.

### Backup, restore, dan rollback

Backup terbaru menyertakan `plant_auth`, `plant_bag_filter`, dan `plant_consumables` dalam satu dump, retensi 14 hari. Saat restore, verifikasi jumlah master, inventory, ledger, audit/idempotensi, saldo serta rekonsiliasi, selain pemeriksaan Bag Filter/Auth. Provision user runtime pada server tujuan dan cabut sesi hasil restore sebelum membuka akses.

Rilis awal membutuhkan keempat image baru karena kontrak bersama berubah. Sesudahnya setiap layanan dapat dirilis mandiri dengan image/tag per layanan. Simpan image sebelumnya; rollback aplikasi tidak menghapus schema/data Consumables. Jika kembali ke versi sebelum aplikasi tersedia, tutup akses Consumables dan gunakan gateway/image baseline; pertahankan database baru untuk rekonsiliasi. RTO/RPO tetap mengikuti target pilot di bawah, dan perlu diukur pada data aktual.
