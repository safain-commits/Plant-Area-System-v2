# Deployment VPS — tq-cmms.com

Runbook ini disusun pada **24 Oktober 2026** untuk Ubuntu 24.04 x86_64, 5 vCPU, RAM sekitar 8,7 GB, disk 48,4 GB dengan sekitar 22 GB kosong. **Nginx sudah berjalan langsung pada host dan melayani website lain; Docker belum terpasang.** Domain `tq-cmms.com` masih disiapkan pemilik.

Baca [handover OpenClaw](OPENCLAW-HANDOVER.md) untuk mandat eksekusi dan format laporan. Panduan ini menyiapkan deployment; penulisan dokumen bukan bukti bahwa VPS/domain sudah diuji atau aplikasi sudah dipublikasikan.

**Jika membawa database aktual dari laptop:** gunakan [jalur migrasi database](DATABASE-LOCAL-TO-VPS.md) dan [prompt OpenClaw database](OPENCLAW-DATABASE-HANDOVER.md). Jalur tersebut memulihkan tiga database sebelum migrator, mempertahankan akun/password/grant, dan tidak menjalankan bootstrap atau impor master ulang. Blok instalasi kosong di bawah bukan langkah pengisian data untuk jalur restore.

## 1. Topologi yang digunakan

```text
Internet / browser
  https://tq-cmms.com:443
          |
  Nginx host yang sudah ada + sertifikat Let's Encrypt
          | HTTPS, verifikasi sertifikat backend aktif
  127.0.0.1:18443 -> Nginx container project
          | auth_request + guard server
          +-- Portal       /
          +-- Auth         /auth
          +-- Bag Filter   /bag-filter
          +-- Consumables  /consumables
          +-- MySQL 8.4: plant_auth / plant_bag_filter / plant_consumables
          +-- backup harian
```

Nginx host tetap memiliki port publik **80/443**. Override VPS mengganti binding gateway project menjadi **127.0.0.1:18080/18443**; MySQL dan empat aplikasi tidak mempunyai port host. Jangan menjalankan Compose dasar sendirian pada VPS ini karena default-nya mencoba memakai port 80/443.

Dua sertifikat mempunyai fungsi berbeda:

| Sertifikat                 | Lokasi                                                                                    | Pemakai                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Publik, Let's Encrypt      | `/etc/letsencrypt/live/tq-cmms.com/`                                                      | Browser ↔ Nginx host; renewal otomatis                                  |
| Backend lokal, self-signed | `infra/certs/tls.crt`, `tls.key`; salinan certificate di `/etc/nginx/tq-cmms/backend.crt` | Nginx host ↔ gateway Docker; dipercaya secara eksplisit oleh Nginx host |

Browser menerima sertifikat publik, bukan sertifikat backend. `proxy_ssl_verify` tetap aktif. Domain/path, origin HTTPS, dan cookie host-only tetap konsisten di seluruh aplikasi.

## 2. Kapasitas dan keputusan awal

Spesifikasi ini layak sebagai **kandidat pilot**, dengan asumsi beban awal ringan dan kapasitas terukur setelah instalasi. Angka benchmark jaringan/disk bukan pengukuran jumlah pengguna simultan aplikasi.

| Bagian                                | Batas awal override VPS                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| Auth, Portal, Bag Filter, Consumables | Masing-masing 512 MiB; heap Node 320 MiB; 0,75 CPU                 |
| MySQL                                 | 1.280 MiB; buffer pool 384 MiB; maksimum 80 koneksi; binlog 7 hari |
| Gateway / backup                      | 128 / 256 MiB                                                      |
| Migrasi / bootstrap                   | 768 / 512 MiB; job sementara                                       |
| Log Docker                            | Driver `local`, maksimum 3 × 10 MB per container, kompresi bawaan  |

Batas runtime berjumlah sekitar **3,6 GiB**, bukan reservasi RAM atau jaminan kapasitas. Layanan VPS yang sudah ada memakai sekitar 3,7 GB pada snapshot pengguna. Periksa `MemAvailable`, OOM, serta beban aktual; naikkan batas hanya setelah memastikan ruang untuk layanan lain. Batas memori runtime tidak membatasi proses BuildKit.

Build **satu image setiap kali**. Saat upgrade, gunakan maintenance dan hentikan aplikasi project selama build agar RAM tidak berebut. Sasaran awal: ≥15 GiB disk kosong sebelum build pertama, ≥8 GiB setelah deployment, dan ≥3 GiB RAM tersedia sebelum build serial. Ini adalah ambang operasional awal; hentikan dan investigasi jika tidak terpenuhi. Jangan menghapus data layanan lain untuk memenuhinya. Periksa swap yang sudah ada; menambah swap perlu keputusan kapasitas tersendiri dan tidak menggantikan RAM.

## 3. Informasi yang harus tersedia

Isi sebelum tahap yang bersangkutan, tanpa mengarang nilainya:

- IPv4 publik VPS; IPv6 hanya jika routing dan Nginx IPv6 benar-benar berfungsi.
- Akun SSH/sudo yang dipakai OpenClaw; port SSH aktual dan akses pemulihan dari panel VPS.
- Email admin bootstrap yang nyata dan nama admin.
- Email kontak ACME/Let's Encrypt yang dipantau.
- Pemilik DNS/provider serta waktu perubahan record.
- Tujuan backup di luar VPS, identitas penerima enkripsi, dan pemegang kunci pemulihan.
- Commit/release yang akan dipakai serta daftar website lama untuk smoke test sebelum/sesudah.

Tidak perlu mengirim password melalui percakapan. Generate rahasia di VPS, simpan privat, lalu serahkan melalui password manager atau kanal privat pemilik.

## 4. Preflight VPS dan perlindungan layanan lama

Perintah server dalam dokumen memakai **Bash**, bukan PowerShell. Jalankan per batch dengan penghentian saat error; jangan menempel seluruh dokumen sekaligus. Ganti contoh identitas sebelum eksekusi. Semua perubahan Nginx dibatasi pada vhost domain baru; jangan mengganti `nginx.conf`, default site, certificate website lain, atau proses OpenClaw.

```bash
hostnamectl
uname -m
free -h
df -h / /var /opt
df -i / /var
swapon --show
sudo ss -lntp
sudo systemctl is-active nginx
sudo nginx -v
sudo nginx -t
sudo ufw status verbose
sudo systemctl list-timers --all
command -v docker || true
command -v certbot || true
```

Pastikan port 18080/18443 kosong. Inventarisasi paket Docker/containerd/runc, firewall/provider security group, serta konfigurasi Nginx aktif. `sudo nginx -T` boleh dibaca lokal untuk menemukan include/site, tetapi jangan menyalin seluruh output ke laporan karena konfigurasi layanan lain bisa mengandung rahasia. Catat health/status website lama sebelum perubahan. Jika akun bukan root, pastikan sudo berfungsi; tidak perlu memasukkan OpenClaw ke grup `docker` yang setara akses root.

Backup konfigurasi Nginx dengan izin root:

```bash
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
sudo sh -c 'umask 077; tar -C /etc -czf "$1" nginx' sh "/root/nginx-before-tq-cmms-$STAMP.tar.gz"
```

Jangan mengaktifkan/reset UFW atau mengganti aturan SSH secara membabi buta. Port publik yang diperlukan project hanya 80/443 melalui Nginx host. Pertahankan port SSH dan aturan layanan lama. Docker dapat melewati sebagian aturan UFW untuk published ports; perlindungan backend di sini berasal dari binding loopback, bukan asumsi bahwa UFW menutupnya.

## 5. Instal Docker Engine dari repository resmi

Ubuntu 24.04 amd64 didukung. Gunakan Engine stabil **minimal 28** dan Compose plugin **minimal 2.24.4** (`!override` memerlukan versi tersebut). Rekam versi terpasang; jangan memasang Docker Desktop pada VPS.

Periksa dulu paket yang berkonflik (`docker.io`, `docker-compose`, `podman-docker`, `containerd`, `runc`). Jika paket tersebut sedang dipakai layanan lain, tinjau dampaknya sebelum mengubahnya. Pada kondisi VPS pengguna yang belum mempunyai Docker dan tidak mempunyai konflik:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git openssl python3 dnsutils
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
UBUNTU_SUITE=$(. /etc/os-release && printf '%s' "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
ARCH=$(dpkg --print-architecture)
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $UBUNTU_SUITE
Components: stable
Architectures: $ARCH
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
sudo docker run --rm hello-world
sudo nginx -t
```

Periksa lagi website lama setelah instalasi Docker. Tidak perlu Node.js/pnpm di host: build, migrasi, dan bootstrap memakai image repository dengan Node **26.12.1** serta pnpm **12.14.0**. Jangan mengganti versi dependency atau menjalankan auto-update paket aplikasi saat deployment.

## 6. Clone, direktori, dan release

Gunakan akun deployment non-root yang sudah disepakati; contoh ini memakai pemilik direktori berupa akun SSH aktif. Jika OpenClaw berjalan sebagai root, tetapkan akun deployment nyata terlebih dahulu, jangan tanpa sengaja menjadikan `root` sebagai identitas operasional yang dimaksud.

```bash
DEPLOY_USER=$(id -un) # pastikan ini akun deployment yang benar
sudo install -d -m 0750 -o "$DEPLOY_USER" -g "$(id -gn)" /opt/tq-cmms
git clone https://github.com/safain-commits/Plant-Area-System-v2.git /opt/tq-cmms
cd /opt/tq-cmms
git status --short
git rev-parse HEAD
```

Jika direktori sudah berisi checkout, **jangan clone ulang/menimpa**: identifikasi deployment existing dan gunakan prosedur upgrade. Catat full SHA dan pastikan CI commit/release lulus. Clone publik tidak membutuhkan personal access token. Jangan membawa `.test-runtime`, `testsprite_tests`, `.arsip`, volume database mentah, atau `node_modules` dari laptop. Data aktual dipindahkan terpisah melalui logical dump privat sesuai panduan migrasi database.

Definisikan fungsi untuk **seluruh perintah Compose produksi**; definisikan lagi jika membuka shell baru:

```bash
cd /opt/tq-cmms
dc() {
  local extra=()
  if [ -f /opt/tq-cmms/.deploy/compose.mysql-pin.yaml ]; then
    extra=(-f /opt/tq-cmms/.deploy/compose.mysql-pin.yaml)
  fi
  sudo docker compose --project-name tq-cmms \
    --env-file /opt/tq-cmms/.env \
    -f /opt/tq-cmms/compose.yaml \
    -f /opt/tq-cmms/infra/deploy/compose.vps.yaml "${extra[@]}" "$@"
}
```

Project name tetap **tq-cmms**; volume awal bernama **tq-cmms_mysql-data**. Jangan mengganti project name pada perintah berikutnya karena bisa membuat database kosong lain.

## 7. Rahasia, environment, dan certificate backend

Untuk pemulihan database lokal, gunakan generator `.env` tanpa bootstrap pada panduan migrasi database, lalu lanjutkan langkah certificate/trust di bagian ini. Jangan menimpa `.env` yang sudah disiapkan.

Contoh berikut **hanya instalasi pertama**: ia menolak menimpa `.env`. Masukkan email/nama admin aktual terlebih dahulu. `getpass` tidak diperlukan karena seluruh password digenerate lokal; script tidak mencetaknya.

```bash
cd /opt/tq-cmms
umask 077
python3 - <<'PY'
from pathlib import Path
import secrets, subprocess
email = input('Email admin bootstrap: ').strip().lower()
name = input('Nama admin: ').strip()
if '@' not in email or '.' not in email.split('@')[-1] or not name or len(name) > 100:
    raise SystemExit('Email/nama belum valid')
if any(c in email + name for c in '\r\n'):
    raise SystemExit('Input tidak boleh multi-baris')
if '\\' in email + name:
    raise SystemExit('Email/nama untuk bootstrap tidak boleh mengandung backslash')
values = {
    'PUBLIC_ORIGIN': 'https://tq-cmms.com',
    'HTTP_PORT': '18080', 'HTTPS_PORT': '18443',
    'RELEASE_TAG': subprocess.check_output(['git','rev-parse','--short=12','HEAD'], text=True).strip(),
    **{k: secrets.token_hex(32) for k in (
        'MYSQL_ROOT_PASSWORD', 'AUTH_DB_PASSWORD', 'BAG_DB_PASSWORD',
        'CONSUMABLES_DB_PASSWORD', 'AUTH_SECRET', 'SERVICE_TOKEN')},
    'BOOTSTRAP_EMAIL': email, 'BOOTSTRAP_NAME': name,
    'BOOTSTRAP_PASSWORD': secrets.token_hex(24),
}
# Quote human-entered values; generated secrets are hexadecimal and URL-safe.
def quote(v):
    return "'" + v.replace('\\', '\\\\').replace("'", "\\'") + "'"
with Path('.env').open('x') as f:
    for k,v in values.items():
        f.write(f'{k}={quote(v) if k in ("BOOTSTRAP_NAME", "BOOTSTRAP_EMAIL") else v}\n')
Path('.env').chmod(0o600)
Path('.deploy').mkdir(mode=0o700, exist_ok=True)
Path('.deploy/real-ip.conf').write_text('# Trust list will be populated after network creation.\n')
print('Environment dan placeholder Real-IP tersimpan; rahasia tidak dicetak.')
PY
```

Semua password database/secret independen. Jangan menjalankan `source .env`, mengaktifkan `set -x`, menempelkan `.env` ke laporan, atau menjalankan `docker compose config` tanpa `--quiet`/filter karena hasilnya memuat rahasia. Environment pada URL database dirakit Compose; URL database lokal di `.env.example` tidak diperlukan.

Periksa mode file dan buat sertifikat backend, tanpa menimpa key yang sudah ada:

```bash
if test -e infra/certs/tls.key || test -e infra/certs/tls.crt; then
  printf '%s\n' 'Certificate/key sudah ada; periksa sebelum melanjutkan.' >&2
  exit 1
fi
mkdir -p infra/certs
chmod 700 infra/certs
openssl req -x509 -newkey rsa:3072 -nodes -days 365 \
  -keyout infra/certs/tls.key -out infra/certs/tls.crt \
  -subj '/CN=tq-cmms.com' -addext 'subjectAltName=DNS:tq-cmms.com'
chmod 600 infra/certs/tls.key
chmod 644 infra/certs/tls.crt
sudo install -d -m 0755 /etc/nginx/tq-cmms
sudo install -m 0644 infra/certs/tls.crt /etc/nginx/tq-cmms/backend.crt
sudo install -d -m 0755 /var/lib/tq-cmms
mkdir -p backups
chmod 700 backups
dc config --quiet
```

Hentikan rangkaian jika guard `test` gagal; jangan melanjutkan perintah certificate secara manual. Key backend boleh hanya terbaca akun deployment/root, sedangkan certificate publik untuk trust Nginx host mode 0644. Simpan `.env` dan key secara terenkripsi di luar VPS untuk pemulihan; keduanya tidak masuk Git/image.

## 8. Build serial, database, migrasi, bootstrap

```bash
for service in migrate auth portal bag-filter consumables; do
  dc build "$service" || { printf 'Build %s gagal; berhenti.\n' "$service" >&2; exit 1; }
done
```

Lanjutkan hanya jika **kelima build** sukses. `migrate` menghasilkan image tools yang juga dipakai bootstrap/importer. Jangan memakai `docker compose build` paralel pada kapasitas VPS ini. Catat digest image Node/MySQL/Nginx dan image ID hasil build untuk inventaris release.

**Blok berikut hanya untuk instalasi database kosong tanpa paket data lokal.** Jika memulihkan data aktual, lanjutkan M5–M7 pada panduan migrasi: MySQL init → restore → fingerprint → migrator → pencabutan sesi → start. Jangan menjalankan bootstrap maupun start aplikasi dari blok ini sebelum restore.

```bash
dc up -d --wait --wait-timeout 180 mysql
dc up --no-deps --force-recreate --exit-code-from migrate migrate
# Periksa exit code migrasi = 0 sebelum perintah berikutnya.
dc --profile setup run --rm --no-deps bootstrap
dc up -d --no-deps --wait --wait-timeout 180 auth
dc up -d --no-deps --wait --wait-timeout 180 portal bag-filter consumables nginx backup
dc ps -a
dc exec -T nginx nginx -t
```

Migrasi membuat tiga database/schema, katalog aplikasi, dan **6 equipment / 18.784 koordinat**. Tidak membuat transaksi Bag Filter atau material demo. Consumables mulai tanpa master internal, lokasi, inventory, atau saldo. Bootstrap hanya membuat admin saat database pengguna kosong, memberi admin Portal/Bag Filter/Consumables, dan mewajibkan ganti password pertama. Menjalankan ulang bootstrap tidak mereset password existing.

MySQL, Auth, Portal, Bag Filter, Consumables harus healthy; job migrate exited 0. Gateway tidak memiliki healthcheck Docker pada Compose dasar: pastikan `nginx -t` dan pemeriksaan HTTP berikut berhasil. Jika migrasi gagal, biarkan aplikasi berhenti dan periksa log; jangan reset volume.

## 9. Real-IP dan verifikasi lokal sebelum DNS siap

Gateway harus mengenali IP klien sebenarnya untuk rate limiting/audit. Host Nginx menimpa `X-Forwarded-For` dari browser. Gateway hanya mempercayai loopback dan **alamat gateway host milik kedua network project**, bukan semua IP Docker/Internet.

```bash
{
  printf 'set_real_ip_from 127.0.0.1;\n'
  for network in tq-cmms_gateway tq-cmms_private; do
    sudo docker network inspect --format '{{range .IPAM.Config}}{{println .Gateway}}{{end}}' "$network" |
      while IFS= read -r address; do
        [ -n "$address" ] && printf 'set_real_ip_from %s;\n' "$address"
      done
  done
  printf 'real_ip_header X-Forwarded-For;\nreal_ip_recursive on;\n'
} > .deploy/real-ip.conf
dc exec -T nginx nginx -t
dc exec -T nginx nginx -s reload
```

Jika network dibuat ulang, generate ulang trust list. Periksa log untuk memastikan peer memang gateway host yang dikenal; jangan memperluas trust ke `0.0.0.0/0`. Certificate dan file Real-IP di-bind mount; sesudah mengganti file melalui rename atomik, **recreate container gateway** agar mount membaca inode baru. Menulis ulang file yang sama seperti contoh di atas lalu reload cukup untuk file trust existing.

Uji backend tanpa DNS publik dan tanpa `-k`:

```bash
curl --cacert infra/certs/tls.crt \
  --resolve tq-cmms.com:18443:127.0.0.1 -H 'Host: tq-cmms.com' \
  -sS -o /dev/null -w '%{http_code}\n' https://tq-cmms.com:18443/gateway-health
# 204
curl --cacert infra/certs/tls.crt \
  --resolve tq-cmms.com:18443:127.0.0.1 -H 'Host: tq-cmms.com' \
  -sS -o /dev/null -w '%{http_code}\n' https://tq-cmms.com:18443/auth/login
# 200
sudo ss -lntp | grep -E ':(18080|18443|3306|3000|3001|3002|3003)\b' || true
```

Yang boleh terlihat untuk project hanya **127.0.0.1:18080/18443**. Periksa juga `sudo docker port tq-cmms-nginx-1`; jangan menerima binding `0.0.0.0`/`[::]` untuk kedua port tersebut. Tidak boleh ada host port MySQL/Next. Dari mesin lain, koneksi ke `<IP_VPS>:18080/18443` harus ditolak/tidak dapat dicapai.

Sampai titik ini statusnya **STAGED_WAITING_DNS**. Domain belum siap tidak menghalangi build/database, tetapi bukan alasan mengklaim HTTPS publik sudah berfungsi. Pertahankan `PUBLIC_ORIGIN=https://tq-cmms.com`; jangan menggantinya sementara menjadi IP atau localhost.

## 10. DNS dan vhost HTTP untuk ACME

Pemilik mengatur record berikut, awalnya TTL sekitar 300 detik:

| Record | Nama                | Nilai                                                            |
| ------ | ------------------- | ---------------------------------------------------------------- |
| A      | `@` / `tq-cmms.com` | IPv4 publik VPS yang sudah dikonfirmasi                          |
| AAAA   | `@`                 | Hanya jika IPv6 VPS benar dan port 80/443 dapat dicapai via IPv6 |

Tidak memakai `www` pada rilis ini. Jangan membuat AAAA sembarang atau menambah `www` ke permintaan certificate sebelum DNS-nya tersedia. Periksa CAA bila ada; harus mengizinkan Let's Encrypt (`letsencrypt.org`). Bila provider mempunyai proxy/CDN, gunakan DNS-only dulu; CDN memerlukan tinjauan trust IP tambahan sebelum diaktifkan.

```bash
dig +short tq-cmms.com A @1.1.1.1
dig +short tq-cmms.com A @8.8.8.8
dig +short tq-cmms.com AAAA @1.1.1.1
dig +short tq-cmms.com CAA
```

Sesudah memastikan tidak ada vhost domain yang sama, pasang **hanya** file baru berikut. Contoh memakai layout Nginx Ubuntu `sites-available/sites-enabled`; jika instalasi existing memakai layout lain, gunakan include yang sudah ada tanpa mengubah layout global.

```bash
sudo install -d -m 0755 /var/www/letsencrypt/.well-known/acme-challenge
sudo install -m 0644 infra/deploy/nginx-host.http.conf /etc/nginx/sites-available/tq-cmms.com
sudo ln -s /etc/nginx/sites-available/tq-cmms.com /etc/nginx/sites-enabled/tq-cmms.com
sudo nginx -t && sudo systemctl reload nginx
printf 'tq-cmms-acme-check\n' | sudo tee /var/www/letsencrypt/.well-known/acme-challenge/tq-cmms-probe >/dev/null
curl -fsS http://tq-cmms.com/.well-known/acme-challenge/tq-cmms-probe
```

Pastikan probe memberi isi yang benar **dari jaringan luar VPS**, termasuk IPv6 jika AAAA dipasang. Root HTTP sementara memberi 503 persiapan; ini disengaja. Jika symlink/file tujuan sudah ada, inspeksi dahulu, jangan menimpa atau menambah duplikat.

## 11. Certificate publik dan aktivasi HTTPS

Gunakan Certbot/ACME client yang sudah ada bila host telah memakainya. Periksa `certbot certificates` dan timer existing; jangan memasang dua instalasi Certbot apt/snap atau mengganti certificate layanan lain. Jika belum ada, contoh jalur apt Ubuntu:

```bash
sudo apt-get install -y certbot
certbot --version
# Isi email kontak ACME nyata; bukan placeholder.
read -r -p 'Email kontak ACME: ' ACME_EMAIL
sudo certbot certonly --webroot -w /var/www/letsencrypt \
  --cert-name tq-cmms.com -d tq-cmms.com \
  --email "$ACME_EMAIL" --agree-tos --non-interactive
```

Jangan mencoba issuance produksi berulang kali sebelum DNS/probe benar; rate limit CA bukan mekanisme retry jaringan. Jika nama certificate sudah ada, tinjau cakupannya sebelum melanjutkan. Setelah issuance berhasil dan file `/etc/letsencrypt/live/tq-cmms.com/` ada:

```bash
sudo install -m 0644 infra/deploy/nginx-host.https.conf /etc/nginx/sites-available/tq-cmms.com
sudo nginx -t && sudo systemctl reload nginx
curl -fsS -o /dev/null -w '%{http_code}\n' https://tq-cmms.com/gateway-health
curl -fsS -o /dev/null -w '%{http_code}\n' https://tq-cmms.com/auth/login
```

Hasilnya 204 dan 200, tanpa `-k`. Jika `nginx -t` gagal, jangan reload; pulihkan file vhost tq-cmms HTTP yang terakhir valid. Jangan me-restart/stop Nginx host untuk mengambil certificate; webroot memakai proses yang sudah berjalan.

Renewal hook khusus certificate ini, dengan pengecekan konfigurasi:

```bash
sudo install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/50-tq-cmms-nginx >/dev/null <<'SH'
#!/bin/sh
set -eu
[ "${RENEWED_LINEAGE:-}" = /etc/letsencrypt/live/tq-cmms.com ] || exit 0
/usr/sbin/nginx -t
/usr/bin/systemctl reload nginx
SH
sudo chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/50-tq-cmms-nginx
sudo systemctl enable --now certbot.timer # hanya instalasi apt; pakai timer existing jika berbeda
sudo systemctl list-timers --all | grep -Ei 'certbot|acme'
sudo certbot renew --cert-name tq-cmms.com --dry-run
sudo env RENEWED_LINEAGE=/etc/letsencrypt/live/tq-cmms.com \
  /etc/letsencrypt/renewal-hooks/deploy/50-tq-cmms-nginx
```

Dry-run memeriksa challenge renewal. Perintah hook terakhir memverifikasi reload dengan certificate aktif; tidak memasang certificate staging. Jangan membuat jadwal duplikat bila renewal telah dikelola sistem existing.

Certificate backend 365 hari **tidak** diperbarui Certbot. Buat pengingat minimal 30 hari sebelum kedaluwarsa (`openssl x509 -checkend 2592000 -noout -in infra/certs/tls.crt`). Rotasi saat maintenance: simpan key/cert lama privat, generate pasangan baru ke file sementara, ganti file deployment dan trust host bersama, recreate gateway, uji backend, kemudian `nginx -t` dan reload host. Pulihkan keduanya jika verifikasi gagal; jangan mematikan `proxy_ssl_verify` sebagai jalan pintas.

## 12. Penerimaan publik dan akun admin

Jika maintenance domain diaktifkan saat restore/upgrade, selesaikan pemeriksaan backend/TLS terlebih dahulu, lalu hapus penandanya dengan `sudo rm -- /var/lib/tq-cmms/maintenance` untuk jendela penerimaan. Jika gagal, aktifkan kembali maintenance; jangan membuka sumber lokal lama sebelum meninjau apakah VPS sudah menerima transaksi baru.

Uji dari laptop/jaringan lain, bukan hanya dari VPS:

| Pemeriksaan tanpa sesi                                                         | Hasil yang diterima                            |
| ------------------------------------------------------------------------------ | ---------------------------------------------- |
| `http://tq-cmms.com/`                                                          | 308 menuju HTTPS domain yang sama              |
| `/gateway-health` HTTPS                                                        | 204                                            |
| `/auth/login` HTTPS                                                            | 200, certificate dipercaya browser             |
| `/`, `/bag-filter`, `/consumables`, `/consumables/stock`                       | Redirect ke login pada domain yang sama        |
| `/bag-filter/api/equipment`, `/consumables/api/inventory`                      | 401 dan `application/json`, bukan HTML         |
| `/auth/internal/session`, `/consumables/internal/locations`, `/_verify_portal` | 404                                            |
| `/auth/health/ready`, `/consumables/health/ready`                              | 404 publik; readiness diperiksa dari container |
| Port 18080/18443/3306/3000 pada IP publik                                      | Tidak terekspos                                |

Contoh API langsung, termasuk header identitas palsu:

```bash
curl -sS -D - https://tq-cmms.com/consumables/api/inventory
curl -sS -D - -H 'X-User-Role: admin' -H 'X-User-Id: forged' \
  https://tq-cmms.com/bag-filter/api/equipment
```

Keduanya tetap 401 tanpa sesi. Jangan memasukkan service token ke request publik.

Untuk instalasi kosong, pemilik mengambil email/password bootstrap melalui akses privat `.env` atau password manager, login, dan mengganti password sementara. Untuk database hasil restore, pemilik login dengan akun/password existing; tidak ada bootstrap atau pembuatan password pengganti. Jangan menampilkan password dalam laporan OpenClaw. Lanjutkan penerimaan sesuai jalur data:

1. Buka Portal → Bag Filter → Consumables tanpa login ulang; reload dan deep link tidak merusak aset.
2. Periksa enam equipment dan peta/orientasi. Instalasi kosong belum mempunyai riwayat; hasil restore wajib cocok dengan snapshot sumber.
3. Pada instalasi kosong, Consumables kosong sampai master/lokasi didaftarkan. Pada hasil restore, master/lokasi/saldo/ledger existing harus tersedia sesuai cakupan akun.
4. Tinjau pengguna serta grant sesuai equipment/lokasi melalui Kelola akses. Pertahankan izin hasil restore; admin Portal bukan otomatis operator semua aplikasi untuk akun baru.
5. Uji terang/gelap, dropdown/hover, mobile, dan logout menutup sesi di semua aplikasi.
6. Uji tindakan viewer dan scope menggunakan akun yang memang disiapkan untuk validasi, tanpa transaksi contoh pada data produksi.
7. Untuk instalasi kosong, hapus nilai `BOOTSTRAP_PASSWORD` dari `.env` setelah credential admin baru tersimpan privat. Jalur restore tidak memakai nilai ini; jangan menjalankan bootstrap ulang.

Periksa IP klien di log Nginx container setelah request publik. Bila semua klien tercatat sebagai gateway Docker, perbaiki trust list Real-IP; bila header `X-Forwarded-For` palsu dari luar mengubah IP, perbaiki overwrite header host. Cookie sesi tetap `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`.

Periksa website lama kembali. Jangan menyatakan **LIVE_ACCEPTED** sebelum certificate valid, API/path benar, backup/renewal terverifikasi, dan login/SSO diterima pemilik.

## 13. Impor Consumables: jalur privat terpisah

Bagian ini hanya untuk instalasi tanpa database hasil restore. Jika tiga database lokal sudah dipulihkan, master, lokasi, saldo dan ledger ikut paket; jangan mengimpor katalog atau mengulang saldo awal. Verifikasi data terhadap snapshot sumber.

Clone GitHub **tidak membawa katalog 17.744 material**. Pemilik harus menyediakan file JSON format katalog lama melalui transfer privat. Jangan membuat master dummy agar dashboard terlihat penuh.

Contoh file disimpan root-only di luar checkout, `/srv/tq-cmms-private/catalog.json`; catat checksum tanpa isi katalog:

```bash
sudo install -d -m 0700 /srv/tq-cmms-private
# Transfer file pemilik melalui kanal privat, set mode0600, lalu verifikasi checksum.
sudo sha256sum /srv/tq-cmms-private/catalog.json
dc run --rm --no-deps \
  --volume /srv/tq-cmms-private/catalog.json:/imports/catalog.json:ro \
  migrate exec tsx scripts/import-consumables.ts /imports/catalog.json --dry-run
# Lanjutkan apply hanya bila dry-run valid dan sumber file telah dikonfirmasi pemilik.
dc run --rm --no-deps \
  --volume /srv/tq-cmms-private/catalog.json:/imports/catalog.json:ro \
  migrate exec tsx scripts/import-consumables.ts /imports/catalog.json --apply
dc run --rm --no-deps migrate exec tsx scripts/reconcile-consumables.ts
```

Importer memvalidasi seluruh file, mengabaikan saldo/nilai finansial sumber, dan tidak membuat lokasi/inventory/transaksi. Batch/checksum sama dapat diproses ulang tanpa duplikasi; konflik master menghentikan impor. Hentikan aplikasi project saat impor bila RAM tidak cukup untuk job tools tambahan.

Admin kemudian membuat lokasi aktual, mendaftarkan material stok, mengisi rak/isi pack yang diketahui, dan mencatat saldo awal fisik termasuk nol. Penerimaan/pemakaian menunggu status saldo awal dikonfirmasi. Jangan menjalankan suite integrasi/E2E atau script reset pada database produksi.

## 14. Backup, pemulihan, dan pemantauan

### Backup harian dan salinan di luar VPS

Sidecar membuat dump tiga database, konsisten untuk tabel transaksional, memverifikasi gzip, dan merotasi file lokal 14 hari. Hindari DDL/migrasi saat dump berjalan. Jadwalnya setiap 86.400 detik sejak container start, bukan jam kalender tertentu.

```bash
dc run --rm --no-deps -e RUN_ONCE=true backup
dc logs --tail=20 backup
sudo find backups -maxdepth 1 -name 'plant-*.sql.gz' -type f -printf '%T@ %p\n' | sort -n | tail -3
```

File mode 0600 di folder backup dapat dimiliki root (container berjalan sebagai root); gunakan sudo untuk inspeksi, bukan `chmod 777`. Verifikasi `gzip -t` dan checksum; backup berisi akun/sesi/hash password sehingga bersifat rahasia. Amankan folder `backups` untuk root/akun deployment sebelum mulai.

Sebelum data operasional penting dimasukkan, tetapkan tujuan **di luar VPS ini**. Salah satu jalur konkret adalah enkripsi `age` dengan public recipient pemilik, lalu `rsync` melalui SSH ke server backup. Private key dekripsi tidak perlu ada di VPS aplikasi. Nama host/user/path berikut harus diganti dengan tujuan nyata yang sudah diverifikasi:

```bash
# Setelah age/rsync tersedia dan SSH host key tujuan diverifikasi di luar kanal ini:
sudo apt-get install -y age rsync
sudo install -d -m 0700 /srv/tq-cmms-private
sudo age -r 'AGE_RECIPIENT_PUBLIK_PEMILIK' \
  -o /srv/tq-cmms-private/plant-BACKUP_TIMESTAMP.sql.gz.age \
  /opt/tq-cmms/backups/plant-BACKUP_TIMESTAMP.sql.gz
sudo rsync -a --chmod=F600 /srv/tq-cmms-private/plant-BACKUP_TIMESTAMP.sql.gz.age \
  BACKUP_USER@BACKUP_HOST:/ABSOLUTE_BACKUP_DIRECTORY/
```

Jangan mengeksekusi placeholder. Buat jadwal offsite milik project setelah destination/kunci tersedia, misalnya systemd timer tiap 30 menit menyalin **backup terbaru yang sudah selesai**, dengan checkpoint hanya setelah upload/checksum remote berhasil. Retensi offsite terpisah dari retensi lokal; penghapusan lokal tidak boleh menghapus seluruh salinan pemulihan. Sertakan `.env`, trust/certificate backend, dan catatan release pada arsip konfigurasi terenkripsi. Rekam nama timer, script, recipient fingerprint, tujuan, dan bukti satu upload/dekripsi di laporan handover. Jika tujuan belum diberikan, tandai **BACKUP_OFFSITE_PENDING**, bukan “backup lengkap”.

### Restore drill pada database terpisah

Sebelum go-live operasional, uji salah satu backup di MySQL sementara tanpa port publik. Jangan mengimpor ke database live untuk sekadar menguji file. Contoh berikut memakai resource bernama khusus dan tidak menghapus volume produksi:

```bash
# Pilih nama backup yang benar, jangan pakai placeholder.
BACKUP_FILE=/opt/tq-cmms/backups/plant-YYYYMMDDTHHMMSSZ.sql.gz
sudo gzip -t "$BACKUP_FILE"
sudo sha256sum "$BACKUP_FILE"
umask 077
python3 - <<'PY'
from pathlib import Path
keys = {'MYSQL_ROOT_PASSWORD','AUTH_DB_PASSWORD','BAG_DB_PASSWORD','CONSUMABLES_DB_PASSWORD'}
lines = [s for s in Path('.env').read_text().splitlines() if s.split('=',1)[0] in keys]
if len(lines) != 4: raise SystemExit('Empat password database diperlukan')
Path('.deploy/restore.env').write_text('\n'.join(lines)+'\n')
Path('.deploy/restore.env').chmod(0o600)
PY
sudo docker network create --internal tq-cmms-restore-check
sudo docker run -d --rm --name tq-cmms-restore-check --network tq-cmms-restore-check \
  --memory 1280m --cpus 1 \
  --env-file /opt/tq-cmms/.deploy/restore.env \
  --mount type=bind,src=/opt/tq-cmms/infra/mysql/init.sh,dst=/docker-entrypoint-initdb.d/01-plant.sh,readonly \
  mysql:8.4
```

Jangan lanjut jika nama container/network sudah ada; tinjau run drill sebelumnya. Memori target sementara menambah sekitar 1,25 GiB: bila tidak cukup, jalankan drill di host lain atau maintenance dengan aplikasi project dihentikan.

Tunggu inisialisasi final; koneksi TCP diperlukan agar tidak menguji server sementara milik entrypoint:

```bash
for attempt in $(seq 1 90); do
  sudo docker exec tq-cmms-restore-check sh -c \
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=TCP -h 127.0.0.1 -uroot -e "USE plant_auth; USE plant_bag_filter; USE plant_consumables; SELECT 1"' \
    >/dev/null 2>&1 && break
  sleep 2
done
sudo docker exec tq-cmms-restore-check sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=TCP -h 127.0.0.1 -uroot -e "SELECT 1"'
sudo docker cp "$BACKUP_FILE" tq-cmms-restore-check:/tmp/restore.sql.gz
sudo docker exec tq-cmms-restore-check bash -c \
  'set -o pipefail; gzip -t /tmp/restore.sql.gz; gzip -dc /tmp/restore.sql.gz | MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot'
sudo docker exec tq-cmms-restore-check sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "SELECT COUNT(*) AS users FROM plant_auth.users; SELECT COUNT(*) AS positions FROM plant_bag_filter.coordinates; SELECT COUNT(*) AS batches FROM plant_bag_filter.replacement_batches; SELECT COUNT(*) AS materials FROM plant_consumables.materials; SELECT COUNT(*) AS movements FROM plant_consumables.stock_movements; SELECT COUNT(*) AS differences FROM (SELECT i.id FROM plant_consumables.inventory i LEFT JOIN plant_consumables.stock_movements m ON m.inventory_id=i.id GROUP BY i.id,i.quantity HAVING i.quantity<>COALESCE(SUM(m.quantity),0)) d;"'
```

Bandingkan jumlah akun/grant, koordinat, batch/pemasangan/audit, master/inventory, ledger/audit/idempotensi, dan saldo terhadap titik backup. `differences` harus 0. Catat durasi dan backup yang diuji; target awal **RPO harian / RTO 4 jam** perlu dibuktikan pada data aktual.

Setelah bukti tersimpan, hentikan **hanya target drill**; `--rm` membersihkan container/anonymous volume milik target tersebut:

```bash
sudo docker stop tq-cmms-restore-check
sudo docker network rm tq-cmms-restore-check
rm .deploy/restore.env
```

Untuk bencana sebenarnya, utamakan pemulihan ke VPS/volume baru: pasang release yang sesuai backup dan konfigurasi rahasia lama, jalankan MySQL kosong, import backup **sebelum** migrasi/bootstrapping aplikasi, verifikasi serta rekonsiliasi, cabut sesi hasil restore (`DELETE FROM plant_auth.sessions;` pada target pemulihan), lalu jalankan migrasi yang memang diperlukan dan buka trafik setelah smoke test. Jangan menimpa database berisi data terbaru atau menghapus volume lama tanpa keputusan pemulihan eksplisit.

### Monitoring awal

```bash
dc ps -a
sudo docker stats --no-stream
df -h / /var/lib/docker /opt/tq-cmms
sudo docker system df
dc logs --tail=80 auth portal bag-filter consumables nginx backup
sudo tail -n 80 /var/log/nginx/tq-cmms.error.log
openssl x509 -checkend 2592000 -noout -in infra/certs/tls.crt
```

Pantau uptime `/gateway-health` serta `/auth/login` dari luar, OOM/restart/unhealthy, 5xx, disk/inode, usia backup terakhir (alarm >26 jam), kegagalan offsite, dan certificate publik/backend. `/gateway-health` saja tidak membuktikan database/Auth sehat: periksa readiness container serta smoke test login. Pastikan log domain baru tercakup `/etc/logrotate.d/nginx` existing; jangan mereset kebijakan global website lain. Jangan menaruh payload, cookie, token, atau SQL/katalog pada laporan publik.

## 15. Upgrade dan rollback

Simpan SHA/tag sebelumnya, image ID, `.env` privat, backup sebelum migrasi, serta vhost/trust yang sedang dipakai. Jangan menjalankan cleanup global `docker system prune -a --volumes` atau `down -v`.

Urutan upgrade:

1. Verifikasi CI release baru, kapasitas disk/RAM, kompatibilitas migrasi, dan source checkout bersih. Catat tag lama sebelum mengganti `RELEASE_TAG`.
2. `sudo touch /var/lib/tq-cmms/maintenance`; hanya domain ini memberi 503. Hentikan project: `dc stop nginx portal bag-filter consumables auth backup`.
3. Buat backup konsisten: `dc run --rm --no-deps -e RUN_ONCE=true backup`; verifikasi file dan salinan offsite.
4. `git fetch origin`, checkout SHA release yang ditentukan; jangan `git reset --hard` untuk menutupi perubahan lokal yang belum ditinjau. File `.env`/certificate/backup tetap dipertahankan.
5. Ubah hanya `RELEASE_TAG` di `.env` menjadi SHA pendek release baru. Build kelima image satu per satu seperti tahap 8; cek masing-masing hasilnya.
6. Jalankan job migrasi dengan `dc up --no-deps --force-recreate --exit-code-from migrate migrate`. Jangan memakai container job lama melalui `start`.
7. Start berurutan `auth`, lalu `portal bag-filter consumables nginx backup` dengan `--no-deps --wait`. Tidak perlu bootstrap ulang.
8. Uji langsung backend loopback terlebih dahulu. Perbarui Real-IP bila network berubah; periksa trust certificate host jika certificate berubah.
9. Hapus maintenance **hanya jika** pemeriksaan backend sukses: `sudo rm /var/lib/tq-cmms/maintenance`. Uji HTTPS publik, login/SSO, data dan aset, serta website lama. Jika gagal, aktifkan maintenance lagi.

Rollback aplikasi yang schema-nya kompatibel: kembalikan checkout dan `RELEASE_TAG` lama, pakai image lama yang masih disimpan, lalu start layanan runtime secara berurutan menggunakan **`--no-deps`**. Jangan menjalankan migrator lama/down migration secara otomatis. Migrasi equipment yang mengubah identitas koordinat memerlukan pasangan backup/image yang sesuai; periksa [OPERATIONS.md](../OPERATIONS.md).

Jika migrasi membuat rollback aplikasi tidak kompatibel, biarkan maintenance, pulihkan backup ke target terpisah dan validasi dahulu. Menyalakan image lama saja bukan rollback data. Simpan setidaknya satu set image release sebelumnya selama jendela rollback; tinjau build cache/image yang spesifik project sebelum cleanup. Jangan menghapus image website lain atau backup untuk membuat build lolos.

## 16. Troubleshooting

| Gejala                                      | Pemeriksaan dan tindakan                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `bind: address already in use` untuk 80/443 | Pastikan fungsi `dc` menyertakan override VPS; jangan stop Nginx host                                           |
| Port backend terbuka publik                 | Hentikan gateway project, tinjau merged bindings; aktifkan kembali hanya pada loopback                          |
| 502 dari Nginx host                         | Periksa 127.0.0.1:18443, health aplikasi, certificate backend/trust/SNI, log domain; jangan disable TLS verify  |
| Redirect loop / cookie login hilang         | Origin harus `https://tq-cmms.com`; Host dan prefix utuh; upstream host memakai HTTPS18443, bukan HTTP18080     |
| API mengirim `<!DOCTYPE`                    | Periksa prefix/path dan `proxy_pass` tanpa suffix; API tanpa sesi harus JSON401                                 |
| 403 sesudah login                           | Tinjau status akun/aplikasi dan grant equipment/lokasi; jangan memalsukan header role                           |
| Consumables tidak berisi material           | Master privat belum diimpor atau daftar stok/lokasi belum di-onboard                                            |
| Rate limiting menganggap semua klien sama   | Verifikasi overwrite XFF pada host dan exact peer trust pada gateway                                            |
| ACME gagal                                  | A/AAAA/CAA, port80, webroot probe dari luar, permission, CDN/cache; jangan retry tanpa memperbaiki penyebab     |
| Unhealthy / OOM                             | `docker inspect` status OOM/restart, log, MemAvailable; hentikan build paralel dan ukur sebelum mengubah budget |
| Disk hampir penuh                           | Identifikasi cache/image/binlog/backup spesifik; verifikasi offsite; jangan prune volume/data global            |
| Migrasi berhenti                            | Simpan log error tanpa rahasia, periksa koneksi/lock/konflik; jangan reset database                             |

## 17. Bukti penyelesaian dan referensi

Laporan akhir berisi SHA/tag, versi Docker/Compose/Nginx, binding port, status layanan, domain/DNS, issuer/expiry certificate, renewal dry-run, status HTTP/API/SSO, hasil pemeriksaan website lama, backup/offsite/restore, lokasi konfigurasi, serta pekerjaan tertunda. Bedakan **STAGED_WAITING_DNS**, **PUBLIC_HTTPS_READY**, **WAITING_OWNER_FIRST_LOGIN**, dan **LIVE_ACCEPTED**. Jangan mengisi “lulus” untuk tes yang belum dilakukan.

Konfigurasi pendamping diperiksa lokal pada 24 Oktober 2026: merge Compose valid, binding hanya loopback, environment dasar tetap, dan override resource/logging diterapkan. Sebanyak 24 blok Bash lulus pemeriksaan sintaks; dua blok Python dikompilasi dan generator `.env` dijalankan pada fixture. Kedua template Nginx diuji pada container terpisah, termasuk ACME webroot, redirect, TLS backend terverifikasi, prefix/Host, penolakan header palsu, maintenance, serta penolakan certificate backend yang salah (502). Tes fixture mengganti alamat upstream lokal dengan alias backend fixture; ini bukan pengujian VPS atau sertifikat Let's Encrypt aktual. Tidak menjalankan ulang build aplikasi/tes bisnis karena source aplikasi tidak berubah.

Dokumentasi Docker, Nginx, dan Certbot diperiksa melalui Context7. Referensi primer tambahan:

- [Docker Engine pada Ubuntu](https://docs.docker.com/engine/install/ubuntu/), [binding port ke localhost](https://docs.docker.com/engine/network/port-publishing/).
- [Merge dan override Compose](https://docs.docker.com/reference/compose-file/merge/), [batas memori service](https://docs.docker.com/reference/compose-file/services/#mem_limit), [log driver local](https://docs.docker.com/engine/logging/drivers/local/).
- [Nginx HTTPS upstream](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_ssl_verify), [Real-IP trust](https://nginx.org/en/docs/http/ngx_http_realip_module.html).
- [Certbot webroot dan renewal](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot), [HTTP-01 dan port80](https://letsencrypt.org/docs/allow-port-80/).
