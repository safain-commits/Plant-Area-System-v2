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

| Method | Path setelah `/bag-filter/api`                                       | Respons                                           |
| ------ | -------------------------------------------------------------------- | ------------------------------------------------- |
| GET    | `/equipment`                                                         | Equipment dalam scope                             |
| GET    | `/equipment/:code/state`                                             | `{equipment,positions,recorded,total,serverTime}` |
| GET    | `/equipment/:code/batches?q=&cursor=`                                | `{items,nextCursor}`; 50 batch                    |
| POST   | `/equipment/:code/batches`                                           | 201 baru, 200 replay; `{batchId,count,replayed}`  |
| GET    | `/equipment/:code/positions?side=&compartment=&column=&row=&cursor=` | Timeline 50; `endedAt:null` berarti terkini       |
| GET    | `/audit?cursor=`                                                     | Admin Bag Filter; hanya equipment dalam scope     |

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

Respons equipment/state menyertakan `rows`, `columns`, `sides: [{name,labels,descendingRows}]`, `rowDividerAfter`, dan `centeredLabels`, selain jumlah kompartemen/bag. `labels` diindeks nomor lokal minus satu. `rowDividerAfter` adalah nomor baris fisik sebelum batas pemisah: nilai 8 memisahkan baris 8?9 pada L61/L62, nilai 9 memisahkan baris 9?10 pada 421/422. Batas mengikuti orientasi naik/turun setiap sisi dan ditampilkan sebagai margin tanpa border, bukan posisi tambahan.

Batch dan timeline menolak sisi/koordinat yang tidak sesuai equipment dengan 400. Kode `422-BF2` tidak diterima dan alamat equipment lama menghasilkan 404. History memakai label lapangan baru. Sesudah migrasi, klien harus reload dan memakai representasi koordinat baru; hash batch lama diperbarui sehingga payload baru yang ekuivalen dengan key lama tetap replay.

Header `Idempotency-Key` wajib: 8–128 karakter `[A-Za-z0-9._:-]`. Payload dikanonisasi, tanggal dinormalisasi UTC, posisi diurutkan; actor/key sama dengan payload berbeda ditolak409. Cursor bersifat opaque.

Pencatatan baru wajib mengirim `brand`, salah satu dari `Intensiv filter (Original)`, `Filtras`, `Cipta Medya`, atau `Other`. Satu brand berlaku untuk seluruh posisi batch; `Other` tidak mempunyai teks tambahan. Brand kosong, null, atau tidak dikenal ditolak 400. Brand termasuk dalam payload idempotensi: perubahan brand dengan key yang sama ditolak 409. Payload tanpa brand hanya diterima untuk replay batch lama yang memang dibuat tanpa brand; tidak boleh membuat transaksi baru.

Respons batch dan timeline memuat `brand: string | null`; null untuk catatan sebelum penambahan field dan ditampilkan “Belum tercatat”. Audit pencatatan baru memuat `details.brand`. Hash dan audit historis tidak diisi merek secara asumsi.

Error JSON `{error,code}`; kegagalan tak terduga memakai `{error,requestId}`. 400 invalid, 401 belum login/sesi berakhir, 403 izin/origin, 404 tidak tersedia, 409 konflik, 413 body terlalu besar, 415 tipe body, 429 login limiter, 503 dependency gagal. Body batch maksimal128KB; endpoint Auth management8KB. Tidak ada endpoint koreksi/delete transaksi di rilis ini.
