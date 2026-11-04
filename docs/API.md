# Kontrak API v2

Semua tanggal respons berupa ISO UTC. Tampilan WIB dilakukan klien. Respons tidak boleh dicache. Operasi tulis memakai `Content-Type: application/json` dan `Origin` sama persis dengan `PUBLIC_ORIGIN`. Identitas berasal dari cookie sesi; body/header actor tidak diterima.

## Auth

| Method   | Path                                         | Akses / body                                                      |
| -------- | -------------------------------------------- | ----------------------------------------------------------------- |
| POST     | `/auth/api/sign-in/email`                    | `{email,password}` → cookie dan `{ok:true}`                       |
| POST     | `/auth/api/sign-out`                         | Sesi saat ini dicabut                                             |
| GET      | `/auth/manage/me`                            | Identitas, termasuk penanda ganti password                        |
| POST     | `/auth/manage/password`                      | `{currentPassword,newPassword}`; mencabut seluruh sesi            |
| POST     | `/auth/manage/profile`                       | `{name,position}`                                                 |
| GET/POST | `/auth/manage/admin/users`                   | List / `{email,name,password,position?}`                          |
| POST     | `/auth/manage/admin/users/:id/access`        | `{active,portalAdmin}`                                            |
| POST     | `/auth/manage/admin/users/:id/grant`         | `{grant:{appId:"bag-filter",role,equipment}}` atau `{grant:null}` |
| POST     | `/auth/manage/admin/users/:id/password`      | `{password}` sementara; seluruh sesi dicabut                      |
| GET      | `/auth/manage/admin/audit`                   | 50 terbaru                                                        |
| GET      | `/auth/manage/admin/applications`            | Katalog/status                                                    |
| POST     | `/auth/manage/admin/applications/bag-filter` | `{status:"active"                                                 | "disabled"}` |

Portal memproksi `/api/admin/*` ke `/auth/manage/admin/*` dan `/api/profile` ke `/auth/manage/profile`. Server memeriksa admin pada kedua sisi.

Internal saja: `/auth/internal/session` mengembalikan `{identity}`, `/auth/internal/verify` mengembalikan 204, 401, 403, atau 503. Keduanya memerlukan `X-Plant-Service-Token`; verify juga memerlukan `X-Plant-App`. Gateway memblokir prefix internal, menghapus header layanan dari browser, lalu memasang token sendiri untuk subrequest. Layanan internal tidak membuka port host.

## Bag Filter

| Method | Path setelah `/bag-filter/api`                                       | Respons                                                                        |
| ------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| GET    | `/equipment`                                                         | Equipment dalam scope                                                          |
| GET    | `/equipment/:code/state`                                             | `{equipment,positions,recorded,total,serverTime,updatedAt,yearlyReplacements}` |
| GET    | `/equipment/:code/batches?q=&cursor=`                                | `{items,nextCursor}`; 50 batch                                                 |
| POST   | `/equipment/:code/batches`                                           | 201 baru, 200 replay; `{batchId,count,replayed}`                               |
| POST   | `/equipment/:code/batches/:batchId/cancel`                           | Admin dalam scope; 200 `{batchId,status,cancellation,replayed}`                |
| GET    | `/equipment/:code/positions?side=&compartment=&column=&row=&cursor=` | Timeline 50; hanya record aktif dengan `endedAt:null` berarti terkini          |
| GET    | `/audit?cursor=`                                                     | Admin Bag Filter; hanya equipment dalam scope                                  |

`yearlyReplacements` berisi `{year,total,previousYear,previousTotal}`. Tahun ditentukan server dalam Asia/Jakarta; total menjumlahkan `position_count` batch aktif equipment menurut tanggal pemasangan, bukan waktu pencatatan atau jumlah posisi aktif. Tahun berjalan dihitung sampai waktu server (dengan toleransi input 60 detik), dan tahun sebelumnya mencakup Januari–Desember. Seluruh pemasangan/penggantian yang tercatat termasuk pemasangan awal ikut dihitung, sesuai grafik Bag Filter. Posisi yang diganti beberapa kali dihitung pada setiap kejadian; replay idempoten tidak menambah total. Field `recorded`/`total` tetap tersedia untuk cakupan posisi, terpisah dari jumlah penggantian tahunan. Payload pencatatan tetap; pembatalan memakai endpoint dan migrasi aditif tersendiri.

`updatedAt` adalah waktu pembaruan terakhir pada equipment, dalam ISO UTC, atau `null` bila belum ada batch. Nilai merupakan maksimum `createdAt` batch dan waktu pembatalannya, termasuk pemasangan bertanggal mundur; bukan waktu halaman dimuat, tanggal pemasangan, atau hasil filter riwayat. Header menampilkan tanggal ringkas dalam WIB, dengan jam lengkap tersedia pada tooltip.

Contoh payload batch:

```json
{
  "equipmentCode": "561-BF1",
  "positions": [{ "side": "Utara", "compartment": 1, "column": 1, "row": 17 }],
  "installedAt": "2026-10-01T01:00:00.000Z",
  "reason": "Penggantian bag bocor",
  "brand": "Filtras",
  "wo": "WO-001"
}
```

`compartment` adalah nomor lokal sisi dari kiri ke kanan, bukan selalu nomor tampilan. Batas dan pemetaan mengikuti equipment:

| Equipment         | Nilai `side`   | Lokal kompartemen               | `column:1` → `column:8` | Baris valid | Contoh label |
| ----------------- | -------------- | ------------------------------- | ----------------------- | ----------- | ------------ |
| 561-BF1 / 562-BF1 | Utara, Selatan | 1–12; Selatan tampil 24–13      | H → A                   | 1–17        | `24 A1`      |
| 421-BF1 / 422-BF1 | A, B           | 1–15, tampil dengan sufiks sisi | A → H                   | 1–17        | `15B H1`     |
| L61-BF1 / L62-BF1 | Timur, Barat   | 1–8; Barat tampil 16–9          | A → H                   | 1–16        | `16 A1`      |

Respons equipment/state memakai `colorScaleDays:1260` untuk keenam equipment; ini konfigurasi tampilan, bukan pembatasan umur aktual. `older1260` pada dashboard dan per-equipment menghitung umur ≥1.260 hari untuk KPI/penanda saat ini. Field `older900` tetap disediakan sebagai kompatibilitas pembaca lama, dengan arti ≥900 hari; UI baru tidak memakainya. Respons equipment/state menyertakan `rows`, `columns`, `sides: [{name,labels,descendingRows}]`, `rowDividerAfter`, dan `centeredLabels`, selain jumlah kompartemen/bag. `labels` diindeks nomor lokal minus satu. `rowDividerAfter` adalah nomor baris fisik sebelum batas pemisah: nilai 8 memisahkan baris 8–9 pada L61/L62, nilai 9 memisahkan baris 9–10 pada 561/562 dan 421/422. Batas mengikuti orientasi naik/turun setiap sisi dan ditampilkan sebagai margin tanpa border, bukan posisi tambahan.

Batch dan timeline menolak sisi/koordinat yang tidak sesuai equipment dengan 400. Kode `422-BF2` tidak diterima dan alamat equipment lama menghasilkan 404. History memakai label lapangan baru. Sesudah migrasi, klien harus reload dan memakai representasi koordinat baru; hash batch lama diperbarui sehingga payload baru yang ekuivalen dengan key lama tetap replay.

Header `Idempotency-Key` wajib: 8–128 karakter `[A-Za-z0-9._:-]`. Payload dikanonisasi, tanggal dinormalisasi UTC, posisi diurutkan; actor/key sama dengan payload berbeda ditolak409. Cursor bersifat opaque.

Pencatatan baru wajib mengirim `brand`, salah satu dari `Intensiv filter (Original)`, `Filtras`, `Cipta Medya`, atau `Other`. Satu brand berlaku untuk seluruh posisi batch; `Other` tidak mempunyai teks tambahan. Brand kosong, null, atau tidak dikenal ditolak 400. Brand termasuk dalam payload idempotensi: perubahan brand dengan key yang sama ditolak 409. Payload tanpa brand hanya diterima untuk replay batch lama yang memang dibuat tanpa brand; tidak boleh membuat transaksi baru.

Respons batch dan timeline memuat `brand: string | null`; null untuk catatan sebelum penambahan field dan ditampilkan “Belum tercatat”. Audit pencatatan baru memuat `details.brand`. Hash dan audit historis tidak diisi merek secara asumsi.

Error JSON `{error,code}`; kegagalan tak terduga memakai `{error,requestId}`. 400 invalid, 401 belum login/sesi berakhir, 403 izin/origin, 404 tidak tersedia, 409 konflik, 413 body terlalu besar, 415 tipe body, 429 login limiter, 503 dependency gagal. Body batch maksimal128KB; endpoint Auth management dan pembatalan8KB. Tidak tersedia endpoint edit, hard delete, pembatalan sebagian, atau pengaktifan kembali.

### Pembatalan batch

POST `/equipment/:code/batches/:batchId/cancel` menerima objek strict `{reason}` dengan alasan trim 1–500 karakter. `Idempotency-Key` wajib 8–128 karakter sesuai pola existing. Actor dan waktu UTC ditentukan server. Izin `cancel` hanya admin Bag Filter dalam scope; semua pemeriksaan sesi, origin dan izin dijalankan sebelum replay. Batch di luar equipment URL menghasilkan 404.

Respons `cancellation` berisi `{reason,actorId,actorName,cancelledAt}`; `status` adalah `cancelled`. Actor/key/payload identik mengembalikan metadata asli dan `replayed:true`. Key sama untuk payload berbeda menghasilkan 409. Pembatalan yang sudah ada dengan permintaan berbeda menghasilkan 409 `BATCH_ALREADY_CANCELLED`. Transaksi mengunci batch, menyimpan satu pembatalan dan satu audit `bag.batch_cancelled`; batch/pemasangan/hash asli tidak diubah. Retry pencatatan asli setelah pembatalan menghasilkan 409 `BATCH_CANCELLED`.

GET batch history dan timeline menambahkan `status: active|cancelled` serta `cancellation:null|{reason,actorId,actorName,cancelledAt}`. Keduanya tetap menyertakan record batal dengan urutan/cursor existing; deep link ID tetap bekerja. `endedAt` hanya bermakna pada record aktif: masa pakai dihitung di antara pemasangan sah, sementara record batal tidak mempunyai masa pakai dan tidak dianggap terpasang sekarang walaupun `endedAt:null`.

Snapshot, KPI, grafik, cakupan, umur dan distribusi mengecualikan pembatalan sebelum ranking pemasangan. Aktivitas, notifikasi dan discovery operasional mengecualikan batch batal. `updatedAt` kini merupakan maksimum waktu pencatatan atau pembatalan equipment, bukan hanya batch terakhir. Audit memuat tindakan dan `details.reason` untuk pembatalan. Migrasi aditif `0003_batch_cancellations` diperlukan sebelum aplikasi baru dijalankan; seluruh data lama dianggap aktif tanpa penulisan ulang.

## UI refresh: ringkasan, pencarian, aktivitas, dan sesi

Semua endpoint berikut memakai identitas server, permission read Bag Filter, scope equipment terkini, dan Cache-Control no-store. Viewer dapat membaca ringkasan; admin portal tanpa grant Bag Filter tidak mendapat akses data aplikasi.

- GET `/bag-filter/api/dashboard?year=2026`: `year`, `currentYear`, `total`, `installed`, `neverInstalled`, `older1260`, `older900` (legacy), `distribution` (tujuh bucket umur berurutan: 0–209, 210–419, 420–629, 630–839, 840–1049, 1050–1259, 1260+ hari), `perEquipment`, `series` (tepat empat elemen `{quarter:1..4,label:'Q1'..'Q4',total,brands}`), `periodTotal`, `previousTotal`, `recent`, `serverTime`. Tahun opsional, default tahun saat ini WIB; integer 2000 sampai tahun berjalan, selainnya ditolak 400. Parameter `days` tidak lagi dipakai. Q1 Januari–Maret, Q2 April–Juni, Q3 Juli–September, Q4 Oktober–Desember. Grafik menjumlahkan posisi batch menurut `installedAt` dalam batas tahun/kuartal Asia/Jakarta; tanggal mundur masuk periode pemasangannya. `periodTotal` adalah jumlah tahun terpilih (tahun berjalan parsial), `previousTotal` total tahun kalender sebelumnya. Posisi terkini, umur, distribusi, dan aktivitas tidak dibatasi filter tahun grafik. Tahun tanpa transaksi tetap mengembalikan empat kuartal bernilai nol.
- GET /bag-filter/api/activity: maksimal 12 batch terbaru, diurutkan createdAt lalu ID, dalam scope pengguna. Ini sumber notifikasi; status sudah dibaca tersimpan per browser/pengguna, tanpa tabel notifikasi baru.
- GET /bag-filter/api/discovery?q=teks: equipment dalam scope dan maksimal 12 batch yang cocok dengan equipment, WO, alasan, brand, atau ID. Maksimal 200 karakter; pencarian LIKE meng-escape wildcard input.
- Snapshot equipment menambahkan brand pada setiap posisi aktif. Batch history menerima ID batch sebagai pencarian persis agar deep link ?batch=ID membuka hasil yang sama.
- Identitas internal Auth menambahkan sessionExpiresAt (ISO UTC). Nilai hanya untuk timer; kedaluwarsa tetap diperiksa server, tidak dapat diperpanjang oleh UI.

Tidak ada migrasi database pada UI refresh ini.

## Consumable Room v1.1 — R22 satu stok

Base `/consumables/api`. Identitas, origin, no-store dan error mengikuti platform. Quantity/packSize/balanceAfter berupa string DECIMAL(18,6). Actor, waktu, nomor dokumen, saldo dan faktor aktual ditentukan server. `locationId`/field lokasi stok tidak diterima pada body/filter; 400. `functionalLocation` Picklist dan HEC tetap menunjukkan tujuan pekerjaan, bukan ruang stok.

| Method         | Path                                                                       | Kontrak                                                                                                                                |
| -------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| GET            | `/materials?q=&category=&active=&cursor=&limit=`                           | `{items,nextCursor}`, katalog master                                                                                                   |
| GET            | `/materials/:id`                                                           | `{material,stock:InventoryItem                                                                                                         | null}`; material mempunyai `unitLocked` |
| GET            | `/search?q=`, `/catalog-search?q=`                                         | Maksimal 8 hasil peringkat MMID/nama/alias/SAP; catalog-search membutuhkan receive                                                     |
| GET            | `/hec-suggestions?q=`                                                      | `{items:string[]}`, maksimal 8 HEC normalized                                                                                          |
| GET            | `/inventory?q=&materialId=&category=&availability=&active=&cursor=&limit=` | Satu inventory per material; rak opsional; available/empty/uncounted/critical                                                          |
| GET            | `/documents?q=&type=&reservationNo=&from=&to=&cursor=&limit=`              | Dokumen semua pengguna R22; type consume/return/picklist                                                                               |
| GET            | `/documents/:id`                                                           | `{document,lines}`; snapshot bukti final                                                                                               |
| GET            | `/movements?q=&materialId=&type=&from=&to=&cursor=&limit=`                 | Ledger lengkap, termasuk v1 dan baris dokumen; tanggal WIB inklusif                                                                    |
| GET            | `/movements/:id`                                                           | `{movement}`                                                                                                                           |
| POST/PATCH     | `/materials[/:id]`                                                         | MMID, description, commonName?, aliases?, unit, sapUnit?, decimalAllowed?, category, mrpType?, critical?, packSize?, active?, version? |
| POST/PATCH     | `/inventory[/:id]`                                                         | `{materialId,rack?,active?,version?}`; R22 ditentukan server                                                                           |
| POST           | `/opening-balances`, `/adjustments`                                        | `{materialId,quantity,reason,expectedVersion}`; admin, jumlah fisik target                                                             |
| POST           | `/consume-orders`                                                          | `{hec,wo?,note?,requester?,lines:[{materialId,quantity}]}`; 1–50 material unik                                                         |
| POST           | `/return-orders`                                                           | Seperti Consume + `sourceRef?`; jumlah menambah saldo                                                                                  |
| POST           | `/picklist-receipts`                                                       | `{reservationNo,wo,woDescription?,equipmentNo?,functionalLocation?,costCenter?,requiredDate?,lines}`; 1–100 material unik              |
| GET            | `/categories`, `/dashboard?year=`, `/activity`, `/discovery?q=`            | Kategori, KPI material dikelola, empat kuartal dokumen/opening/koreksi, aktivitas dokumen dan pencarian                                |
| GET            | `/audit?cursor=`, `/reconciliation`                                        | Admin; audit dan selisih saldo vs ledger read-only                                                                                     |
| GET/POST/PATCH | `/locations[/:id]`                                                         | 410, fitur lokasi stok dihentikan                                                                                                      |
| POST           | `/issues`, `/receipts`                                                     | 410, gunakan endpoint dokumen                                                                                                          |

Picklist line: `{materialId,sapQuantity,materialVersion}` atau `{materialId,quantity}`. Jumlah SAP dikonversi memakai master terkunci; perubahan versi/konversi menghasilkan konflik. Required Date format YYYY-MM-DD, bukan waktu transaksi. Reservasi berulang mengembalikan `previousDocuments` sebagai peringatan. K3 auto-enroll material baru dengan opening nol; inventory existing belum dihitung/nonaktif ditolak.

HEC Consume/Return wajib format XXX-XXX, dinormalisasi kapital dan prefiks `TQ.` dihapus. Requester hanya boleh Cashier/Admin (`{name,nik?}`), actor tetap sesi. Role API viewer/operator/storekeeper/admin ditampilkan Viewer/Client/R22 Cashier/Admin. Semua grant membaca stok dan dokumen R22 yang sama.

POST stok/dokumen wajib `Idempotency-Key` (8–128 `[A-Za-z0-9._:-]`). Dokumen: `{document,lines,replayed,previousDocuments?}`, 201 baru/200 replay. Saldo awal/koreksi: `{movement,replayed}`. Key unik per actor; payload berbeda 409; izin tetap diperiksa sebelum replay. Seluruh dokumen dan ledger atomik. Kegagalan baris:

```json
{
  "error": "Ada baris yang perlu ditinjau. Saldo belum diubah.",
  "code": "STOCK_LINE_CONFLICT",
  "lines": [
    {
      "materialId": "uuid",
      "mmid": "SYNTHETIC",
      "requested": "3.000000",
      "available": "2.000000",
      "error": "Stok tidak cukup."
    }
  ]
}
```

Pagination keyset default 50, limit 1–50. Pencarian maksimal 200 karakter, token AND, wildcard literal di-escape. `active=all` menyertakan nonaktif. PATCH wajib version terkini; MMID immutable, unit terkunci setelah transaksi pertama. Tidak ada hard delete/edit dokumen. Legacy `job`, `packs`, `reference` tetap tersimpan untuk history v1.

Grant: POST `/auth/manage/admin/users/:id/grants/:appId`, diproksi Portal `/api/admin/users/:id/grants/:appId`. Body `{grant:{appId:"consumables",role}}` atau `{grant:null}`. `locationIds` ditolak. Grant Bag Filter tetap `{appId:"bag-filter",role,equipment}`; wrapper `/grant` khusus Bag Filter. Metadata `/auth/manage/admin/applications/consumables/locations` dan proxy Portal 404. `/consumables/internal/locations` dihapus dan tetap diblokir gateway. Tidak ada dependensi metadata lokasi ketika mengubah grant.
