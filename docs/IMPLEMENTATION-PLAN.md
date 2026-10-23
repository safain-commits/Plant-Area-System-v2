# Rencana implementasi v2

Baseline: PRD v2, 22 Oktober 2026. Source ekspor dipertahankan sebagai referensi, bukan fondasi deployment baru.

| Tahap          | Hasil konkret                                                                           | Kriteria selesai                                                                  |
| -------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1. Dokumentasi | Audit, PRD v2, rencana, kontrak API                                                     | Lingkup dan batas migrasi terdokumentasi                                          |
| 2. Fondasi     | pnpm workspace, 3 Next.js, package bersama, Node 26, Compose, Nginx, MySQL, migrasi, CI | Typecheck/build masing-masing aplikasi dan migrasi database lulus                 |
| 3. Auth/Portal | Bootstrap, login, ganti password, profil, grant/scope, katalog, admin, audit            | SSO, pencabutan sesi, pembatasan role/equipment, origin dan gateway lulus         |
| 4. Bag Filter  | Konfigurasi map, snapshot, batch/timeline/audit, UI, validasi, idempotensi              | Koordinat, tanggal mundur, waktu sama, batch500, rollback, pagination/retry lulus |
| 5. Pilot       | Browser desktop/mobile, persistence restart, backup/restore, runbook                    | Bukti di VALIDATION.md; uji operator dan deployment server organisasi             |

## Struktur implementasi

- `apps/portal`: katalog, profil, admin. Proxy API administrasi ke Auth.
- `apps/auth`: Better Auth, pengelolaan akun/grant/katalog, endpoint internal.
- `apps/bag-filter`: UI dan API operasional khusus Bag Filter.
- `packages/contracts`: konfigurasi equipment, identitas/izin, validasi, koordinat, waktu.
- `packages/auth-core`, `packages/bag-core`: schema, koneksi, transaksi, query, migrasi.
- `packages/server`: guard, validasi origin/body, kegagalan aman, komunikasi internal.
- `packages/ui`: shell, tema bersama, logout.
- `infra`, `scripts`: deployment, migrasi/bootstrap, backup, lingkungan dan uji operasi.
- `tests`: unit domain, integrasi MySQL, browser melalui gateway.

## Keputusan implementasi

Tidak ada database atau lampiran live yang diimpor. Instalasi baru mengisi katalog aplikasi serta 18.784 koordinat untuk enam equipment. Upgrade katalog mempertahankan data operasional, merename 422-BF2, dan mengoreksi label 421/422 melalui migrasi data transaksional. Akses aplikasi dapat dinonaktifkan global tanpa menghapus grant. Bag Filter memakai SQL window function melalui Drizzle untuk snapshot/timeline; operasi tulis tetap melalui transaksi Drizzle. Kredensial Auth dan Bag Filter dipisahkan.

Satu key idempotensi berlaku per actor; retry identik harus memakai key yang sama. UI mempertahankan key ketika hasil penyimpanan belum diketahui dan payload tidak berubah. Response berhasil mengosongkan pilihan sebelum memuat ulang map, sehingga kegagalan refresh tidak menimbulkan transaksi kedua.

## Pekerjaan setelah validasi lokal

1. Operator memeriksa orientasi enam equipment terhadap kondisi lapangan, termasuk sisi A/B dan Timur/Barat serta stiffener L61/L62.
2. Administrator menyediakan hostname LAN/VPN, sertifikat, rahasia, server, dan lokasi backup di luar server utama.
3. Deploy dari database kosong, ubah password bootstrap, buat akun/role/scope operasional.
4. Jalankan smoke test SSO, satu batch uji yang disepakati, dan restore drill di server terpisah.
5. Catat durasi pemulihan untuk menilai target empat jam dan tetapkan penanggung jawab backup.

Implementasi modul berikutnya dimulai dari audit khusus, tanpa menambahkan tabel/modulnya ke Bag Filter.
