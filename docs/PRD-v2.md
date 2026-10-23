# PRD — Plant Area System v2

Versi 2.2 · 23 Oktober 2026 · Pemilik produk: Maintenance Tuban.
Rilis pertama: Portal, Centralized Auth, dan Bag Filter. Akun internal, Linux + Docker, satu domain dengan path per aplikasi, data aktual kosong.

## 1. Tujuan

Sediakan satu pintu login untuk aplikasi maintenance yang dapat dibangun dan diperbarui secara terpisah. Portal hanya menampilkan aplikasi aktif sesuai izin. Modul mendatang tampil sebagai rencana tanpa tautan operasional.

### Tampilan bersama (UI refresh v2)

Acuan visual aktif adalah [UI-REFRESH.md](design/UI-REFRESH.md) dan [ui-brief.jsonc](design/ui-brief.jsonc). Sidebar mengikuti tema, dapat diciutkan menjadi rail 76 px, dan menyediakan navigasi mobile. Tombol utama memakai ink, data utama lime, dan peringatan pumpkin. Dashboard, pencarian cepat, notifikasi aktivitas batch, dan timer sesi memakai data aktual sesuai scope. Tema Terang/Gelap/Sistem tersedia melalui menu ikon. Kontrak fitur, koordinat equipment, role, transaksi, dan tanggal tetap berlaku. Rincian implementasi serta pengecualian kontras ada di [UI-THEME.md](UI-THEME.md).

Grafik pemasangan menampilkan Q1–Q4 menurut tanggal pemasangan WIB, dengan pilihan tahun 2000 sampai tahun berjalan (default). Setiap kuartal dirinci menurut Brand/Pabrikan. Total dan pembanding grafik memakai tahun terpilih dan tahun kalender sebelumnya; tahun berjalan diberi keterangan parsial. KPI kondisi terkini dan distribusi umur tidak mengikuti filter tahun grafik.

## 2. Akun dan akses

- Admin portal membuat/menonaktifkan akun, mengatur role dan equipment, mereset password, serta mengaktifkan/menonaktifkan aplikasi yang telah dirilis.
- Tidak ada registrasi publik. Password sementara wajib diganti sebelum membuka portal operasional. Reset awal ditangani admin tanpa email.
- Profil mencakup nama, email akun, dan jabatan. Jabatan tidak otomatis memberikan izin.
- Login berlaku di Portal dan Bag Filter. Logout mengakhiri sesi tersebut; reset password, perubahan password, dan penonaktifan akun mencabut seluruh sesi.
- Sesi database absolut delapan jam, tanpa refresh otomatis atau cache cookie. Pemeriksaan izin membaca status akun/grant terkini.
- Perubahan akun, grant, katalog, dan transaksi mempunyai actor dan waktu server.

| Peran               | Hak                                                              |
| ------------------- | ---------------------------------------------------------------- |
| Admin portal        | Akun, status aplikasi, role, scope equipment, audit administrasi |
| Viewer Bag Filter   | Peta, umur, history, timeline                                    |
| Operator Bag Filter | Hak viewer + pemasangan/penggantian                              |
| Admin Bag Filter    | Hak operator + audit aplikasi                                    |

Semua operasi Bag Filter mengikuti scope equipment. Admin portal tidak otomatis mengabaikan scope. Bootstrap memiliki admin portal dan admin Bag Filter untuk enam equipment. Saat upgrade, hanya akun bootstrap dari audit `bootstrap.created` mendapat scope L61/L62 otomatis; pengguna lain diatur melalui Kelola akses. Admin aktif terakhir tidak boleh dinonaktifkan/dicabut perannya.

## 3. Bag Filter

| Equipment | Kompartemen | Posisi |
| --------- | ----------: | -----: |
| 561-BF1   |          24 |  3.264 |
| 562-BF1   |          24 |  3.264 |
| 421-BF1   |          30 |  4.080 |
| 422-BF1   |          30 |  4.080 |
| L61-BF1   |          16 |  2.048 |
| L62-BF1   |          16 |  2.048 |

Total 18.784 posisi bag. Konfigurasi peta mengikuti equipment, dengan nomor baris di sebelah kiri overview dan detail:

| Equipment | Sisi atas / bawah | Kompartemen kiri → kanan | Kolom kiri → kanan | Baris atas → bawah |
| --------- | ----------------- | ------------------------ | ------------------ | ------------------ |
| 561/562   | Utara / Selatan   | 1–12 / 24–13             | H–A                | 17→1 / 1→17        |
| 421/422   | A / B             | 1A–15A / 1B–15B          | A–H                | 17→1 / 1→17        |
| L61/L62   | Timur / Barat     | 1–8 / 16–9               | A–H                | 16→1 / 1→16        |

561/562 dan 421/422 memiliki 8 × 17 = 136 bag per kompartemen; L61/L62 memiliki 8 × 16 = 128. Jeda visual memakai margin tanpa garis pembatas: antara baris 9 dan 10 pada 561/562 serta 421/422, serta antara baris 8 dan 9 pada L61/L62 (penanda plat stiffener). Jeda tampil pada overview dan detail, mengikuti orientasi setiap sisi, tanpa menambah koordinat. Label kolom/kompartemen overview seluruh equipment menghadap bagian tengah sesuai form manual. Pada sisi bawah (Selatan, B, dan Barat), label kolom berada tepat di bawah nama kompartemen, sebelum grid bag.

`422-BF1` adalah kode yang benar; `422-BF2` hanya merupakan nama lama dalam audit baseline dan migrasi, bukan alias operasional. Upgrade mempertahankan ID, tanggal, actor, batch, serta posisi fisik transaksi; Utara/Selatan lama pada 421/422 menjadi A/B dengan nomor lokal dan indeks kolom tetap.

- Tema netral light/dark sesuai UI refresh v2; pilihan double ring dan tanda centang tanpa mengubah warna umur; posisi tanpa pemasangan abu-abu. Overview seluruh kompartemen, detail dengan target sentuh minimal 44 px dan scroll internal di mobile.
- Umur berjalan 24/7 sejak pemasangan. Skala warna 0–900 hari, dijenuhkan setelah 900 hari; umur tampilan diperbarui setiap 60 detik.
- Satu batch: 1–500 posisi unik dalam satu equipment, boleh lintas kompartemen/sisi.
- Tanggal dan alasan wajib; alasan 1–500 karakter, WO opsional maksimal 100 karakter.
- Brand/Pabrikan wajib dipilih sebelum kolom alasan: `Intensiv filter (Original)`, `Filtras`, `Cipta Medya`, atau `Other`. Form dimulai tanpa pilihan dan kembali kosong setelah berhasil disimpan. Satu brand berlaku untuk seluruh posisi dalam batch dan tampil di history, timeline, serta audit. Catatan lama ditampilkan “Belum tercatat”; tidak diisi default brand.
- Input diberi label WIB. Penyimpanan UTC, tampilan Asia/Jakarta. Tanggal minimal `2000-01-01T00:00:00Z`, maksimal waktu server +60 detik.
- Tanggal mundur diperbolehkan. Kondisi terkini berdasarkan tanggal pemasangan, kemudian ID pemasangan sebagai pembeda waktu sama.
- Seluruh history dipertahankan. Timeline menghitung masa pakai hingga pemasangan berikutnya, termasuk interval nol pada waktu yang sama.
- Setiap penyimpanan punya UUID batch meskipun WO kosong. Cari berdasarkan WO, alasan, tanggal WIB (`YYYY-MM-DD`), atau koordinat seperti `18 B1`.
- History server 50 record per halaman. Tidak memuat stok atau master material.
- Produksi mulai kosong. Data pengujian hanya berada pada deployment/database pengujian terpisah.

## 4. Arsitektur dan kontrak

Monorepo pnpm, tiga Next.js App Router + TypeScript dengan output standalone dan React bawaan Next.js.

| Aplikasi   | Prefix        | Database                             |
| ---------- | ------------- | ------------------------------------ |
| Portal     | `/`           | Tidak mengakses database operasional |
| Auth       | `/auth`       | `plant_auth`                         |
| Bag Filter | `/bag-filter` | `plant_bag_filter`                   |

Nginx mempertahankan prefix `basePath`. Navigasi antar aplikasi memakai dokumen penuh. Hanya Nginx membuka port publik; aplikasi dan MySQL berada di jaringan internal. SSO memakai sesi satu domain; OIDC/SAML merupakan tahap berikutnya.

Baseline dikunci di manifest/lockfile: Node 26.12.1, Next.js 16.4.2, React 19.3.1, Better Auth 1.7.12, Drizzle ORM 0.45.4, Drizzle Kit 0.31.11, mysql2 3.24.6, pnpm 12.14.0. Database MySQL 8.4 LTS. Node 26 masih Current pada tanggal baseline; jadwal LTS 28 Oktober 2026.

Better Auth memakai adapter Drizzle/MySQL. Cookie host-only, Secure, HttpOnly, SameSite=Lax, Path=/. Nginx `auth_request` memeriksa sesi/aplikasi, dan server/API kembali meminta identitas kepada Auth lewat token layanan internal. Header identitas browser dihapus dan tidak dipercaya. Endpoint internal diblokir di gateway. Auth gagal dihubungi menutup akses dengan 503. API memberikan JSON 401/403, bukan HTML login. Tujuan kembali setelah login divalidasi.

Origin wajib cocok untuk operasi tulis. Login dibatasi 10 kegagalan per akun/IP selama 15 menit melalui tabel database dengan lock transaksi. Endpoint bawaan Better Auth yang dipublikasikan hanya sign-in dan sign-out; endpoint pengelolaan khusus memakai guard sendiri.

Kontrak HTTP lengkap ada di `API.md`. Payload batch: `equipmentCode`, `positions`, `installedAt`, `brand`, `reason`, `wo?`. Actor ditentukan server. Header `Idempotency-Key` wajib, 8–128 karakter; sama actor/key/payload mengembalikan batch semula, payload berbeda 409. Batch, seluruh pemasangan, dan audit atomik. Nama actor disimpan sebagai snapshot, tanpa foreign key antar database.

## 5. Operasional dan penerimaan

- Migrasi SQL direview dan dijalankan sebagai job terpisah dengan kredensial DDL. Akun runtime hanya DML pada databasenya sendiri.
- Health/readiness check, log tanpa password/token, backup harian retensi 14 hari, restore teruji.
- Target pilot RTO empat jam; RPO sejak backup harian terakhir. Simpan image sebelumnya untuk rollback; perubahan awal tidak merusak kontrak database aplikasi sebelumnya.
- Penerimaan mencakup SSO/logout/expiry/reset/deactivation; viewer dan equipment scope; gateway/deep link/aset/fail-closed; koordinat/orientasi; umur/tanggal mundur/waktu sama; 500 posisi/penolakan501/rollback; retry/concurrency; desktop/mobile/error/kosong; restart dan restore.
- Deployment produksi memerlukan hostname, sertifikat organisasi, rahasia unik, operator backup, dan validasi di server target. Hasil lokal tidak menggantikan uji penerimaan operator.

## 6. Di luar rilis

Approval transaksi, koreksi/pembatalan melalui UI, impor Sites/Excel, SAP, telemetry, mobile native, dan implementasi modul lain. Tidak ada data operasional lama yang dimigrasikan.

## Referensi dokumentasi

Dokumentasi diperiksa melalui Context7 (`/vercel/next.js`, `/better-auth/better-auth`, `/drizzle-team/drizzle-orm-docs`, `/websites/nginx_en`) dan implementasi package yang dipin. Rujukan: [Next.js Multi-Zones](https://nextjs.org/docs/app/guides/multi-zones), [Better Auth sessions](https://better-auth.com/docs/concepts/session-management), [Drizzle MySQL](https://orm.drizzle.team/docs/get-started-mysql), [Nginx auth_request](https://nginx.org/en/docs/http/ngx_http_auth_request_module.html), [Node release schedule](https://github.com/nodejs/Release/blob/main/schedule.json).
