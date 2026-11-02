# Rencana implementasi Consumable Room v1.1 — R22

Tanggal: 2 November 2026. Baseline: `30df358`.
Status: **Disetujui 2 November 2026. Fase 1–4 selesai; Fase 5 dalam pengerjaan**.

Acuan kebutuhan: [brief revisi R22](../CONSUMABLE-ROOM-R22-REVISION-PROMPT.md), PRD Consumable Room, kontrak API, dan design system aktif. Keputusan K1–K4 pada brief tetap berlaku. R22 memakai aplikasi `/consumables` yang sudah ada.

## 1. Hasil pemeriksaan

Empat slide `ref-client/R22 Business Process.pptx` telah diekstrak dan dirender dengan LibreOffice dalam container sementara. Diagram, contoh picklist, dan ketiga mockup diperiksa secara visual. Sumber asli tidak diubah; hasil render disimpan privat di `.deploy/r22-review/`.

Diagram membedakan penerimaan dari Warehouse, Consume Order, dan Return Order. Label “Create Receive Order” pada slide 3 mengacu pada Return Order. Mockup menegaskan pencarian dengan saldo, modal jumlah, keranjang, lalu finalize. Tampilan implementasi mengikuti UI TQ-CMMS saat ini.

| Bagian source           | Hasil audit dan dampak                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema.ts` dan migrasi | Baru ada master, inventory, ledger, audit, impor, dan idempotensi satu movement. Migrasi terakhir `0001`; revisi berikutnya `0002_*`.                                                     |
| `postMovement`          | Fixed-point, audit atomik, retry, dan izin sudah tersedia. Urutan lock saat ini material → lokasi → inventory perlu diselaraskan dengan penulis stok lain.                                |
| Kontrak dan API         | Belum ada dokumen, return, HEC, alias, atau dua satuan. Serializer error saat ini hanya membawa pesan/kode, sehingga konflik per baris memerlukan penanganan khusus di route Consumables. |
| Workspace Consumables   | Form satu-item dan `MaterialPicker` dapat menjadi referensi. Form order baru perlu dipecah menjadi komponen tersendiri agar pengelolaan saldo awal/koreksi tetap jelas.                   |
| UI bersama              | Sidebar, ringkasan, notifikasi, dan pencarian cepat masih memakai movement serta tautan `history?movement=...`. Semuanya perlu menerima dokumen R22.                                      |
| Tests dan smoke         | Fixture lama memakai `/issues`, `/receipts`, menu lama, dan empat seri chart. Fixture, cleanup FK, serta fingerprint backup perlu mengikuti entitas baru.                                 |
| Sumber privat           | `ref-client/` sudah diabaikan Git, tetapi belum diabaikan Docker. Tambahkan pengecualian sebelum build berikutnya karena Dockerfile memakai `COPY . .`.                                   |

## 2. Urutan pekerjaan dan file

Setiap fase implementasi mempunyai commit tersendiri dan pemeriksaan sebelum lanjut. Fase 6/QR tetap opsional dan tidak termasuk pekerjaan inti ini.

| Fase                                | Perubahan dan file utama                                                                                                                                                                                                                                                                                               | Syarat sebelum lanjut                                                                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Data dan contracts**           | `packages/consumables-core/src/schema.ts`, `migrations/0002_*`, snapshot/journal; `packages/contracts/src/consumables.ts`; `tests/unit/consumables.test.ts`; `.dockerignore`. Tambah dokumen/sekuens, metadata satuan/alias, snapshot ledger, HEC, konversi, izin `return`/`onbehalf`, dan canonical payload.          | Review SQL, typecheck, unit HEC/presisi/izin/idempotensi, serta uji upgrade schema v1 pada MySQL disposable.                                                       |
| **2. Core dan API**                 | Pisahkan logika dokumen/pencarian ke modul pada `packages/consumables-core/src/`; integrasikan melalui `index.ts`; perbarui `apps/consumables/app/api/[...path]/route.ts`; tambah integration test dokumen/migrasi. Endpoint dokumen, search, catalog-search, HEC, replay, konflik baris, dan 410 untuk dua POST lama. | Atomicity, konflik seluruh baris, concurrency, K3, nomor dokumen, role/scope, dan rekonsiliasi lulus. Typecheck Portal/UI tetap harus lulus saat kontrak berganti. |
| **3. UI Consume/Return**            | Komponen baru `order-cart`, pencarian, modal jumlah, penyimpanan keranjang, serta route bukti di `apps/consumables/app/`; hubungkan dari `workspace.tsx`, `[section]/page.tsx`, dan `next.config.ts`; navigasi pada `packages/ui/src/workspace.tsx`.                                                                   | Alur self-service/cashier, restore keranjang, error 409, redirect 308 beserta query, keyboard, hover, dan dismissal modal/dropdown lulus.                          |
| **4. Picklist, master, integrasi**  | Komponen picklist, editor master, tab dokumen/ledger; `packages/ui/src/stock-summary.tsx`, `stock-activity.tsx`, `consumables.css`, serta adapter notifikasi/pencarian di `workspace.tsx`; label pada `apps/portal/app/admin/workspace.tsx`.                                                                           | Picklist 20 baris, konversi/snapshot, auto-enroll, reservasi berulang, chart dokumen, dan ringkasan Portal lulus pada kedua tema.                                  |
| **5. CLI, operasional, penerimaan** | `scripts/import-consumables-naming.ts`, modul parser/import naming, `src/import.ts`, `package.json`; tests unit/integrasi/E2E; `scripts/smoke-dev.ts`, fingerprint `scripts/test-operations.ts`; PRD v1.1, API, PRD-v2, README, OPERATIONS, dan VALIDATION.                                                            | Format, typecheck, unit, integrasi MySQL, build empat aplikasi, browser desktop/mobile, upgrade dan backup/restore lulus sesuai lingkungan yang benar-benar diuji. |

Perubahan bentuk respons dashboard/discovery memerlukan penyesuaian konsumen dan fixture dalam fase yang sama, supaya setiap commit tetap dapat diperiksa. Perilaku Auth, sesi, gateway, serta peta Bag Filter tetap mengikuti baseline; penyesuaian logout hanya membersihkan draft R22 setelah sign-out berhasil.

## 3. Migrasi `0002` dan kompatibilitas

1. **Preflight:** inventarisasi master yang memiliki `pack_size`, saldo pecahan pada satuan hitung, serta material yang satuannya sudah terkunci transaksi. Laporkan kandidat yang perlu peninjauan konversi; jangan menebak isi kemasan atau mengubah saldo.
2. **Generate dan review:** gunakan `pnpm db:generate:consumables` dengan Drizzle Kit yang dipin. Pertahankan `0000`/`0001`. Tambahan pada tabel lama mempunyai default atau nullable. Buat `stock_documents`, `stock_document_sequences`, index/FK, kolom dokumen/SAP pada ledger, serta idempotensi yang dapat menunjuk movement atau dokumen.
3. **Backfill metadata saja:** `sap_unit = unit`, alias kosong, dan `decimal_allowed` menurut `COUNT_UNITS`. Jangan mengubah `unit`, `pack_size`, quantity, ID, waktu, actor, atau ledger historis. Saldo pecahan lama tetap terbaca meskipun kebijakan input baru membatasi bilangan bulat.
4. **Constraint:** tepat satu target idempotensi, nomor dokumen unik, dan urutan baris dokumen konsisten. Opening nol otomatis pada K3 menjadi ledger pendukung; tidak menambah `line_count` atau tampil sebagai item kedua dalam bukti picklist.
5. **Snapshot:** transaksi baru menyimpan nama umum yang dicetak, deskripsi SAP, satuan R22/SAP, input SAP, dan faktor. Tambahan snapshot nama umum dibuat nullable untuk riwayat lama; cetak dokumen tidak berubah mengikuti edit master berikutnya.
6. **Uji upgrade:** buat fixture v1 dengan movement/idempotensi/pack lama, terapkan `0002`, periksa ulang nilai historis dan rekonsiliasi, lalu jalankan migrator kembali. Uji juga instalasi kosong. DDL MySQL tidak dianggap satu transaksi rollback; kegagalan sebagian harus diperiksa sebelum kelanjutan migrasi.

Untuk deployment, hentikan penulisan, ambil backup terverifikasi, terapkan migrasi, lalu perbarui aplikasi yang mengonsumsi kontrak bersama. Konsistensi saldo menjadi checkpoint sebelum penulisan dibuka kembali. Rencana ini tidak menjalankan perubahan pada VPS.

Schema aditif menjaga kolom untuk image lama. Namun image v1 belum memahami movement `return`, dokumen, atau arti konversi baru. **Setelah transaksi R22 dimulai, rollback tidak boleh sekadar menyalakan writer v1.** Hentikan penulisan dan gunakan rilis R22 kompatibel atau perbaikan maju; jangan menjalankan down migration atau restore yang membuang transaksi baru.

## 4. Aturan inti implementasi

- `createDocument` memvalidasi payload, tindakan, dan scope sebelum replay. Consume/return maksimal 50 item unik; picklist 100. Qty seluruhnya string desimal dan aritmetika `bigint`.
- Lock konsisten: lokasi → seluruh material menurut ID → inventory menurut ID → idempotensi → sekuens. Selaraskan `postMovement` saldo awal/koreksi dan `saveInventory`; retry hanya untuk deadlock/lock-timeout yang dikenali.
- Pemeriksaan seluruh baris dilakukan sebelum write. Konflik 409 menyertakan `lineNo`, material/MMID, stok tersedia, jumlah diminta, serta alasan yang dapat ditampilkan pada keranjang. Penanganan error terstruktur dibatasi pada API Consumables.
- Nomor `R22-CO/RO/PL-YYYY-000001` dibuat server dalam transaksi dengan tahun WIB. Replay tidak mengambil nomor baru; rollback tidak menyisakan dokumen/ledger/nomor yang terpakai sebagian.
- Picklist memakai master aktif; auto-enroll hanya jika inventory benar-benar belum ada. Inventory existing yang belum dihitung tetap ditolak. Nomor reservasi sama diperbolehkan, dengan daftar dokumen sebelumnya sebagai peringatan.
- Pratinjau faktor bukan sumber perhitungan server. Form menyertakan versi master yang ditinjau pada baris konversi SAP; perubahan konfigurasi menghasilkan konflik sebelum submit diterapkan. Detail tambahan kontrak ini didokumentasikan bersama endpoint.
- Nama peminta self selalu dari sesi. Input `requester` oleh operator ditolak 403. Cashier/admin boleh mengisi nama dan NIK sesuai K1 tanpa mengubah actor audit.
- HEC consume/return mengikuti normalisasi tunggal contracts. FL picklist disimpan utuh sebagai snapshot; kode HEC hanya diturunkan bila kode valid dapat dikenali, tanpa menolak deskripsi FL SAP yang lebih panjang.

## 5. UI, riwayat, dan penamaan

- Satu komponen `OrderCart` melayani Consume/Return. Header HEC/WO/peminta, search bersaldo, modal qty, edit/hapus item, confirmation, serta layar sukses/bukti mengikuti token dan primitive UI saat ini.
- Draft terpisah menurut user/tipe/lokasi pada `sessionStorage`, termasuk payload dan key retry. Pulihkan dengan validasi ulang scope/master; bila storage ditolak, form aktif tetap berjalan. Pergantian tema dan penutupan overlay mempertahankan draft. Sign-out berhasil membersihkan draft R22 tanpa menghapus preferensi browser.
- Ganti lokasi dengan keranjang berisi item memerlukan penanganan draft per lokasi yang jelas; jangan memindahkan saldo/item dari lokasi sebelumnya. Satu lokasi aktif terpilih otomatis, tanpa selector.
- Pencarian diurutkan MMID persis, prefiks MMID, nama umum/alias, lalu deskripsi; token AND dan escape wildcard tetap berlaku. Saran HEC dan saldo hanya dari lokasi dalam scope. Combobox menutup pada klik luar/Escape, mempunyai active descendant, dan tidak membuka ulang modal MMID tanpa input baru.
- Bukti `/consumables/documents/[id]` memeriksa scope di server, memakai snapshot, menampilkan waktu WIB dan tanda tangan, serta stylesheet cetak A4. Mode thermal tetap opsional.
- Riwayat default Dokumen; tab Pergerakan stok mempertahankan seluruh data v1 dan filter lama. `issue`/`receive` menjadi 308 menuju `consume`/`picklist`, termasuk parameter material/lokasi.
- Chart baru menghitung dokumen consume/return/picklist serta movement opening/adjustment. Movement issue/receipt v1 tanpa dokumen tetap ada pada ledger; beri penjelasan cakupan chart dan jumlah legacy bila ada, tanpa menggandakan atau mengarang dokumen historis.
- Notifikasi dan command palette memakai nomor dokumen/HEC/peminta serta tautan `history?document=...`. Kegagalan satu aplikasi tetap tidak menghilangkan hasil aplikasi lain.
- Naming CSV mendukung UTF-8/BOM dan CSV berpetik, termasuk alias dengan koma. Kolom kosong tidak mengubah nilai; seluruh file divalidasi, dikunci deterministik, dan diterapkan atomik dengan audit serta kenaikan versi hanya untuk perubahan aktual. MMID tidak dikenal atau perubahan satuan yang sudah dipakai menghentikan seluruh file.

## 6. Risiko yang perlu dicatat

| Risiko                                            | Penanganan                                                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Makna `packSize` lama berbeda dari konversi SAP   | Preflight daftar kandidat; pertahankan data lama dan wajibkan peninjauan konfigurasi. Jangan memakai faktor legacy yang ambigu sebagai konversi terverifikasi.                  |
| Satuan SAP lama sudah digunakan transaksi         | CLI/editor tetap menolak perubahan `unit`; tidak melakukan konversi saldo historis otomatis. Kebutuhan perubahan satuan atas stok existing memerlukan tindak lanjut tersendiri. |
| Chart baru berbeda dari hitungan transaksi v1     | Label cakupan dan legacy count menjelaskan perbedaan; semua ledger lama tetap dapat dicari.                                                                                     |
| API lama 410 memutus form lama yang masih terbuka | Rilis terkoordinasi, refresh aplikasi dan pemberitahuan untuk memuat ulang form. Timeout memakai key lama sampai hasil request dipastikan.                                      |
| Duplicate submit sesudah navigasi/reload          | Simpan key dan fingerprint bersama draft; jangan menawarkan submit ulang sebagai order baru setelah respons sukses.                                                             |
| Kolom dokumen tidak ikut pembuktian restore       | Perbarui fingerprint/uji operasi untuk dokumen, sekuens, snapshot, dan target idempotensi.                                                                                      |
| Sumber klien ikut image                           | Tambahkan `ref-client/` ke `.dockerignore` sebelum build; sumber dan render tetap privat.                                                                                       |

## 7. Validasi dan lingkungan

Fase 1: migrasi `0002_high_shaman.sql` direview dan diuji pada MySQL 8.4 disposable. **14/14 unit dan 25/25 integrasi lulus**, termasuk upgrade v1, replay migrator, saldo/ledger/pack historis, serta constraint satu target idempotensi. Typecheck root dan empat aplikasi lulus. Bukti privat `.deploy/ci-check-7bbc269e88/`; tidak memakai database arsip/development. `conversion_reviewed` menandai pack legacy untuk ditinjau; faktor lama tetap tersimpan.

Fase 2: **14/14 unit dan 30/30 integrasi lulus**; typecheck root dan empat aplikasi lulus. Pengujian mencakup dokumen multi-item, semua shortage, replay normalisasi, concurrent consume/return, snapshot konversi, K3, scope, pencarian alias, rollback audit, serta tahun nomor WIB. Bukti privat `.deploy/ci-check-45498022ad/`. Adapter ringkasan/aktivitas dan fixture ikut diperbarui bersama kontrak baru; penerimaan UI menyusul Fase 3–5.

Fase 3: keranjang Consume/Return, modal qty, pemulihan draft, link dari detail stok, dan bukti cetak terpasang. **14/14 unit, typecheck root/empat aplikasi, serta smoke Chromium HTTPS development lulus**. Smoke Consume → navigasi/tema → submit/bukti → Return mobile, saldo aktual, redirect 308/query, dan endpoint lama 410 dijalankan ulang setelah perbaikan race pemuatan draft. Screenshot privat `.deploy/r22-phase3-browser/`; pemeriksaan browser lengkap/role/konflik menyusul Fase 5. Migrasi development memakai `plant-v2-dev`, tidak mengubah arsip nyata.

Fase 4: Picklist, alias/master satuan, label role, badge keranjang, serta tab dokumen/ledger terpasang. Typecheck root/empat aplikasi dan **30/30 integrasi MySQL lulus** (bukti `.deploy/ci-check-e722e7671d/`). Smoke Chromium menerima picklist **20 baris SET → PCS**, memeriksa saldo hasil auto-enroll, riwayat dokumen/ledger, stok → keranjang, input cashier atas nama client, reservasi berulang, dan mobile tanpa overflow. Screenshot `.deploy/r22-phase4-browser/`. Perbaikan abort request mencegah detail riwayat terbuka kembali akibat request mount yang sudah dibatalkan.

Baseline Fase 0 pada Node 26.12.1: **12/12 unit test lulus**, serta **typecheck root dan keempat aplikasi lulus**. Pemeriksaan dijalankan langsung melalui Node/TypeScript karena launcher pnpm pada terminal ini tidak berjalan. Belum menjalankan migrasi R22, integration test R22, build, atau browser test R22.

Format check seluruh repo belum hijau pada baseline: lima file lama mempunyai peringatan Prettier (`packages/auth-core/src/index.ts`, `scripts/bootstrap.ts`, `tests/integration/equipment-migration.test.ts`, `docs/design/ui-brief.jsonc`, dan `docs/design/UI-REFRESH.md`). Rencana ini sendiri lolos formatting. Rapikan perbedaan whitespace tersebut secara terpisah saat memenuhi pemeriksaan akhir, tanpa mengubah perilaku Auth/Bag Filter.

**Jangan memakai `plant-v2-test` lokal sebagai database uji.** Project itu menyimpan arsip data aktual yang dibekukan pada port 13306. Integrasi dijalankan pada MySQL disposable dengan network/volume baru; jika suite memerlukan alamat tetap, gunakan namespace jaringan container atau runner CI bersih. Jangan menjalankan blok prepare/reset/operations lama terhadap Docker Engine lokal yang memuat arsip tersebut. Development biasa tetap memakai `plant-v2-dev`/HTTPS9443 dengan datanya sendiri.

Penerimaan Fase 1–5 mencakup:

- Unit: HEC, alias/CSV, desimal/overflow/konversi, canonical payload, role dan `onbehalf`.
- MySQL: upgrade fixture v1, semua konflik baris, rollback audit, retry/replay konkuren, urutan lock terbalik, sekuens dan pergantian tahun WIB, return, konversi/snapshot, K3, scope seluruh endpoint, dan `reconcile()` kosong.
- Browser: keranjang self/cashier/return, picklist 20 baris, Cari material ke keranjang, draft lintas halaman/tema/reload, 409, print, redirect, logout, keyboard, klik luar, hover, serta desktop 1440 dan mobile 390 pada kedua tema.
- Platform: build empat aplikasi, SSO, enam equipment Bag Filter, dashboard Portal, backup/restore termasuk tabel baru. Hasil aktual dan batas validasi masuk `VALIDATION.md`.

Asumsi A1–A5 tetap dipakai selama implementasi. Laporan akhir membawa daftar konfirmasi format HEC/SEC, kewajiban WO picklist, nomor dokumen, `COUNT_UNITS`, dan visibilitas dokumen sesama pengguna di lokasi yang sama. Tidak memerlukan keputusan ulang atas K1–K4.

Rujukan teknis diperiksa melalui Context7: [Drizzle MySQL migrations](https://orm.drizzle.team/docs/migrations), [Next.js redirects/basePath](https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects). Implementasi memakai versi yang sudah dipin; tidak menaikkan dependency untuk fase inti.
