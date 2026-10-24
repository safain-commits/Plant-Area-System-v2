# Migrasi database Docker lokal ke VPS tq-cmms.com

Rencana ini memindahkan **seluruh data aktual tiga database** dari Docker Desktop Windows ke MySQL Docker pada VPS Ubuntu. Gunakan logical dump, bukan menyalin folder `/var/lib/mysql` atau volume Docker Desktop. Portal, Auth, Bag Filter, dan Consumable Room memakai identitas serta data yang sama sesudah pemindahan.

Disusun 24–25 Oktober 2026. Ini panduan eksekusi, **bukan pernyataan bahwa database sudah dikirim atau dipulihkan di VPS**. Penyiapan dan pengujian alat tidak menghentikan preview/data nyata lokal.

Pemilik mengonfirmasi project **belum dipasang di VPS**, sehingga jalur utama di bawah memakai instalasi dan target database baru. Tetap periksa kondisi server saat eksekusi karena keadaan dapat berubah.

Pendamping:

- [Deployment server, Nginx host, DNS, dan TLS](VPS-TQ-CMMS.md).
- [Prompt dan checkpoint OpenClaw khusus database](OPENCLAW-DATABASE-HANDOVER.md).
- [Operasional backup/restore harian](../OPERATIONS.md).

## 1. Keputusan dan batas pemindahan

| Bagian                                                | Perlakuan                                                                                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `plant_auth`                                          | Akun, hash password, role/grant, scope, status aplikasi, audit, checkpoint dan migrasi dipertahankan                          |
| `plant_bag_filter`                                    | Seluruh equipment, koordinat, batch, pemasangan, brand, actor, UTC timestamp, audit, idempotensi dan checkpoint dipertahankan |
| `plant_consumables`                                   | Master, lokasi, inventory/saldo, ledger, audit, idempotensi dan impor dipertahankan                                           |
| Sesi, token verifikasi, login limiter                 | Ikut dump untuk pembuktian restore persis, lalu dikosongkan **hanya pada VPS** sebelum akses dibuka                           |
| User/grant internal MySQL                             | Tidak dipindahkan; init VPS membuat akun database memakai password VPS                                                        |
| `.env`, `AUTH_SECRET`, `SERVICE_TOKEN`, TLS key lokal | Tidak disalin sebagai konfigurasi VPS; buat rahasia dan certificate VPS sendiri                                               |
| Excel, arsip, laporan klarifikasi                     | Tidak diperlukan untuk restore; transfer privat terpisah jika ingin disimpan sebagai sumber operasional                       |

Default-nya memindahkan **semua akun aplikasi beserta izin yang ada**, bukan membuat admin pengganti atau mengimpor master saja. Akun pengujian lama yang masih ada juga ikut; pemilik meninjau dan menonaktifkannya melalui Kelola akses. Jangan menghapus akun berdasarkan pola nama/email. Akun email/password existing tetap dipakai untuk login; `BOOTSTRAP_PASSWORD` bukan password akun hasil restore. Jangan menjalankan bootstrap untuk memperbaiki login.

Setelah cutover, **VPS menjadi satu-satunya tempat pencatatan**. Preview lokal tetap dihentikan sebagai arsip. Jika ingin preview lagi, buat salinan terpisah dan beri penanda yang jelas; jangan menerima transaksi pada dua database yang kemudian dianggap sinkron otomatis.

## 2. Baseline yang benar-benar diperiksa

Pemeriksaan read-only **24 Oktober 2026 pukul 23.40 WIB**, MySQL **8.4.13**:

| Data                                 |       Jumlah |
| ------------------------------------ | -----------: |
| Akun aplikasi / grant                |      46 / 48 |
| Equipment / koordinat Bag Filter     |   6 / 18.784 |
| Batch / pemasangan Bag Filter        | 205 / 22.529 |
| Audit Bag Filter                     |          206 |
| Master material Consumables          |       17.744 |
| Lokasi / inventory / pergerakan stok |    3 / 1 / 2 |
| Audit / idempotensi stok             |        7 / 2 |

Data sudah bertambah sejak laporan impor sebelumnya. **Angka ini bukan target tetap untuk hari pemindahan.** `source.json` dari backup final menjadi acuan, termasuk transaksi yang masuk setelah dokumentasi ini. Snapshot pemeriksaan lokal tersimpan privat di `.test-runtime/database-transfer-baseline.json`; file tersebut bukan dump dan belum merupakan paket cutover.

## 3. Rencana kerja dan titik berhenti

| Tahap                  | Pelaksana          | Hasil wajib sebelum lanjut                                                                                       |
| ---------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| M0 — release dan akses | Pemilik + OpenClaw | Release tersedia di GitHub; SSH/VPS, hostname, dan tujuan file privat diketahui                                  |
| M1 — staging VPS       | OpenClaw           | Docker, checkout, image serial, rahasia VPS, backend TLS; website lain tetap sehat                               |
| M2 — pembekuan sumber  | Pemilik/laptop     | Seluruh aplikasi penulis lokal berhenti; tidak ada importer/migrator/SQL writer                                  |
| M3 — paket final       | Pemilik/laptop     | Dump gzip tiga DB, snapshot sebelum/sesudah cocok, checksum dan image/release pin                                |
| M4 — transfer          | Pemilik/laptop     | SCP/SFTP privat; checksum di VPS cocok                                                                           |
| M5 — restore tertutup  | OpenClaw           | Target kosong terverifikasi; restore selesai; seluruh fingerprint schema/data cocok                              |
| M6 — kesiapan aplikasi | OpenClaw           | Migrasi release yang sama, rekonsiliasi nol selisih, sesi lama dicabut; fingerprint sesuai pengecualian terbatas |
| M7 — cutover           | OpenClaw + pemilik | TLS/domain, SSO, data dan website lama diperiksa; sumber lokal tetap berhenti                                    |
| M8 — pemulihan         | OpenClaw           | Backup pascamigrasi, salinan offsite, bukti restore drill dan laporan privat                                     |

Jadwalkan jendela pemindahan awal 30–60 menit dan ukur durasi sebenarnya. Ini alokasi kerja, bukan jaminan downtime. Staging/build sebelum M2 mengurangi waktu sumber tidak tersedia. Jika DNS belum siap, M1 atau M6 dapat selesai dengan status **STAGED_WAITING_DNS**, tetapi jangan mengklaim aplikasi publik/operasional.

**Sebelum mulai:** commit/push dokumen dan alat baru ke release yang akan digunakan. Panduan dan script yang hanya ada di laptop tidak tersedia melalui clone. Catat full SHA; jangan menjalankan `git pull`/upgrade dependency sembarang di tengah pemindahan. Tidak ada perintah push otomatis dalam panduan ini.

## 4. Penyiapan VPS sebelum sumber dibekukan

Ikuti bagian 4–6 runbook VPS: inventarisasi layanan, instalasi Docker, clone `/opt/tq-cmms`, checkout release, kapasitas, dan backup Nginx host. Nginx host tetap melayani website lain pada 80/443. Jangan menjalankan langkah bootstrap atau impor katalog dari jalur instalasi kosong.

Untuk instalasi pertama dengan restore, generator `.env` berikut menggantikan generator bootstrap di bagian 7 runbook. Ia menolak overwrite:

```bash
cd /opt/tq-cmms
umask 077
python3 - <<'PY'
from pathlib import Path
import secrets, subprocess
values = {
    'PUBLIC_ORIGIN': 'https://tq-cmms.com',
    'HTTP_PORT': '18080', 'HTTPS_PORT': '18443',
    'RELEASE_TAG': subprocess.check_output(['git', 'rev-parse', '--short=12', 'HEAD'], text=True).strip(),
    **{k: secrets.token_hex(32) for k in (
        'MYSQL_ROOT_PASSWORD', 'AUTH_DB_PASSWORD', 'BAG_DB_PASSWORD',
        'CONSUMABLES_DB_PASSWORD', 'AUTH_SECRET', 'SERVICE_TOKEN')},
}
with Path('.env').open('x') as f:
    for k, v in values.items(): f.write(f'{k}={v}\n')
Path('.env').chmod(0o600)
Path('.deploy').mkdir(mode=0o700, exist_ok=True)
Path('.deploy/real-ip.conf').write_text('# Populate exact host peers before public use.\n')
print('Konfigurasi VPS tersimpan; tidak menjalankan bootstrap.')
PY
```

Jika `.env` atau deployment existing ditemukan, hentikan generator dan tinjau konfigurasi existing; jangan mengganti password database dengan mengedit `.env` saja. Init script tidak merotasi password pada volume yang sudah terisi.

Lanjutkan pembuatan certificate backend/trust dan direktori backup sesuai bagian 7 runbook. Build lima image **satu per satu** seperti bagian 8. **Berhenti sebelum blok migrasi/bootstrap/start aplikasi pada bagian tersebut**; pengisian database menggunakan M5 di bawah. Rahasia baru VPS tidak mengubah hash password akun aplikasi yang di-restore; sesi lama akan dicabut pada M6.

## 5. Paket final dari Windows — PowerShell

Jalankan dari workspace sumber yang sudah diperiksa. Docker memakai Linux containers. Nama project lokal memang `plant-v2-test`, tetapi saat ini **berisi data nyata**, `TEST_DATABASE=0`; jangan menjalankan prepare-test, reset, integration, atau E2E suite di sana.

### 5.1 Direktori dan identitas release

```powershell
Set-Location 'C:\Users\a_sfn\@Project\plant-area-system'
$Node = Join-Path $PWD '.tools\node-v26.12.1-win-x64\node.exe'
$TransferStamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$PackageDir = Join-Path $PWD ".deploy\database-transfer-$TransferStamp"
New-Item -ItemType Directory -Path $PackageDir -ErrorAction Stop | Out-Null
function dl {
    docker compose --env-file .test-runtime/stack.env -p plant-v2-test -f compose.yaml -f .test-runtime/compose.yaml @args
    if ($LASTEXITCODE -ne 0) { throw 'Compose lokal gagal; jangan lanjut.' }
}
dl ps
git status --short
$ReleaseSha = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Release Git tidak dapat dibaca.' }
[IO.File]::WriteAllText((Join-Path $PackageDir 'RELEASE.txt'), "$ReleaseSha`n", [Text.UTF8Encoding]::new($false))
$MysqlImageId = (docker inspect --format '{{.Image}}' plant-v2-test-mysql-1).Trim()
if ($LASTEXITCODE -ne 0) { throw 'MySQL sumber tidak ditemukan.' }
$MysqlImageRef = (docker image inspect --format '{{index .RepoDigests 0}}' $MysqlImageId).Trim()
if ($LASTEXITCODE -ne 0 -or $MysqlImageRef -notmatch '^(mysql|docker.io/library/mysql)@sha256:[a-f0-9]{64}$') {
    throw 'Image digest MySQL resmi belum dapat dipastikan; jangan lanjut.'
}
[IO.File]::WriteAllText((Join-Path $PackageDir 'mysql-image.txt'), "$MysqlImageRef`n", [Text.UTF8Encoding]::new($false))
```

Review working tree dan pastikan SHA tersebut tersedia di GitHub serta sesuai release yang akan dibangun. Nama/path contoh adalah keadaan laptop saat panduan dibuat; konfirmasi `dl ps` dan port MySQL loopback 13306 sebelum menjalankan ekspor. Jangan menyalin `.test-runtime/host.env` ke VPS.

### 5.2 Bekukan penulisan dan buat backup

Sampaikan waktu berhenti pencatatan ke pengguna. Tutup job impor/migrasi/manual SQL lain. Blok ini sengaja **tidak menyalakan ulang sumber** sesudah dump, agar tidak ada transaksi yang tertinggal ketika VPS mulai dipakai.

```powershell
dl stop nginx portal bag-filter consumables auth backup
& $Node --env-file=.test-runtime/host.env --import tsx scripts/database-snapshot.ts capture --out (Join-Path $PackageDir 'source.json')
if ($LASTEXITCODE -ne 0) { throw 'Snapshot sumber gagal.' }
& $Node scripts/database-backup.mjs --container plant-v2-test-mysql-1 --out (Join-Path $PackageDir 'database.sql.gz')
if ($LASTEXITCODE -ne 0) { throw 'Dump gagal; .partial bukan backup siap pakai.' }
& $Node --env-file=.test-runtime/host.env --import tsx scripts/database-snapshot.ts capture --out (Join-Path $PackageDir 'source-after.json')
if ($LASTEXITCODE -ne 0) { throw 'Snapshot setelah dump gagal.' }
& $Node --import tsx scripts/database-snapshot.ts compare --expected (Join-Path $PackageDir 'source.json') --actual (Join-Path $PackageDir 'source-after.json')
if ($LASTEXITCODE -ne 0) { throw 'Sumber berubah; jangan gunakan paket ini untuk cutover.' }
```

MySQL sumber tetap hidup. `mysqldump --single-transaction --quick` membuat snapshot transaksional tiga database; tidak boleh ada DDL selama dump. Script menjaga output biner agar tidak rusak oleh redirection/pipeline PowerShell, memeriksa exit code dan CRC gzip, serta membuat receipt checksum. Ia tidak mengekspor schema `mysql`/akun server dan tidak mengatur penghentian aplikasi sendiri. File output existing ditolak. Kegagalan meninggalkan `.partial` untuk diperiksa; gunakan nama paket baru setelah penyebab diperbaiki.

`database-snapshot.ts` hanya SELECT/metadata/transaction read-only. Fingerprint meliputi seluruh nilai baris menurut primary key dan definisi tabel. BIGINT/DECIMAL dipertahankan sebagai string; waktu dibandingkan dalam UTC. Counter AUTO_INCREMENT di luar baris tidak dijadikan fingerprint, sedangkan semua ID yang tersimpan tetap dibandingkan. Views, tabel non-InnoDB, tabel tanpa primary key, atau trigger/routine/event membuat capture berhenti untuk review khusus.

Capture juga memeriksa orphan pada foreign key di masing-masing database. Dump standar dapat menonaktifkan pemeriksaan foreign key sementara selama pemuatan; menyalakannya kembali tidak memindai ulang data lama, sehingga pemeriksaan eksplisit ini tetap diperlukan.

### 5.3 Checksum paket

```powershell
$TransferFiles = @('database.sql.gz', 'database.sql.gz.json', 'source.json', 'RELEASE.txt', 'mysql-image.txt')
$ChecksumLines = foreach ($Name in $TransferFiles) {
    $Digest = (Get-FileHash -LiteralPath (Join-Path $PackageDir $Name) -Algorithm SHA256).Hash.ToLowerInvariant()
    "$Digest  $Name"
}
[IO.File]::WriteAllText((Join-Path $PackageDir 'SHA256SUMS'), ($ChecksumLines -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
Get-Item -LiteralPath (Join-Path $PackageDir 'database.sql.gz') | Select-Object Name, Length
```

Paket berisi data perusahaan, hash password, dan token sesi. Gzip **bukan enkripsi**. Simpan pada folder privat dengan ACL Windows yang sesuai; jangan kirim melalui GitHub, chat, link publik, atau image Docker. SSH mengenkripsi transfer; untuk penyimpanan/offsite gunakan enkripsi organisasi sebagaimana runbook VPS.

## 6. Transfer privat ke VPS

Konfirmasi host key SSH dengan pemilik/provider melalui kanal yang dipercaya. Jangan memakai `StrictHostKeyChecking=no`. Ganti user/IP dengan akses VPS aktual, termasuk opsi `-P` SCP/`-p` SSH jika port bukan 22.

```powershell
$SshTarget = 'SSH_USER@IP_VPS'
if ($SshTarget -match 'SSH_USER|IP_VPS') { throw 'Isi tujuan SSH aktual dahulu.' }
ssh $SshTarget 'umask 077; mkdir -p ~/tq-cmms-transfer-incoming; chmod 700 ~/tq-cmms-transfer-incoming'
if ($LASTEXITCODE -ne 0) { throw 'Direktori penerima belum siap.' }
foreach ($Name in ($TransferFiles + 'SHA256SUMS')) {
    scp (Join-Path $PackageDir $Name) "${SshTarget}:tq-cmms-transfer-incoming/"
    if ($LASTEXITCODE -ne 0) { throw "Transfer $Name gagal." }
}
```

Gunakan direktori penerimaan baru jika sudah ada paket lain; jangan menimpa paket yang belum diidentifikasi. Berikan kepada OpenClaw **path absolut paket**, full SHA release, dan checksum dump melalui kanal privat. `source-after.json` tetap sebagai bukti lokal; `source.json` sudah mewakili titik dump setelah pemeriksaan kesamaan.

## 7. Restore di VPS — Bash, target masih tertutup

### 7.1 Verifikasi paket dan pin image

```bash
set -euo pipefail
TRANSFER_DIR="$HOME/tq-cmms-transfer-incoming"
cd "$TRANSFER_DIR"
chmod 700 "$TRANSFER_DIR"
chmod 600 database.sql.gz database.sql.gz.json source.json RELEASE.txt mysql-image.txt SHA256SUMS
sha256sum -c SHA256SUMS
gzip -t database.sql.gz
cd /opt/tq-cmms
test "$(git rev-parse HEAD)" = "$(tr -d '\r\n' < "$TRANSFER_DIR/RELEASE.txt")"
MYSQL_IMAGE_REF=$(tr -d '\r\n' < "$TRANSFER_DIR/mysql-image.txt")
[[ "$MYSQL_IMAGE_REF" =~ ^(mysql|docker.io/library/mysql)@sha256:[a-f0-9]{64}$ ]]
test ! -e .deploy/compose.mysql-pin.yaml
printf 'services:\n  mysql:\n    image: "%s"\n  backup:\n    image: "%s"\n' "$MYSQL_IMAGE_REF" "$MYSQL_IMAGE_REF" > .deploy/compose.mysql-pin.yaml
chmod 600 .deploy/compose.mysql-pin.yaml
dc() {
  sudo docker compose --project-name tq-cmms --env-file /opt/tq-cmms/.env \
    -f /opt/tq-cmms/compose.yaml \
    -f /opt/tq-cmms/infra/deploy/compose.vps.yaml \
    -f /opt/tq-cmms/.deploy/compose.mysql-pin.yaml "$@"
}
dc config --quiet
dc pull mysql backup
```

Jika file pin sudah ada, cocokkan isinya; jangan overwrite. Gunakan fungsi `dc` dengan file pin ini pada seluruh operasi setelahnya, termasuk shell baru/upgrade. Simpan pin bersama backup konfigurasi privat. Jika SHA/code/paket/image tidak sesuai, hentikan sebelum mengimpor. Jangan mengganti versi MySQL untuk menghindari kegagalan pull tanpa review.

### 7.2 Buat target kosong dan pastikan tidak menimpa data

Jika vhost sudah ada, aktifkan maintenance khusus domain. Jangan menghentikan Nginx host atau website lain.

```bash
sudo install -d -m 0755 /var/lib/tq-cmms
sudo touch /var/lib/tq-cmms/maintenance
dc stop nginx portal bag-filter consumables auth backup
dc up -d --no-deps --wait --wait-timeout 180 mysql
TABLES=$(dc exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N -B -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA IN (\"plant_auth\",\"plant_bag_filter\",\"plant_consumables\")"')
test "$TABLES" = '0'
```

Init MySQL VPS membuat tiga database dan kredensial runtime; **belum menjalankan migrator/schema aplikasi**. Target harus tidak mempunyai tabel aplikasi. Walau hanya pernah bootstrap/seed tanpa transaksi, target tetap tidak kosong dan guard di atas akan berhenti.

Jika target sudah berisi data, jangan menghapus tabel agar guard lolos. Backup target dan tentukan apakah perlu merge atau penggantian terencana. Alternatif penggantian adalah volume kandidat baru yang dinamai eksplisit lewat override, sementara volume existing dipertahankan; langkah itu memerlukan keputusan target/cutover yang jelas. Jangan memakai `down -v`, `docker volume prune`, atau restore ke deployment live.

### 7.3 Impor dan bandingkan sebelum perubahan apa pun

```bash
TARGET_MYSQL_ID=$(dc ps -q mysql)
test -n "$TARGET_MYSQL_ID"
sudo docker cp "$TRANSFER_DIR/database.sql.gz" "$TARGET_MYSQL_ID:/tmp/tq-cmms-incoming.sql.gz"
dc exec -T mysql bash -c 'set -euo pipefail; gzip -t /tmp/tq-cmms-incoming.sql.gz; gzip -dc /tmp/tq-cmms-incoming.sql.gz | MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot'
dc run --rm --no-deps --volume "$TRANSFER_DIR:/transfer" migrate exec tsx scripts/database-snapshot.ts capture --out /transfer/restored-before-migrate.json
dc run --rm --no-deps --volume "$TRANSFER_DIR:/transfer:ro" migrate exec tsx scripts/database-snapshot.ts compare --expected /transfer/source.json --actual /transfer/restored-before-migrate.json
```

Output wajib `passed:true` dan `differences:[]`. Ini membuktikan isi seluruh tabel dan schema, termasuk hash password, grant/scope, data migrasi, idempotensi, UTC timestamp, dan saldo. File bukti yang ditulis job container dapat dimiliki root; gunakan sudo bila membaca dari host, jangan `chmod 777`.

Restore logical dump mengandung DDL dan **bukan satu transaksi atomik untuk seluruh proses**. Jika impor gagal, target dapat terisi parsial. Biarkan aplikasi berhenti, simpan error secara privat, dan periksa kegagalan. Jangan mengklaim rollback otomatis atau mengulangi restore di database yang sudah menerima transaksi baru. Pertahankan paket/volume gagal untuk diagnosis; rencanakan target kosong baru jika diperlukan.

## 8. Migrasi release, rekonsiliasi, dan pencabutan sesi

Jalankan migrator release yang sama setelah bukti raw restore cocok. Ia memakai histori migrasi/checkpoint hasil restore. **Tidak ada bootstrap, impor ulang Excel/master, reset atau seed demo.**

```bash
dc up --no-deps --force-recreate --exit-code-from migrate migrate
dc run --rm --no-deps migrate exec tsx scripts/reconcile-consumables.ts
dc run --rm --no-deps --volume "$TRANSFER_DIR:/transfer" migrate exec tsx scripts/database-snapshot.ts capture --out /transfer/restored-after-migrate.json
dc run --rm --no-deps --volume "$TRANSFER_DIR:/transfer:ro" migrate exec tsx scripts/database-snapshot.ts compare --expected /transfer/source.json --actual /transfer/restored-after-migrate.json
```

Migrator harus exit 0, rekonsiliasi harus `differences:[]`, dan fingerprint harus tetap cocok untuk release yang sama. Jangan melewati perbedaan dengan mengosongkan tabel atau mengubah expected snapshot. Upgrade schema release lebih baru adalah pekerjaan terpisah setelah migrasi data ini diterima.

Cabut state autentikasi sementara **pada target VPS saja**:

```bash
dc exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "START TRANSACTION; DELETE FROM plant_auth.sessions; DELETE FROM plant_auth.verifications; DELETE FROM plant_auth.login_attempts; COMMIT;"'
dc run --rm --no-deps --volume "$TRANSFER_DIR:/transfer" migrate exec tsx scripts/database-snapshot.ts capture --out /transfer/restored-after-revoke.json
dc run --rm --no-deps --volume "$TRANSFER_DIR:/transfer:ro" migrate exec tsx scripts/database-snapshot.ts compare --expected /transfer/source.json --actual /transfer/restored-after-revoke.json --after-session-revoke
```

Mode `--after-session-revoke` hanya menerima tiga tabel sementara tadi menjadi kosong; definisi tabel tetap harus sama. **Akun, password, grant, semua audit, dan seluruh data bisnis tetap dibandingkan persis.** Setelah aplikasi mulai dipakai, tabel sesi/limiter akan berisi data baru; jangan lagi menganggap snapshot ini identik dengan keadaan operasional berjalan.

## 9. Start, penerimaan, dan cutover

```bash
dc up -d --no-deps --wait --wait-timeout 180 auth
dc up -d --no-deps --wait --wait-timeout 180 portal bag-filter consumables
dc up -d --no-deps nginx backup
dc ps -a
dc exec -T nginx nginx -t
```

Lanjutkan Real-IP trust, pengujian backend loopback dengan verifikasi certificate, DNS, vhost Nginx host, ACME/TLS publik, dan penerimaan sesuai bagian 9–12 runbook VPS. Gunakan fungsi `dc` yang tetap menyertakan pin. Setelah backend/TLS siap, hapus penanda yang dibuat pada M5 dengan `sudo rm -- /var/lib/tq-cmms/maintenance` agar pemilik dapat melakukan penerimaan melalui domain; sumber lokal harus tetap berhenti. Jika penerimaan gagal, aktifkan kembali maintenance khusus domain dan tinjau apakah target sudah menerima tulisan sebelum memilih rollback. DNS belum siap berarti staging, bukan live.

Penerimaan pemilik melalui akun existing:

1. Login `https://tq-cmms.com/auth/login`, lalu buka Portal, Bag Filter, dan Consumables tanpa login ulang. Password tidak diserahkan melalui laporan OpenClaw.
2. Periksa grant/scope serta status akun/aplikasi. Jangan memberikan hak tambahan untuk menutupi error restore/routing.
3. Cocokkan jumlah terhadap `source.json`, lalu periksa beberapa tanggal dan timeline riwayat 2023–2026, konfirmasi 422 3A/10B, serta brand yang memang tercatat.
4. Periksa master, lokasi, rak, saldo inventory, history dan audit Consumables. Tidak perlu membuat transaksi palsu untuk menguji tombol.
5. Periksa tema, prefix/deep link/aset, API JSON, endpoint internal tertutup, serta logout. Uji website lama sebelum/sesudah.
6. Setelah penerimaan lulus, catat domain tetap terbuka dan hasil akses dari jaringan luar. Tandai waktu cutover dalam WIB/UTC. Sumber lokal **tetap berhenti**; semua pencatatan berikutnya ke VPS.

Penanda keberhasilan data berbeda dari keberhasilan publikasi: **RESTORE_VERIFIED**, **SESSIONS_REVOKED**, **STAGED_WAITING_DNS**, **PUBLIC_HTTPS_READY**, **WAITING_OWNER_EXISTING_LOGIN**, dan **LIVE_ACCEPTED** harus dilaporkan terpisah.

## 10. Backup pascamigrasi dan pemulihan berikutnya

Sesudah penerimaan:

```bash
dc run --rm --no-deps -e RUN_ONCE=true backup
dc logs --tail=10 backup
```

Verifikasi backup tiga database, gzip/checksum, retensi 14 hari dan salinan terenkripsi di luar VPS. Arsipkan release/image pin, `.env` VPS, certificate/trust/backend key dan bukti restore dalam penyimpanan privat. Rahasia VPS diperlukan saat pemulihan; jangan mengandalkan password laptop. Uji backup di MySQL terpisah tanpa port publik sesuai bagian 14 runbook dan rekonsiliasikan ledger.

Backup harian baru mempunyai titik waktu baru. Jangan membandingkannya dengan `source.json` migrasi setelah ada transaksi lanjutan. Gunakan snapshot yang berpasangan dengan backup tersebut, atau validasi salinan restore drill dan kontrol bisnisnya. Snapshot berurutan dari server yang masih menerima tulisan bukan bukti bahwa setiap tabel sama dengan titik dump.

RTO pilot maksimal empat jam dan RPO backup harian adalah **target**; belum dibuktikan pada VPS ini. Cutover dapat mempertahankan seluruh transaksi sumber hanya jika sumber benar-benar dibekukan sampai VPS diterima. Binlog lokal tujuh hari bukan pengganti backup offsite atau implementasi point-in-time recovery yang sudah diuji.

### Rollback

| Keadaan                                            | Tindakan                                                                                                                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gagal staging/transfer, belum ada tulisan pada VPS | Pertahankan target tertutup. Jika perlu, nyalakan kembali aplikasi lokal; paket lama menjadi rehearsal dan backup final harus dibuat lagi saat cutover berikutnya |
| Raw restore gagal/tidak cocok                      | Jangan start aplikasi. Simpan paket dan target untuk diagnosis; gunakan target kosong baru setelah masalah diketahui                                              |
| Aplikasi VPS gagal sebelum transaksi operasional   | Kembalikan release/image yang kompatibel atau kembali ke sumber lokal yang belum berubah; dokumentasikan keputusan sebelum menerima tulisan                       |
| VPS sudah menerima transaksi baru                  | Jangan sekadar menyalakan sumber lokal lama. Bekukan VPS, backup keadaan terbarunya, lalu lakukan pemulihan balik/rekonsiliasi agar transaksi baru tidak hilang   |

Jangan menghapus volume lokal/target lama sampai cutover, backup offsite dan restore drill diterima pemilik. Cleanup arsip mengikuti retensi/kebijakan perusahaan, bukan otomatis sebagai bagian clone/deployment.

## 11. Bukti dan batas validasi panduan

Alat snapshot dijalankan read-only pada database lokal untuk baseline di atas. Backup/restore alat diuji pada **fixture sintetis dalam MySQL terpisah**, bukan restore ke preview perusahaan. Pemeriksaan mencakup fingerprint semua tabel, BIGINT di atas batas integer JavaScript, DECIMAL enam angka, UTC milidetik, Unicode, penolakan output existing, kredensial target yang berbeda, penolakan perubahan hash akun, penolakan orphan foreign key, serta pengecualian pencabutan sesi yang terbatas. Container fixture dibersihkan. Hasil pemeriksaan sintaks/typecheck dicatat di [VALIDATION.md](../VALIDATION.md).

Belum dilakukan freeze sumber final, ekspor paket data perusahaan untuk cutover, transfer SSH, restore di VPS, perubahan DNS, atau pembukaan trafik publik pada pekerjaan penyiapan ini. Semua status tersebut harus diisi dari hasil eksekusi nyata OpenClaw/pemilik.

Dokumentasi diperiksa melalui Context7, lalu referensi MySQL dikonfirmasi pada versi 8.4:

- [MySQL 8.4 — mysqldump, konsistensi InnoDB dan batas DDL](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html).
- [MySQL 8.4 — memuat kembali SQL dump](https://dev.mysql.com/doc/refman/8.4/en/reloading-sql-format-dumps.html).
- [Docker Compose exec dan opsi tanpa TTY](https://docs.docker.com/reference/cli/docker/compose/exec/).
- [mysql2 — tipe DECIMAL/JSON](https://sidorares.github.io/node-mysql2/docs/documentation).
