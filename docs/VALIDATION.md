# Hasil validasi implementasi v2

Tanggal: 22 Oktober 2026. Lingkungan: host Windows dengan Node26.12.1, container Linux Node26.12.1, MySQL8.4.13, Nginx1.30.6, dan Chromium156 melalui Playwright1.64.1. HTTPS localhost8443 memakai sertifikat pengujian. Project Compose: `plant-v2-test`; database dan volume terpisah dari deployment produksi.

## Pemeriksaan yang lulus

| Area                 | Bukti                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Integritas referensi | Seluruh359 file ekspor lulus checksum; source dan PRD lama tidak diubah                                                      |
| TypeScript           | Root packages/scripts/tests serta ketiga aplikasi lulus typecheck                                                            |
| Build                | Portal, Auth, Bag Filter berhasil build Next.js standalone di Node26; image Linux masing-masing berhasil dibuat dan berjalan |
| Database             | Migrasi kedua database berhasil, dapat dijalankan ulang; seed14.688 koordinat tanpa transaksi produksi                       |
| Unit domain          | 6 tes: koordinat/balik Selatan, umur/warna, WIB/batas tanggal, validasi/canonical payload, izin, redirect aman               |
| Integrasi MySQL      | 10 sub-skenario, seluruhnya lulus (11 hasil termasuk parent test)                                                            |
| Browser gateway      | Alur terpadu SSO/akun/Bag Filter/admin lulus; tidak ada JavaScript page error                                                |
| Persistence          | Jumlah akun, sesi, batch, pemasangan, audit, koordinat sama setelah restart MySQL/Bag Filter                                 |
| Auth tidak tersedia  | Portal, Bag Filter, serta API keduanya memberi503 saat Auth dihentikan                                                       |
| Guard internal       | Pemanggilan langsung API Bag Filter dengan header identitas palsu ditolak401; internal Auth tanpa token ditolak403           |
| Backup/restore       | Dump harian dipulihkan ke container MySQL baru; jumlah enam kelompok data sama                                               |

## Cakupan pengujian

Integrasi menguji batch500, penolakan501/duplikat/koordinat salah, lima retry bersamaan menjadi satu batch, konflik payload409, kegagalan audit yang membatalkan seluruh transaksi, tanggal mundur, waktu sama, 55 batch bersamaan pada satu koordinat, kondisi terkini deterministik, grouping WO kosong, pencarian koordinat, dan pagination50 tanpa kehilangan record.

Autentikasi menguji password sementara wajib diganti, cookie Secure/HttpOnly/Lax/Path=/ tanpa Domain, sesi absolut delapan jam tanpa refresh, perubahan grant berlaku langsung, expiry, logout, deaktivasi, reset, pembatasan10kegagalan per akun/IP, reset bersamaan dengan login, serta12login paralel melebihi ukuran pool pengelolaan.

Browser memeriksa tujuan kembali dengan query lengkap, deep link/reload/aset, endpoint internal termasuk path terenkode, penolakan signup publik dan origin asing, halaman akun sementara, portal ke Bag Filter tanpa login ulang, kondisi equipment30kompartemen kosong, simulasi error history dan tombol retry, pemilihan lintas Utara/Selatan menjadi satu batch tanpa WO, pencarian history, viewport desktop1440 dan mobile390 tanpa scroll horizontal, izin viewer/operator/scope, penonaktifan aplikasi/akun, serta logout pada dua aplikasi. Screenshot login, portal, map desktop dan detail mobile ditinjau secara visual.

## Perbaikan yang ditemukan melalui tes

- Konversi raw DATETIME Drizzle harus eksplisit UTC; parsing sebagai waktu host WIB menggeser timeline/cursor tujuh jam.
- Redirect Nginx relatif harus mempertahankan port HTTPS pengujian. `absolute_redirect off` dan tujuan kembali terenkode mempertahankan deep link/query.
- Transaksi login tidak boleh mengunci user selama adapter Better Auth membuat sesi dalam transaksi berbeda. Pemeriksaan hash/status dilakukan kembali setelah login native, dengan lock yang mengurutkan reset/deaktivasi.
- Pool adapter Better Auth dipisahkan dari pool transaksi pengelolaan agar login paralel tidak menghabiskan koneksi untuk transaksi bersarang.
- Syntax JSX dan pengetikan filter katalog diperbaiki saat typecheck awal.

## Batas hasil

Ini validasi implementasi lokal, bukan persetujuan go-live di server organisasi. Workflow `.github/workflows/ci.yml` tersedia dan rangkaian perintahnya dijalankan lokal. Hasil GitHub Actions perlu diperiksa setelah push.

Belum dilakukan load test skala produksi, browser selain Chromium, integrasi sertifikat/hostname organisasi, atau uji operator di lapangan. Target pemulihan empat jam perlu diukur ulang menggunakan volume data produksi. Backup lokal sudah diuji; penyalinan terenkripsi ke storage organisasi di luar host tetap merupakan tugas deployment.

Setelah validasi, preview lokal dikembalikan ke kondisi awal melalui script khusus database uji: satu admin bootstrap, seluruh grant bootstrap, dan tanpa transaksi pemasangan. Screenshot/laporan pengujian menggambarkan data fixture saat tes berjalan, bukan data operasional.

## Reproduksi

Ikuti README untuk menyiapkan database/bootstrap/gateway, kemudian:

```sh
pnpm typecheck
pnpm test
node --env-file=.test-runtime/host.env --import tsx --test --test-concurrency=1 tests/integration/*.test.ts
pnpm test:e2e
node --env-file=.test-runtime/host.env --import tsx scripts/test-operations.ts
pnpm check:export # opsional bila arsip tersedia di workspace lokal
```

Jangan menjalankan tes browser dan operasi secara bersamaan karena tes operasi sengaja menghentikan dependency.
