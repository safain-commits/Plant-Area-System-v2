# Identitas TQ-CMMS

Kedua SVG asli adalah sumber artwork; bentuk/path tidak diubah saat diadaptasi ke UI:

- `logo-full-sedebar-expanded.svg`: sidebar expanded, form login dan halaman ganti password.
- `logo-sidebar-colapse-and-favicon.svg`: sidebar collapsed dan favicon empat aplikasi.

Komponen bersama `BrandLogo` berada di `packages/ui/src/brand.tsx`. Artwork UI menggunakan `currentColor` dari token teks: gelap pada light mode dan terang pada dark mode. Aksen menggunakan `--primary-400`. Logo di panel hero login memakai versi satu warna gelap agar terbaca pada latar lime. Link pembungkus memberi nama aksesibel, sementara SVG dekoratif disembunyikan dari screen reader.

Setelah memperbarui file sumber, jalankan dari root repository:

```sh
pnpm brand:generate
node scripts/generate-brand.mjs --check
```

Generator menghasilkan `packages/ui/src/brand-artwork.ts` dan `apps/*/public/favicon.svg`, membuang XML DTD, metadata editor, ID, dan atribut yang tidak dibutuhkan. Commit file sumber serta hasil generator bersama. CI memeriksa kesesuaiannya. Tidak ada font, permintaan resource eksternal atau dependency baru.

Metadata setiap aplikasi memakai favicon pada prefix masing-masing dan revision hash untuk memperbarui cache browser. Nginx mengizinkan hanya jalur favicon SVG tersebut sebelum login. SVG favicon mengikuti `prefers-color-scheme` browser/OS; preferensi tema manual halaman tetap berlaku pada logo UI. Favicon tidak memerlukan sesi atau akses ke aplikasi lain.

Perubahan logo merupakan pembaruan source empat aplikasi dan gateway. Untuk VPS, gunakan alur rilis biasa: build image baru dari SHA yang direview, perbarui keempat aplikasi serta konfigurasi gateway, jalankan `nginx -t` sebelum reload, lalu periksa login, sidebar dan favicon. Tidak ada migrasi database. Runtime lokal development memakai hot reload.
