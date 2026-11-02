# Prompt revisi: Consumable Room → alur bisnis R22

> Serahkan seluruh dokumen ini ke coding agent. Dokumen disusun 2 November 2026 dari audit `ref-client/R22 Business Process.pptx` terhadap source di repo ini (commit `529a46c`).

---

## 0. Peran dan tujuan

Kamu adalah senior full-stack engineer di monorepo **Plant Area System v2** (pnpm, Next.js App Router, TypeScript, Drizzle/MySQL 8.4). Tugasmu merevisi aplikasi **Consumable Room** (`apps/consumables`, `packages/consumables-core`, `packages/contracts/src/consumables.ts`, beserta bagian bersama di `packages/ui`) agar mengikuti alur bisnis **R22** yang diberikan klien.

**R22 = Consumable Room.** Klien menyebut aplikasinya "R22 App" atau "TQ-CMMS / R22 Module". Keduanya merujuk ke aplikasi `/consumables` yang sudah ada. Jangan membuat aplikasi baru.

Hasil akhirnya:

1. Order multi-item bergaya keranjang belanja untuk **Consume Order** (pengambilan) dan **Return Order** (pengembalian).
2. **Penerimaan Picklist** multi-baris dari Warehouse SAP, dengan konversi satuan SAP ke satuan terkecil R22.
3. HEC/Functional Location menjadi data wajib di setiap order.
4. Penamaan material yang familiar bagi pengguna lapangan (nama umum + alias) dan pencarian adaptif.
5. Bukti transaksi bernomor yang dapat dicetak.

---

## 1. Bacaan wajib sebelum menulis kode

Baca berurutan. Jangan mulai coding sebelum selesai:

1. `ref-client/R22 Business Process.pptx` (4 slide). Ekstrak teksnya, lalu render ke gambar untuk melihat diagram dan mockup. Ringkasannya ada di §2, tetapi tetap lihat sumber aslinya.
2. `docs/PRD-v2.md`: konteks platform, SSO, aturan umum, dan bagian "Perluasan rilis: Consumable Room v1".
3. `docs/CONSUMABLE-ROOM-PRD.md`: PRD Consumable Room v1 yang akan kamu revisi.
4. `docs/API.md` §"Consumable Room v1".
5. `docs/design/UI-REFRESH.md`, `docs/design/ui-brief.jsonc`, `docs/UI-THEME.md`, dan `docs/design/CONSUMABLE-ROOM-UI-POLISH.md`: aturan visual yang berlaku.
6. Source:
   - `packages/consumables-core/src/schema.ts`
   - `packages/consumables-core/src/index.ts`, terutama `postMovement`, `listInventory`, `listMovements`, `stockDashboard`, `discovery`, dan `reconcile`
   - `packages/consumables-core/src/import.ts`
   - `packages/contracts/src/consumables.ts`, terutama `canConsume` dan tipe `Movement`/`StockDashboard`
   - `apps/consumables/app/api/[...path]/route.ts`
   - `apps/consumables/app/[section]/page.tsx`
   - `apps/consumables/app/workspace.tsx`, terutama `StockTransaction`, `MaterialPicker`, dan `MaterialEditor`
   - `packages/ui/src/workspace.tsx` (`stockLinks`, command palette, notifikasi)
   - `packages/ui/src/stock-summary.tsx` dan `packages/ui/src/stock-activity.tsx`
   - `apps/portal/app/admin/workspace.tsx` (label role Consumables)
7. Tests: `tests/unit/consumables.test.ts`, `tests/integration/consumables*.test.ts`, dan `tests/e2e/consumables*.spec.ts`.
8. `README.md`: cara menjalankan dev, migrasi, dan test.

Setelah membaca, **tulis rencana implementasi singkat** (file yang disentuh, urutan migrasi, risiko) dan tunjukkan kepada saya sebelum mengeksekusi Fase 1.

---

## 2. Ringkasan business flow R22 (dari PPTX)

### 2.1 Glosarium

| Istilah klien                                        | Arti untuk implementasi                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R22 / R22 Room / R22 App**                         | Consumable Room (`/consumables`), yaitu gudang consumable di area plant                                                                                                                                                                                                                                    |
| **Client**                                           | Pengguna lapangan yang mengambil atau mengembalikan consumable. Dapat melayani diri sendiri (**self-service, 24/7**)                                                                                                                                                                                       |
| **R22 Cashier**                                      | Petugas R22 (**day shift**). Ia menyerahkan barang, menginput order atas nama client, dan menerima picklist dari Warehouse. "Tarom" di slide adalah **nama orang** (contoh cashier), bukan istilah sistem                                                                                                  |
| **Consume Order** → "R22 Consume Receipt"            | Dokumen pengambilan multi-item. Stok berkurang                                                                                                                                                                                                                                                             |
| **Return Order** → "R22 Return Receipt"              | Dokumen pengembalian multi-item dari client ke R22. Stok bertambah. Di slide 3 tombolnya tertulis **"Create Receive Order"**, tetapi label dokumennya "Return Order". Itu fitur **yang sama**, bukan penerimaan dari Warehouse                                                                             |
| **Picklist** (SAP "Material Request / Picking List") | Dokumen SAP dari Planner. Warehouse mengirim material ke R22 berdasarkan picklist. **"PL Received by R22 Cashier"** adalah penerimaan stok masuk R22                                                                                                                                                       |
| **MMID**                                             | Nomor material SAP (contoh `450000009999`). Sama dengan field `mmid` saat ini                                                                                                                                                                                                                              |
| **HEC/SEC**, **HAC/SAC**, **Functional Location**    | Kode lokasi kerja/equipment. Contoh di picklist: Functional Location `TQ.452-BU1 - PRE CALCINER BURNER`, Equipment No. `1000256739 - 452-BU1;PRE CALCINER BURNER`. Mockup form: `HEC.No (Format: XXX-XXX)`, contohnya `452-BU1`. Istilah ini berasal dari klien. Jangan memodelkan hierarki area/equipment |
| **WO Number**                                        | Nomor Work Order SAP, contohnya `150001538035`                                                                                                                                                                                                                                                             |
| **UoM SAP vs R22**                                   | SAP memakai satuan beragam (EA, SET, PC, TBE, CAN, Pack, Kg, Ton). R22 memakai **satuan terkecil** (Pcs, Kg, dan sejenisnya)                                                                                                                                                                               |

### 2.2 Alur material dan dokumen (slide 1 & 2)

```
SAP: Planner Job → Create Pick List (WO No + Work Description, Functional Location)
        │ picklist
        ▼
   Warehouse ──material (MMID, nama, qty PACK/UoM SAP)──▶ R22 Room & R22 App
                                                         (MMID, nama, qty PIECES; PL diterima R22 Cashier)
                                                              │
                                                              ▼
                                               Client atau R22 Cashier ──▶ Done
                                               ├─ Consume Order → R22 Consume Receipt
                                               └─ Return Order  → R22 Return Receipt
```

Informasi pada Consume Receipt dan Return Receipt. Teks **tebal** di slide menandai data wajib:

- **Functional Location / HEC/SEC**: wajib
- WO Number / Description: opsional
- **Items & Qty** yang diambil atau dikembalikan: wajib
- Pencatat: diisi otomatis oleh client di aplikasi, **atau** diinput oleh R22 Cashier

Picklist (slide 2). Field yang disorot klien sebagai penting:

- Header: **W/O No.** + deskripsi, **Equipment No.**, **Functional Location**
- Baris: **No, Material No. (MMID), Description, Req.Qty, UOM**
- Info lain di dokumen: Reservation No. (contoh `0006019803`), Required Date, dan Cost Center (contoh `40420`). Picklist contoh berisi **19 baris**

Database (slide 1):

- **SAP DB:** MMID tetap dan unik, nama & deskripsi SAP, UoM beragam.
- **R22 DB:**
  - MMID sama dengan SAP.
  - Nama & deskripsi **perlu penyesuaian**: tambahkan **penamaan yang lebih familiar** (Baut, Mur, Kawat Las, dan sejenisnya) karena nama SAP tidak dikenal pengguna.
  - UoM **disesuaikan ke satuan terkecil** (Pcs atau Kg).

### 2.3 Alur aplikasi (slide 3)

- Aktor: **R22 Cashier (Day Shift)** dan **Client (24/7)**. Keduanya login ke TQ-CMMS lewat SSO yang sudah ada.
- Menu: **Create Consume Order**, **Create Receive(=Return) Order**, dan **Search Material**.
- Input order:
  - **HEC / Functional Location** (wajib)
  - WO No. (opsional)
  - **Pilih item & qty** (wajib)
  - Barang diserahkan cashier atau diambil secara self-service
- Kedua jenis order berakhir di → **Finalize Order**.
- **Search Material**: client mencari item, lalu dapat langsung membuat Consume Order atau Return Order dengan item terpilih.

### 2.4 Mockup UI (slide 4)

Mockup berasal dari aplikasi lama klien. Ambil pola interaksinya saja, bukan gayanya.

1. **Landing Consume/Return Order**: field `HEC.No (Format: XXX-XXX)`, `Keterangan` (dengan penghitung karakter), dan search bar `Cari Produk (MMID/Nama/Deskripsi)`. Ada tombol `SCAN QR`, tabel keranjang (`No, MMID, Nama Produk, Qty, Satuan, Aksi[hapus]`), dan tombol `SUBMIT ORDER`.
2. **Search bar adaptif**: dropdown hasil berisi baris 1 `MMID - NAMA`, baris 2 deskripsi + `(Stok: 37 EA)`. Pengguna memilih item dari dropdown. Toast muncul: "… ditambahkan".
3. **Modal Input Quantity**: menampilkan `Stok tersedia: 7`, `Satuan: EA`, input qty, dan tombol `TAMBAH`.

---

## 3. Hasil audit: kondisi saat ini vs kebutuhan R22

| #   | Kebutuhan R22                                                                | Kondisi source saat ini                                                                                                                             | Gap / tindakan                                                                                                 |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| G1  | Order multi-item (keranjang)                                                 | `postMovement` hanya memproses **satu material + satu lokasi** per POST. PRD v1 menyatakan "multi-item dokumen" **di luar rilis**                   | Tambah entitas **dokumen** (header) dengan banyak baris ledger yang disimpan atomik                            |
| G2  | HEC/Functional Location **wajib**, WO opsional                               | Pemakaian (`schemas.issue`) mewajibkan `job` (teks bebas 500) dengan label "Pekerjaan / equipment". `wo` opsional. Tidak ada field HEC              | Ganti `job` dengan `hec` terstruktur (wajib, tervalidasi, ternormalisasi). `wo` dan `note`/Keterangan opsional |
| G3  | **Return Order**                                                             | Tidak ada. Tipe movement hanya `opening, receipt, issue, adjustment`. PRD v1 menyatakan "retur/transfer khusus" di luar rilis                       | Tambah tipe movement `return` (stok masuk) dan dokumen `return`                                                |
| G4  | **Penerimaan Picklist** dari Warehouse (multi-baris, header WO/Reservasi/FL) | Penerimaan satu item, `reference` teks bebas, mode `base`/`pack`                                                                                    | Ganti dengan dokumen `picklist`: header + baris, qty input dalam UoM SAP lalu dikonversi ke satuan R22         |
| G5  | UoM SAP ≠ UoM R22 (satuan terkecil)                                          | Master hanya punya satu `unit` (hasil impor SAP) + `packSize` nullable (isi pack). Tidak ada `sapUnit`                                              | Tambah `sapUnit`. `unit` = satuan terkecil R22. `packSize` diberi makna "1 sapUnit = N unit"                   |
| G6  | Nama familiar (Baut, Mur, Kawat Las)                                         | `commonName` (160) sudah ada dan ikut dicari, tetapi UI menampilkan `description` SAP sebagai nama utama. Tidak ada alias                           | Tampilkan nama umum sebagai nama utama, tambah **alias/kata kunci**, dan sediakan impor massal penamaan        |
| G7  | Pencarian adaptif + stok di dropdown + modal qty                             | `MaterialPicker` hanya mencari master (tanpa stok). Halaman Pemakaian memakai tabel stok + panel form satu item. Urutan hasil hanya `ORDER BY mmid` | Endpoint pencarian berperingkat (8 hasil + stok di lokasi), dropdown keyboard-friendly, modal qty, dan toast   |
| G8  | Search Material → langsung buat order                                        | Detail material di "Cek stok" hanya menautkan ke `/consumables/issue?material=…` untuk satu item                                                    | Tombol "Tambah ke Consume Order" / "Tambah ke Return Order" yang mengisi keranjang                             |
| G9  | Cashier menginput **atas nama** client                                       | Actor selalu pengguna sesi. Tidak ada field peminta                                                                                                 | Field peminta (nama wajib + NIK opsional) khusus untuk cashier. Client self-service tercatat otomatis          |
| G10 | Bukti Consume/Return Receipt                                                 | Hanya ID UUID movement di toast                                                                                                                     | Nomor dokumen yang mudah dibaca + halaman bukti siap cetak                                                     |
| G11 | Material picklist belum terdaftar di lokasi                                  | `postMovement` menolak (404 "belum terdaftar") dan mewajibkan admin mendaftarkan + mengisi saldo awal                                               | Auto-daftar dengan saldo awal 0 (lihat keputusan K3)                                                           |
| G12 | Tombol SCAN QR                                                               | PRD v1: barcode di luar rilis                                                                                                                       | Fase opsional terpisah (K4)                                                                                    |
| G13 | Role Client vs Cashier                                                       | Role: `viewer`, `operator` (pemakaian sendiri), `storekeeper` (penerimaan + pemakaian), `admin`                                                     | Pertahankan ID role. Petakan dan ganti labelnya (lihat §5.2)                                                   |

Yang **sudah sesuai** dan harus dipertahankan:

- SSO, scope lokasi, dan pemeriksaan izin di server
- `DECIMAL(18,6)` + aritmetika `bigint` (`decimalUnits`/`decimalString`)
- Idempotency-Key, row lock, audit atomik, dan larangan saldo negatif
- Saldo awal/koreksi oleh admin, pagination keyset 50, dan WIB/UTC
- Rekonsiliasi read-only serta impor katalog dry-run/apply

---

## 4. Keputusan yang sudah dikunci

Keputusan ini sudah dikonfirmasi pemilik produk. Jangan ubah tanpa bertanya.

- **K1. Order atas nama client:** cashier (role `storekeeper`/`admin`) dapat mengaktifkan "Input untuk client lain".
  - Bila aktif: **Nama peminta wajib** (1–100) dan **NIK/Badge opsional** (≤30). Teks bebas, tanpa lookup akun.
  - Bila tidak aktif, atau pengguna adalah `operator`: peminta = actor sesi (snapshot nama), kanal `self`.
  - `operator` **tidak boleh** mengirim field peminta. Server menolak dengan 403.
- **K2. Return Order bebas:** material apa pun yang terdaftar dan aktif di lokasi boleh diretur, tanpa merujuk Consume Order. HEC wajib. WO dan "No. Consume Order asal" opsional sebagai teks referensi. Tidak ada batas qty terhadap pengambilan sebelumnya.
- **K3. Picklist untuk material baru di lokasi:** jika material ada di master dan aktif tetapi **belum punya baris `inventory` di lokasi**, transaksi picklist yang sama akan:
  1. membuat `inventory` (rak kosong),
  2. mencatat movement `opening` qty `0` dengan alasan `Auto-daftar dari picklist <nomor dokumen>`,
  3. lalu mencatat `receipt`.

  Jika `inventory` **sudah ada tetapi `initialized=false`** ("Belum dihitung"), baris tersebut **ditolak** (409) dengan pesan bahwa admin perlu menghitung saldo awal dulu, karena barang fisik mungkin sudah ada. MMID yang tidak ada di master ditolak (admin harus menambah master).

- **K4. QR scan:** fase terpisah dan opsional (Fase 6). Fitur inti tidak boleh bergantung padanya. Siapkan saja titik integrasinya: input pencarian menerima MMID persis dan langsung membuka modal qty.

### Asumsi kerja (tetap kerjakan, tetapi catat di laporan akhir supaya dikonfirmasi)

- **A1. Finalize Order = submit.** Dokumen langsung final dan stok langsung berubah. Tidak ada draft, approval, atau reservasi, sesuai PRD v1 yang menolak approval/reservasi dan alur 24/7 self-service.
- **A2. Tidak ada pembatasan jam.** "Day Shift" dan "24/7" adalah konteks operasional, bukan aturan sistem.
- **A3. Format HEC.** Normalisasi: trim, uppercase, buang prefiks plant `TQ.` bila ada (`TQ.452-BU1` → `452-BU1`). Validasi default `^[A-Z0-9]{3}-[A-Z0-9]{3}$`, sesuai mockup "XXX-XXX". Letakkan regex dan fungsi normalisasi di **satu tempat** (`packages/contracts`) supaya mudah diganti bila klien memberi format SEC yang lebih panjang.
- **A4. Satu lokasi per dokumen.** Bila pengguna hanya punya satu lokasi (kasus umum: R22), lokasi terpilih otomatis dan selector disembunyikan.
- **A5. Riwayat tetap mengikuti scope lokasi** seperti v1. Operator boleh melihat dokumen orang lain dalam lokasinya.

---

## 5. Spesifikasi revisi

### 5.1 Data model: migrasi baru `0002_*` (aditif, tanpa merusak image lama)

Buat migrasi dengan `pnpm db:generate:consumables`, lalu review SQL-nya. Semua kolom baru harus nullable atau punya default, supaya image versi sebelumnya tetap bisa berjalan saat rollback (PRD-v2 §5).

**`materials`** (tambah):

- `sap_unit varchar(30) NOT NULL DEFAULT ''`. Backfill `sap_unit = unit` untuk semua baris lama.
- `aliases varchar(500) NOT NULL DEFAULT ''`: kata kunci familiar, dipisah koma, ternormalisasi (trim, tanpa duplikat case-insensitive, maksimal 10 alias, masing-masing ≤40 karakter).
- `decimal_allowed boolean NOT NULL DEFAULT true`. Backfill: `false` bila `unit` termasuk satuan hitung (`EA, PC, PCS, SET, BH, BUAH, UNIT, ROL, ROLL, CAN, TBE, BTL, BOX, PAK, PACK`, case-insensitive), selain itu `true`. Daftar ini diletakkan di contracts dan dapat diubah admin per material.
- **`pack_size` tetap** (jangan rename kolom). Maknanya kini **"1 `sap_unit` = N `unit`"**. Di UI, labelnya **"Konversi SAP"**. Jika `sap_unit` sama dengan `unit` (case-insensitive) dan `pack_size` null, faktor efektif = 1.

**`stock_documents`** (baru):

| Kolom                                                                                   | Tipe / aturan                                                                                                                         |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                    | varchar(36) PK (UUID)                                                                                                                 |
| `number`                                                                                | varchar(30) UNIQUE. Format `R22-CO-2026-000123` (consume), `R22-RO-…` (return), `R22-PL-…` (picklist). Tahun = tahun WIB saat dicatat |
| `type`                                                                                  | varchar(16): `consume` \| `return` \| `picklist`                                                                                      |
| `location_id`, `location_name`                                                          | FK + snapshot                                                                                                                         |
| `hec`                                                                                   | varchar(20). Wajib untuk consume/return, opsional untuk picklist (diisi dari FL picklist bila ada)                                    |
| `wo`                                                                                    | varchar(100), default `''`                                                                                                            |
| `note`                                                                                  | varchar(500), default `''` (Keterangan / WO Description / Work Description)                                                           |
| `channel`                                                                               | varchar(10): `self` \| `cashier`                                                                                                      |
| `requester_name`, `requester_nik`                                                       | varchar(100) / varchar(30). Untuk `self` diisi snapshot nama actor                                                                    |
| `source_ref`                                                                            | varchar(100), default `''` (Return: No. Consume Order asal, opsional)                                                                 |
| `reservation_no`, `equipment_no`, `functional_location`, `cost_center`, `required_date` | Khusus picklist. `reservation_no` varchar(30) **wajib** untuk picklist. Lainnya opsional (varchar 100/100/40, date `YYYY-MM-DD`)      |
| `line_count`                                                                            | int                                                                                                                                   |
| `actor_id`, `actor_name`, `created_at`                                                  | sama seperti `stock_movements`                                                                                                        |

Index: `(location_id, created_at, id)`, `(type, created_at, id)`, `(hec)`, `(wo)`, `(reservation_no)`.

**`stock_document_sequences`** (baru): `(type, year)` PK, `last_value int`. Nomor dibuat di dalam transaksi dokumen memakai `SELECT … FOR UPDATE` / upsert, sehingga unik di bawah konkurensi.

**`stock_movements`** (tambah):

- `document_id varchar(36) NULL` FK ke `stock_documents`, beserta `line_no int NULL`. Movement lama tetap `NULL`.
- `sap_unit varchar(30) NULL` dan `sap_quantity decimal(18,6) NULL` sebagai snapshot input picklist. `pack_size` yang sudah ada dipakai untuk snapshot faktor.
- `type` kini menerima juga `return`. Pemetaan baris dokumen ke tipe ledger: Consume Order → `issue`, Return Order → `return`, dan Picklist → `receipt` (plus `opening` 0 untuk auto-enroll K3). Konvensi tanda tetap: `issue` negatif; `receipt`/`return` positif. Dengan begitu `reconcile()` tidak perlu berubah.
- `job` dipertahankan untuk data lama. Movement baru mengisi `job` = HEC (kompatibilitas tampilan lama) dan `wo`/`reference` dari header.

**`stock_idempotency`**: jadikan `movement_id` nullable dan tambah `document_id varchar(36) NULL` FK. Tepat satu dari keduanya harus terisi (CHECK constraint, dan validasi di kode).

**Lokasi:** satu lokasi per dokumen. Tidak ada perubahan pada `locations`/`inventory`, kecuali auto-enroll K3.

### 5.2 Contracts dan izin (`packages/contracts/src/consumables.ts`)

- `StockAction` tambah `return` dan `onbehalf`. Matriks izin:

| Role (ID tetap) | Label UI baru             | read | issue (Consume) | return | receive (Picklist) | onbehalf | manage/audit |
| --------------- | ------------------------- | :--: | :-------------: | :----: | :----------------: | :------: | :----------: |
| `viewer`        | Viewer                    |  ✓   |                 |        |                    |          |              |
| `operator`      | **Client (self-service)** |  ✓   |        ✓        |   ✓    |                    |          |              |
| `storekeeper`   | **R22 Cashier**           |  ✓   |        ✓        |   ✓    |         ✓          |    ✓     |              |
| `admin`         | Admin Consumable Room     |  ✓   |        ✓        |   ✓    |         ✓          |    ✓     |      ✓       |

- Perbarui label role di `apps/portal/app/admin/workspace.tsx` (opsi role Consumables), `docs/API.md`, dan PRD. Jangan ubah nilai role yang tersimpan di Auth.
- Tambah tipe `StockDocument`, `StockDocumentLine` (= `Movement` + `lineNo`), dan `StockDocumentType`. `Movement['type']` ditambah `'return'`. Tambah `normalizeHec()`, `HEC_PATTERN`, dan `COUNT_UNITS`.
- `StockDashboard.series` berubah menjadi `{ quarter, consume, return, picklist, opening, adjustment }`. Consume/return/picklist = **jumlah dokumen**; opening/adjustment = jumlah movement.

### 5.3 API (`apps/consumables/app/api/[...path]/route.ts` + core)

Semua POST stok baru **wajib `Idempotency-Key`** (aturan sama dengan v1). Idempotensi berlaku **per dokumen**: key + payload sama mengembalikan dokumen semula (200); payload beda menghasilkan 409. Respons berbentuk `{ document, lines, replayed }`, dengan status 201 untuk baru dan 200 untuk replay.

| Method     | Path                                                       | Body / query                                                                                                                                                                                                             | Izin                               |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| GET        | `/search?q=&locationId=`                                   | Autocomplete keranjang, maksimal 8 hasil, inventory aktif dalam scope + saldo. Urutan relevansi: MMID persis → prefiks MMID → kecocokan `common_name`/`aliases` → `description`. Tetap token AND dan escape wildcard     | read                               |
| GET        | `/catalog-search?q=`                                       | Autocomplete master (untuk picklist), maksimal 8, termasuk `sapUnit`, `unit`, dan faktor                                                                                                                                 | receive                            |
| GET        | `/hec-suggestions?q=`                                      | Maksimal 8 HEC berbeda yang pernah dipakai dalam scope, terbaru dulu                                                                                                                                                     | read                               |
| POST       | `/consume-orders`                                          | `{locationId, hec, wo?, note?, requester?:{name,nik?}, lines:[{materialId, quantity}]}`                                                                                                                                  | issue (+onbehalf bila `requester`) |
| POST       | `/return-orders`                                           | `{locationId, hec, wo?, note?, sourceRef?, requester?, lines:[{materialId, quantity}]}`                                                                                                                                  | return (+onbehalf)                 |
| POST       | `/picklist-receipts`                                       | `{locationId, reservationNo, wo, woDescription?, equipmentNo?, functionalLocation?, costCenter?, requiredDate?, lines:[{materialId, sapQuantity}] }` atau per baris `{materialId, quantity}` (input langsung satuan R22) | receive                            |
| GET        | `/documents?type=&q=&locationId=&from=&to=&cursor=&limit=` | Keyset 50. `q` mencari nomor, HEC, WO, reservasi, peminta, dan actor                                                                                                                                                     | read                               |
| GET        | `/documents/:id`                                           | `{document, lines}`, 404 di luar scope                                                                                                                                                                                   | read                               |
| POST/PATCH | `/materials[/:id]`                                         | Tambah `sapUnit`, `aliases`, `decimalAllowed`                                                                                                                                                                            | manage                             |

Aturan validasi dan transaksi:

- `lines`: 1–50 untuk consume/return dan 1–100 untuk picklist. **`materialId` duplikat dalam satu dokumen → 400** (UI menggabungkan sebelum kirim). Quantity mengikuti `positive` + `decimalAllowed` (bila false, harus bilangan bulat).
- **Atomik per dokumen:** semua baris berhasil, atau tidak ada yang tersimpan.
- Urutan lock untuk menghindari deadlock: lokasi → material (urut `id`) → inventory (urut `id`) → idempotency → sequence. Retry deadlock/lock-timeout seperti `postMovement`.
- Stok kurang pada consume → **409** dengan body `{ error, lines: [{ lineNo, materialId, mmid, available, requested }] }` untuk **semua** baris yang kurang, bukan hanya yang pertama.
- `inventory`/material/lokasi nonaktif atau `initialized=false` → 409 per baris (format sama). Pengecualian: picklist auto-enroll (K3).
- **Konversi picklist:** `quantity = sapQuantity × faktor` dihitung dengan `bigint`. Hasilnya harus ≤ 6 desimal dan, bila `decimalAllowed=false`, harus bulat. Bila tidak, tolak baris tersebut dengan pesan yang menyarankan input satuan R22 atau perbaikan konversi. Jika `sapUnit ≠ unit` dan `pack_size` null, input `sapQuantity` ditolak: wajib memakai `quantity` dalam satuan R22, atau admin mengatur konversi terlebih dahulu. Simpan snapshot `sap_unit`, `sap_quantity`, dan `pack_size` di movement.
- `reservationNo` yang sudah pernah diterima **tidak diblokir** (pengiriman parsial mungkin terjadi). Respons dan UI memberi peringatan berisi daftar dokumen sebelumnya.
- `requester` dari `operator` → 403. Untuk `self`, server mengisi peminta = actor.
- Audit: satu entri `document.<type>` berisi ringkasan header + jumlah baris, ditambah entri yang sudah ada per movement (`stock.issue|return|receipt|opening`) atau ringkasannya, tetap dalam transaksi yang sama.
- **Endpoint lama** `POST /issues` dan `POST /receipts` dihapus dari UI. Di API, kembalikan **410** `{error:"Gunakan /consume-orders atau /picklist-receipts."}`. `GET /movements` tetap ada (riwayat per baris/ledger). Tambah filter `type=return` dan `documentId=`.
- `GET /dashboard`, `/activity`, dan `/discovery` disesuaikan: aktivitas dan discovery menampilkan **dokumen** (nomor, tipe, HEC, jumlah baris, peminta). Discovery juga mencocokkan nomor dokumen, HEC, dan WO.

### 5.4 UI (`apps/consumables`, `packages/ui`)

Ikuti design system UI refresh yang sudah ada (token, `Input`/`Select`/`Overlay`/`useConfirmation`, toast/notice, tema terang/gelap, sidebar). Copy UI berbahasa Indonesia; istilah klien boleh dipertahankan dalam kurung.

**Navigasi** (`packages/ui/src/workspace.tsx` `stockLinks` dan `apps/consumables/app/[section]/page.tsx` `titles`):

```
Ringkasan · Cari material (stock) · Consume Order (consume) · Return Order (return)
· Penerimaan Picklist (picklist) · Riwayat (history) · Pengelolaan (manage) · Audit (audit)
```

- Section lama `issue` → redirect 308 ke `consume`, dan `receive` → `picklist`, dengan query string dipertahankan.
- Perbarui CTA di `stock-summary.tsx` (`Catat penerimaan`/`Catat pemakaian`), label/ikon di `stock-activity.tsx`, serta tautan notifikasi/command palette yang kini membuka `history?document=<id>`.

**Halaman Consume Order / Return Order** (satu komponen `OrderCart` dengan prop `type`). Pola mengikuti mockup slide 4:

1. Header form:
   - **HEC / Functional Location** (wajib): input dengan hint `Format XXX-XXX, contoh 452-BU1`, normalisasi saat blur, autocomplete `/hec-suggestions`.
   - **WO Number** (opsional).
   - **Keterangan / deskripsi pekerjaan** (opsional, penghitung karakter 0/500).
   - Return: **No. Consume Order asal** (opsional).
   - Untuk izin `onbehalf`: switch **"Input untuk client lain"** → Nama peminta (wajib) + NIK/Badge (opsional). Tanpa switch: tampilkan "Dicatat sebagai: <nama Anda>".
2. **Search bar adaptif** (`/search`), debounce ±200 ms:
   - Dropdown baris 1 `MMID · Nama umum` (fallback ke deskripsi SAP); baris 2 deskripsi SAP + **`Stok: 37 PCS`** + rak.
   - Navigasi ↑/↓/Enter/Esc dan atribut ARIA combobox (pola `MaterialPicker` sudah ada; perluas).
   - Input yang persis MMID langsung membuka modal qty (titik integrasi QR).
3. **Modal Input Quantity**: nama item, **Stok tersedia: X UNIT**, Satuan, input qty (`inputMode` numeric bila `decimalAllowed=false`), tombol **Tambah**. Consume: validasi klien qty ≤ stok tersedia dikurangi qty yang sudah ada di keranjang. Item yang sama ditambahkan lagi → qty digabung. Tampilkan toast "<nama> ditambahkan".
4. **Tabel keranjang**: No, MMID, Nama, Qty (dapat diedit), Satuan, Aksi (hapus). Pada mobile, baris menjadi kartu.
5. Tombol **Submit Order** membuka dialog konfirmasi berisi ringkasan (HEC, WO, peminta, jumlah baris).
   - Berhasil: layar sukses dengan **nomor dokumen**, tombol **Lihat/Cetak bukti**, dan **Buat order baru**. Keranjang dikosongkan.
   - 409 per baris: tandai baris yang bermasalah beserta stok terkini. Jangan kosongkan keranjang.
   - Idempotency-Key dipertahankan selama payload tidak berubah (pola `pending` di `StockTransaction`).
6. Keranjang disimpan di `sessionStorage` dengan key `r22-cart:<userId>:<type>:<locationId>` agar tidak hilang saat pindah halaman atau ganti tema. Hapus saat submit sukses atau logout.

**Halaman Penerimaan Picklist** (khusus `receive`):

- Header: **No. Reservasi** (wajib), **WO No.** (wajib) + Work Description, Equipment No., Functional Location, Cost Center, Required Date. Semua label mengikuti istilah picklist SAP.
- Baris: cari master (`/catalog-search`), lalu tampilkan MMID, deskripsi SAP, nama umum, **UoM SAP**, dan faktor. Input **Req.Qty dalam UoM SAP** dengan pratinjau langsung "= N PCS (satuan R22)". Ada toggle per baris "Input dalam satuan R22" untuk material tanpa konversi.
- Badge per baris: "Baru di lokasi ini, akan didaftarkan otomatis" (K3) atau "Belum dihitung, hubungi admin" (diblokir).
- Peringatan non-blocking bila No. Reservasi sudah pernah diterima, beserta tautan ke dokumen sebelumnya.
- Desktop: layout tabel lebar yang nyaman untuk ±20 baris. Navigasi keyboard: Enter di qty pindah ke pencarian baris berikutnya.

**Cari material** (dahulu "Cek stok"):

- Kartu/baris menampilkan nama umum sebagai judul, MMID + deskripsi SAP sebagai sub-judul, stok + satuan R22, dan rak.
- Detail material punya tombol **Tambah ke Consume Order** dan **Tambah ke Return Order** (sesuai izin). Tombol membuka modal qty, menambah ke keranjang, lalu menawarkan "Buka keranjang (n)".
- Badge jumlah item keranjang tampil di header halaman/sidebar.

**Riwayat:**

- Tab **Dokumen** (default) dan **Pergerakan stok** (ledger per baris, seperti sekarang).
- Filter jenis (Consume/Return/Picklist/Saldo awal/Koreksi), tanggal WIB, dan pencarian nomor/HEC/WO/reservasi/peminta.
- Detail dokumen menampilkan header + baris + tombol cetak.

**Bukti cetak** (`/consumables/documents/[id]`):

- Judul: "R22 Consume Receipt" / "R22 Return Receipt" / "Bukti Penerimaan Picklist".
- Isi: nomor, waktu WIB, lokasi, HEC, WO, keterangan, peminta (+NIK), pencatat, kanal, tabel baris (No, MMID, Nama, Qty, Satuan; picklist juga Qty SAP + UoM SAP), serta area tanda tangan (Peminta / R22 Cashier).
- Gunakan `@media print` yang bersih (tanpa sidebar), A4 portrait dan ramah printer thermal lebar 80 mm (opsional, via kelas CSS).

**Pengelolaan → Master material** (`MaterialEditor`):

- Field baru: Nama umum (diberi penekanan, dengan hint "nama yang dikenal di lapangan, mis. Baut M16"), **Alias** (chip input), **Satuan SAP**, **Satuan R22 (terkecil)**, **Konversi SAP** ("1 SET = [ 2 ] PCS"), dan **Izinkan desimal**.
- Aturan v1 tetap: satuan R22 terkunci setelah transaksi pertama, MMID tidak dapat diubah, dan version wajib.
- Perubahan konversi hanya memengaruhi transaksi baru (snapshot).

**Ringkasan/dashboard dan Portal:**

- Chart Q1–Q4 memakai seri `consume`, `return`, `picklist`, `opening`, `adjustment` dengan warna konsisten.
- KPI stok tetap.
- Aktivitas terbaru menampilkan dokumen.

### 5.5 Penamaan massal: CLI baru `consumables:import-naming`

Klien perlu menyesuaikan nama dan satuan untuk ribuan MMID. Tambah script `scripts/import-consumables-naming.ts` (+ entri `package.json`):

- Pola sama seperti `consumables:import`: **dry-run default**, `--apply` eksplisit, validasi seluruh file sebelum apply, atomik, laporan ringkas, dan audit `catalog.naming-imported`.
- Input CSV UTF-8 dengan header `mmid,common_name,aliases,unit,sap_unit,pack_size,decimal_allowed`. Kolom kosong = tidak diubah.
- MMID tidak dikenal → error. Perubahan `unit` pada material yang sudah bertransaksi → error baris, dan seluruh file dihentikan.
- Setiap material yang berubah menaikkan `version`.
- Data asli klien tetap lokal (tidak masuk Git/image). Tests memakai data sintetis.

### 5.6 Impor katalog

Sesuaikan `packages/consumables-core/src/import.ts`: material baru dari arsip SAP mengisi `sap_unit = unit` dan `decimal_allowed` sesuai `COUNT_UNITS`. Jangan menimpa edit manual (perilaku v1).

---

## 6. Fase kerja

Kerjakan berurutan. Setiap fase harus lolos `pnpm typecheck` dan test yang relevan sebelum lanjut. Commit per fase dengan pesan yang jelas.

1. **Fase 0: Rencana.** Baca §1, lalu kirim rencana singkat (file, migrasi, risiko). Tunggu persetujuan.
2. **Fase 1: Data & contracts.** Schema + migrasi `0002` (review SQL), backfill, contracts (izin, tipe, HEC, konversi), dan unit test.
3. **Fase 2: Core & API.** `createDocument` generik (consume/return/picklist), nomor dokumen, endpoint search/documents/hec-suggestions, 410 untuk endpoint lama, dashboard/activity/discovery, dan integration test.
4. **Fase 3: UI order.** `OrderCart` (consume/return), search adaptif, modal qty, keranjang persisten, sukses/cetak, Cari material → keranjang, navigasi & redirect.
5. **Fase 4: UI picklist & master.** Penerimaan Picklist, MaterialEditor baru, Riwayat dokumen, dashboard/Portal, dan label role di Portal admin.
6. **Fase 5: CLI penamaan, dokumentasi, e2e.** Script naming, update dokumen (§8), e2e desktop + mobile, dan `VALIDATION.md`.
7. **Fase 6 (opsional, K4): Scan QR.**
   - Tombol "Scan QR" memakai `BarcodeDetector` bila tersedia, dengan fallback library ringan yang di-pin di lockfile (misalnya `@zxing/browser`).
   - Isi QR = MMID. Hasil scan diproses sama seperti input MMID persis.
   - Halaman admin dapat mencetak label QR per material/rak.
   - Kamera hanya berjalan di HTTPS. Sediakan fallback input manual.

---

## 7. Pengujian wajib

**Unit:**

- `normalizeHec` (prefiks `TQ.`, huruf kecil, spasi, format salah)
- Konversi SAP → R22 dengan `bigint` (pecahan, overflow, `decimalAllowed=false`)
- Canonical payload idempotensi dokumen
- Matriks izin baru, termasuk `onbehalf`

**Integration (MySQL nyata):**

- Consume multi-baris atomik: satu baris kurang stok → tidak ada yang tersimpan, dan 409 mendaftar semua baris yang kurang.
- Dua consume order konkuren pada material yang sama tidak menghasilkan saldo minus. Dua dokumen dengan baris berurutan terbalik tidak deadlock-gagal (urutan lock).
- Nomor dokumen unik dan berurutan di bawah konkurensi. Pergantian tahun WIB mereset urutan.
- Idempotensi per dokumen: replay mengembalikan dokumen yang sama; payload berbeda → 409.
- Return menambah stok. Picklist mengonversi qty dan menyimpan snapshot. Perubahan konversi setelahnya tidak mengubah riwayat.
- K3: auto-enroll + opening 0 + receipt dalam satu transaksi. `initialized=false` ditolak. MMID tak dikenal ditolak.
- `operator` mengirim `requester` → 403. `viewer` tidak bisa membuat dokumen. Scope lokasi ditegakkan di semua endpoint baru.
- `materialId` duplikat → 400. `decimalAllowed=false` + pecahan → 400. HEC kosong/salah → 400.
- `reconcile()` tetap kosong setelah seluruh skenario.
- `/issues` dan `/receipts` → 410.
- Regresi: seluruh test Bag Filter dan platform tetap hijau.

**E2E (Playwright, desktop + mobile):**

- Client self-service: cari "baut" (alias) → modal qty → keranjang → submit → bukti bernomor.
- Cashier: input atas nama client.
- Return order.
- Picklist 20 baris dengan konversi SET → PCS.
- Cari material → tambah ke keranjang.
- Keranjang bertahan saat pindah halaman atau ganti tema.
- Error 409 per baris.
- Tampilan cetak.
- Redirect `/consumables/issue` → `/consumables/consume`.

Perintah verifikasi (lihat README untuk environment):

```
pnpm format:check && pnpm typecheck && pnpm test && pnpm test:integration && pnpm test:e2e
```

---

## 8. Dokumentasi yang harus diperbarui

- `docs/CONSUMABLE-ROOM-PRD.md` → naikkan menjadi **v1.1 (R22)**:
  - Tujuan, peran (label Client/R22 Cashier), transaksi berbasis dokumen, HEC, retur, picklist, konversi satuan, dan penamaan.
  - Pindahkan "retur" dan "multi-item dokumen" dari bagian _Di luar rilis_ ke dalam rilis.
  - Barcode/QR menjadi opsional Fase 6.
  - Approval, reservasi, transfer antar lokasi, integrasi SAP otomatis, dan pengadaan **tetap di luar rilis**.
- `docs/API.md`: endpoint baru, 410 untuk endpoint lama, bentuk error 409 per baris, dan label role.
- `docs/PRD-v2.md` paragraf "Perluasan rilis": satu-dua kalimat tentang revisi R22 dan tautan ke PRD Consumables.
- `docs/VALIDATION.md`: hasil aktual test (jangan tulis hasil yang belum dijalankan).
- `README.md`: perintah `consumables:import-naming`.

---

## 9. Batasan dan larangan

- **Jangan** mengubah perilaku Bag Filter, Auth, sesi, atau gateway, kecuali label role di Portal admin.
- **Jangan** memakai floating point untuk quantity. Semua aritmetika lewat `decimalUnits`/`decimalString` (`bigint`).
- **Jangan** menghapus atau mengubah data/movement historis. Tidak ada hard delete. Kolom lama (`job`, `packs`, `reference`) tetap ada untuk data lama.
- **Jangan** menambah approval, reservasi stok, atau pembatasan jam (A1, A2).
- **Jangan** mempercayai actor, peminta self, nomor dokumen, saldo, atau faktor konversi dari klien. Semuanya dihitung atau diverifikasi server.
- **Jangan** mengedit `node_modules/@plant/*`. Edit source di `packages/*`.
- **Jangan** commit data katalog atau penamaan asli klien.
- Dependency baru (khusus Fase 6) harus di-pin versinya di lockfile dan disebutkan di laporan.
- Pertahankan aksesibilitas: label form, ARIA combobox/listbox, fokus modal, target sentuh ≥44 px di mobile.

---

## 10. Definition of done dan laporan akhir

Selesai bila:

- Fase 1–5 selesai dan semua perintah verifikasi §7 hijau.
- Migrasi teruji pada volume lama: data v1 tetap terbaca, `reconcile()` kosong.
- Dokumen §8 diperbarui.

Laporan akhir berisi:

1. Ringkasan perubahan per fase + daftar file.
2. SQL migrasi `0002` dan catatan rollback.
3. Hasil test (angka aktual).
4. Screenshot desktop + mobile untuk Consume Order, modal qty, keranjang, Picklist, dan bukti cetak.
5. **Daftar konfirmasi untuk klien:**
   - A1–A5.
   - Format HEC/SEC final dan prefiks `TQ.`.
   - Apakah WO wajib di picklist.
   - Format nomor dokumen.
   - Daftar `COUNT_UNITS`.
   - Apakah client boleh melihat dokumen orang lain.
6. Risiko atau utang teknis yang tersisa.
