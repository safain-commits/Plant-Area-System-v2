# Operasional pilot

Logout tersedia melalui **Menu akun → Keluar akun** atau halaman **Profil** di Portal, Bag Filter, dan Consumable Room. Sidebar tidak lagi menampilkan sesi/countdown atau tombol logout. Sesi tetap absolut delapan jam; sign-out, reset dan pencabutan sesi tetap ditangani Auth. Smoke test pengakhiran sesi memakai menu akun dan memeriksa API menolak cookie yang sudah logout.

Penyempurnaan halaman equipment 4 November 2026 mengubah komponen bersama `@plant/ui`: rilis memakai build empat aplikasi (`auth portal bag-filter consumables`) melalui runbook aktif. Perubahan ini tidak memerlukan migrasi database atau impor data. Periksa KPI umur aktual, penanda kompartemen aktif, pemilihan massal, riwayat kanan/vertikal, dan tombol pencatatan yang hanya muncul setelah ada pilihan.

Untuk revisi Consumable Room v1.1, gunakan [upgrade R22](deployment/R22-UPGRADE.md): preflight stok tunggal, migrasi 0002/0003, CLI penamaan dan checkpoint OpenClaw.

Untuk VPS pengguna dengan Nginx existing di host dan domain `tq-cmms.com`, ikuti [runbook VPS](deployment/VPS-TQ-CMMS.md) serta [handover OpenClaw](deployment/OPENCLAW-HANDOVER.md). Perintah Compose di bawah adalah baseline umum; pada VPS tersebut gunakan fungsi `dc` dengan `infra/deploy/compose.vps.yaml` agar binding, budget resource, dan logging sesuai topologi host.

Pemindahan data aktual laptop memakai [panduan database lokal ke VPS](deployment/DATABASE-LOCAL-TO-VPS.md) dan [handover database OpenClaw](deployment/OPENCLAW-DATABASE-HANDOVER.md). Bekukan seluruh penulis sumber, pindahkan tiga database lewat dump privat, cocokkan fingerprint sebelum migrator, lalu cabut sesi pada target. Jangan menjalankan bootstrap/impor master untuk database hasil restore. Jika `.deploy/compose.mysql-pin.yaml` disiapkan saat pemindahan, sertakan pada seluruh perintah Compose VPS, termasuk backup/upgrade.

Setelah go-live, ikuti [alur development PC/Mac → GitHub → VPS](deployment/DEVELOPMENT-TO-VPS.md). Workspace PC saat ini tetap digunakan untuk kode; runtime lokal baru memakai container/database terisolasi dan arsip sumber `plant-v2-test` tetap beku. Mac memakai clone GitHub dengan environment lokal sendiri. Pembaruan produksi mempertahankan database dan menerapkan migrasi yang direview, tanpa mengunggah ulang dump laptop.

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

## Upgrade pembatalan record Bag Filter

Rilis pembatalan memerlukan migrasi aditif **Bag Filter `0003_batch_cancellations`**; nomor ini terpisah dari migrasi `0003` Consumables. Ambil backup tiga database, catat SHA/image aktif, aktifkan maintenance dan hentikan akses aplikasi selama migrasi. Jalankan migrator dari rilis baru memakai konfigurasi deployment yang sama, tanpa bootstrap, reset, atau impor ulang. Migrasi hanya menambah tabel pembatalan; batch, pemasangan, actor, hash dan audit lama dipertahankan.

Deploy keempat aplikasi yang memakai kontrak izin bersama, lalu periksa readiness, SSO dan riwayat sebelum membuka maintenance. Verifikasi tombol pembatalan hanya bagi admin Bag Filter dalam scope. Uji transaksi buatan hanya pada lingkungan terisolasi; kesalahan record produksi ditinjau dan dibatalkan oleh admin melalui UI setelah rilis diterapkan. Panduan pengguna: [Pembatalan Bag Filter](BAG-FILTER-CANCELLATION.md).

Backup mencakup tabel `batch_cancellations` secara otomatis. Restore drill harus membandingkan isi tabel tersebut beserta audit dan kondisi peta, bukan hanya jumlah batch/pemasangan. Snapshot database generik membaca seluruh tabel, termasuk tabel baru. Sesudah pembatalan pertama, **jangan rollback ke aplikasi lama yang belum memahami pembatalan**: query lama akan kembali menghitung record batal. Pertahankan tabel/data dan lakukan perbaikan maju atau gunakan image kompatibel; tidak ada down migration otomatis.

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

Override dari `scripts/prepare-test.ts` menetapkan subnet IPAM eksplisit pada jaringan `private` project uji (`172.30.250.0/24` secara default), karena Docker mensyaratkannya untuk IP tetap sentinel. Jika subnet tersebut berbenturan dengan jaringan lokal, gunakan `PLANT_TEST_SUBNET` secara konsisten pada seluruh perintah Compose pengujian. Konfigurasi deployment produksi tidak menetapkan subnet ini. Untuk stack uji lama, jalankan ulang prepare, kemudian `docker compose --env-file .test-runtime/stack.env -p plant-v2-test -f compose.yaml -f .test-runtime/compose.yaml down` tanpa opsi penghapusan volume, lalu jalankan `up -d --wait nginx backup` dengan argumen Compose yang sama. Langkah tersebut membuat ulang jaringan dan container sambil mempertahankan volume MySQL serta kredensial/akun yang ada. Script recovery memeriksa kesesuaian subnet sebelum mengganti container aplikasi.

## Pembaruan dan rollback

### Penyempurnaan sidebar dan dashboard Consumables

Penyempurnaan memakai shell serta komponen bersama di empat aplikasi. Build dan perbarui `auth portal bag-filter consumables` bersama pada rilis pertama ini. Tidak ada migrasi schema/data untuk UI. Setelah readiness, uji Portal, ringkasan Consumables, pilihan tahun/kuartal, sidebar sesuai aplikasi/peran, serta halaman Audit Bag Filter. Endpoint, perhitungan stok, dan izin tetap memakai kontrak sebelumnya. Preferensi sidebar/tema browser tetap digunakan.

Tes visual memakai respons dashboard sintetis hanya pada browser pengujian, tanpa memasukkan transaksi sintetis ke database. Akun sementara serta fixture transaksi suite Consumables dibersihkan berdasarkan ID milik run. Sejak 24 Oktober 2026, preview lokal berisi master material perusahaan: data contoh Consumables telah diganti, `TEST_DATABASE=0`, dan penanda lokal `.test-runtime/REAL-DATA-PRESENT.json` dipasang. Prepare dan konfigurasi browser test menolak preview berpenanda ini. Jangan menghapus penanda, mengaktifkan mode pengujian, atau menjalankan reset pada preview tersebut. Pengujian berikutnya harus memakai checkout, project Compose, port, dan volume database terpisah. Jangan menyaring prefix MMID pada query untuk menyembunyikan fixture.

Master perusahaan tidak menyertakan saldo operasional. Admin mendaftarkan material ke stok R22, lalu mengonfirmasi saldo awal dari hitung fisik, termasuk hasil nol. Kolom stok SAP dan nilai finansial sumber tidak digunakan sebagai saldo. Workbook, adapter impor, backup sebelum penggantian, dan bukti verifikasi disimpan lokal pada direktori yang diabaikan Git/Docker; file privat tersebut tidak ikut clone atau deployment VPS. Transfer ke server tujuan harus melalui kanal privat dan jalankan CLI impor dengan dry-run terlebih dahulu.

Preview juga berisi riwayat nyata Bag Filter 561/562 sejak impor manual 24 Oktober 2026. Tabel riwayat menjadi acuan; entri dengan tanggal/koordinat/jumlah belum terverifikasi ditahan dalam laporan privat. Umur yang tampil mengikuti pemasangan terakhir yang berhasil diverifikasi, sehingga belum membuktikan seluruh kondisi fisik tercakup. Brand dan WO yang tidak dicatat pada sumber tetap kosong. Jangan menjalankan ulang script penggantian data dari arsip sementara; checkpoint mencegah penghapusan ulang, tetapi pembaruan berikutnya harus merekonsiliasi entri tertahan dan data operasional baru. Backup/import database diperlukan untuk membawa riwayat ke VPS; clone repository saja tidak memindahkannya.

Impor berikutnya pada tanggal yang sama menambahkan riwayat terverifikasi 421/422 dan L61/L62, sehingga keenam equipment kini memuat data nyata. Data uji pada empat equipment tersebut diganti tanpa mengubah 561/562. Nomor kejadian ganda pada peta dipertahankan sebagai beberapa pemasangan; brand yang tercantum dipisahkan per batch. Kejadian besar dipecah menjadi batch maksimal 500 posisi dengan referensi kejadian sumber yang sama. Selisih QTY total sumber tetap dicatat; hanya rincian kompartemen terverifikasi yang diimpor sesuai keputusan pengguna. Laporan privat memuat entri tertahan, rincian merek, serta marker peta yang belum mempunyai rincian pada tabel. Jangan gunakan preview ini untuk tes bisnis/reset.

Riwayat 2026 untuk 421/422 dan L62 kemudian ditambahkan secara aditif setelah backup: 9 batch/1.889 pemasangan, tanpa mengubah riwayat lama. Sheet L61 tahun 2026 kosong sehingga tidak menambah ataupun menghapus data. Nomor kejadian harus dibedakan berdasarkan workbook/tahun; nomor yang sama pada 2024–2025 dan 2026 bukan duplikat otomatis. Jangan menganggap sel peta kosong sebagai perintah menghapus pemasangan lama. Lima rincian kompartemen dan tiga selisih QTY total masih memerlukan klarifikasi pada laporan privat `tmp/BAG-2026-IMPORT-REVIEW.md`. Total setelah impor lokal adalah 173 batch/18.864 catatan pemasangan pada enam equipment. Impor lanjutan wajib memeriksa benturan equipment/tanggal/koordinat terhadap data berjalan, mempertahankan semua transaksi lama, serta memakai provenance, checkpoint, dan idempotensi terpisah. Seluruh sumber dan hasil impor tetap lokal; clone repository tidak memindahkan database ke VPS.

Konfirmasi pengguna berikutnya menambahkan penggantian penuh Comp. 3A pada 422-BF1, tanggal 22 Juli 2024: satu batch/136 pemasangan dengan sumber konfirmasi pengguna. Total lokal kini 174 batch/19.000 catatan pemasangan. Jam tanpa keterangan memakai 00.00 WIB; brand dan WO tetap kosong. Konfirmasi 2024 tidak otomatis menyelesaikan entri tertahan dari kejadian 2026. Laporan privat berada di `tmp/BAG-422-3A-20240722-REVIEW.md`.

Konfirmasi lanjutan menambahkan penggantian penuh Comp. 10B pada 422-BF1, tanggal 16 Oktober 2023, satu batch/136 pemasangan. Total setelah penambahan ini adalah 175 batch/19.136 catatan pemasangan; 422 kini mempunyai catatan pada seluruh 4.080 posisi. Lima pemasangan parsial yang lebih baru pada 10B tetap menjadi kondisi terkini. Cakupan seluruh posisi tidak menyelesaikan kejadian historis yang masih tertahan. Bukti privat tersedia di `tmp/BAG-422-10B-20231016-REVIEW.md`.

Impor workbook 2023 kemudian menambahkan 27 batch/3.256 pemasangan setelah backup, termasuk dua koreksi label yang dikonfirmasi pengguna: L61 No. 2 `19(67)` berarti Comp. 10, dan 421 No. 4 `8A(1)` yang kedua berarti 8B(1). Rentang tanggal memakai tanggal selesai sesuai konfirmasi pengguna; jam yang tidak tersedia memakai 00.00 WIB. Penggantian 136 bag 422 Comp. 10B pada 16 Oktober 2023 ditautkan ke batch lama melalui audit sumber, tanpa duplikasi. Total lokal menjadi 202 batch/22.392 pemasangan. Tujuh belas rincian kompartemen masih tertahan, dengan enam selisih QTY total dalam laporan privat `tmp/BAG-2023-IMPORT-REVIEW.md`. Seluruh riwayat lama dan kondisi terkini yang bertanggal lebih baru dipertahankan; transfer ke VPS tetap memerlukan backup privat.

### UI refresh v2

Pembaruan ini menambah endpoint ringkasan/pencarian/aktivitas dan metadata waktu kedaluwarsa sesi, tanpa migrasi database. Bangun serta perbarui ketiga image agar komponen bersama dan kontrak sesi konsisten:

```sh
docker compose build auth portal bag-filter
docker compose up -d --no-deps --wait auth portal bag-filter
docker compose restart nginx
```

Periksa login, dashboard sesuai scope, pencatatan, dan logout. Preferensi tema/sidebar tersimpan per browser; riwayat pencarian dan penanda aktivitas dibaca dipisahkan menurut ID pengguna. Dashboard menghitung tanggal pemasangan WIB; notifikasi berdasarkan waktu pencatatan batch, sehingga transaksi bertanggal mundur tetap muncul sebagai aktivitas terbaru. Timer UI dari rilis ini telah dihapus pada penyempurnaan 4 November 2026; batas sesi server tetap berlaku. Perintah di atas merupakan baseline tiga aplikasi; instalasi dengan Consumables membangun/memperbarui keempat image mengikuti runbook deployment aktif. Tidak perlu membatalkan migrasi UI ketika rollback image.

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

## Consumable Room: instalasi dan upgrade

Rilis ini menambah container `consumables`, database `plant_consumables`, dan user runtime DML tersendiri. Isi `CONSUMABLES_DB_PASSWORD` dengan random URL-safe 24–128 karakter. Script host juga memerlukan `CONSUMABLES_DATABASE_URL` dan `CONSUMABLES_MIGRATION_DATABASE_URL`; URL internal Compose disusun dari secret. Auth tidak lagi memerlukan metadata lokasi stok.

Migrasi memprovisi database/user secara eksplisit sehingga volume MySQL lama didukung. Init script saja tidak cukup untuk upgrade. Migrasi Auth hanya menambah scope nullable, mempertahankan equipment Bag Filter. Checkpoint aktivasi/grant tidak mengaktifkan kembali aplikasi disabled atau mengembalikan grant yang dicabut sesudah upgrade.

Untuk rilis R22 pada produksi existing, ikuti [checkpoint upgrade R22](deployment/R22-UPGRADE.md), termasuk preflight dan backup final saat penulis berhenti. Contoh di bawah hanya baseline instalasi container keempat, sesudah environment baru diisi:

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

Bootstrap aktif yang masih admin portal memperoleh grant admin Consumables sekali. Pengguna lain diatur pada Kelola akses. Grant hanya memilih role; seluruh pengguna membaca stok dan riwayat R22 yang sama. Portal admin tanpa grant aplikasi tidak mempunyai akses stok.

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

Setelah impor, admin mendaftarkan material yang benar-benar disimpan ke stok R22, mengisi rak/konversi bila diketahui, lalu mengonfirmasi saldo awal fisik termasuk nol. “Belum dihitung” menutup penerimaan/pemakaian. Koreksi setelahnya memakai jumlah fisik dan alasan, bukan edit transaksi lama.

Health internal: `/consumables/health/live`, `/consumables/health/ready`. Endpoint metadata lokasi lama dihapus. API langsung tetap memeriksa sesi dan tindakan.

### Backup, restore, dan rollback

Backup terbaru menyertakan `plant_auth`, `plant_bag_filter`, dan `plant_consumables` dalam satu dump, retensi 14 hari. Saat restore, verifikasi jumlah master, inventory, ledger, audit/idempotensi, saldo serta rekonsiliasi, selain pemeriksaan Bag Filter/Auth. Provision user runtime pada server tujuan dan cabut sesi hasil restore sebelum membuka akses.

Rilis awal membutuhkan keempat image baru karena kontrak bersama berubah. Sesudahnya setiap layanan dapat dirilis mandiri dengan image/tag per layanan. Simpan image sebelumnya; rollback aplikasi tidak menghapus schema/data Consumables. Jika kembali ke versi sebelum aplikasi tersedia, tutup akses Consumables dan gunakan gateway/image baseline; pertahankan database baru untuk rekonsiliasi. RTO/RPO tetap mengikuti target pilot di bawah, dan perlu diukur pada data aktual.
