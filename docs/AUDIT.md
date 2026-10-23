# Audit baseline Plant Area System

> Koreksi lapangan setelah audit awal (22 Oktober 2026): kode yang benar adalah **422-BF1**; 421/422 memakai sisi A/B dan kolom A–H. Katalog v2.1 menambah L61/L62, masing-masing 16 kompartemen × 128 bag, dengan sisi Timur/Barat. Uraian audit awal di bawah tetap merekam keadaan source ekspor; acuan implementasi terbaru adalah PRD v2.1.

Tanggal baseline: 22 Oktober 2026. PRD referensi: `Plant_Area_System_PRD.md` versi 1.0, 1 Oktober 2026, tersimpan di arsip lokal workspace asal. Audit ini memisahkan kondisi ekspor lama dari implementasi v2 di `apps/` dan `packages/`.

## Kesimpulan

Bag Filter memiliki fitur inti paling siap dipisahkan, tetapi fondasi autentikasi, penyimpanan, dan integritas transaksinya perlu diganti. Source ekspor sebenarnya memakai Vinext, React, Cloudflare D1/R2; dependency Next.js yang tersedia belum berarti aplikasi ekspor berjalan sebagai Next.js. Schema Drizzle tersedia, sementara banyak API operasional memakai SQL langsung melalui D1.

| Modul                                                   | Kondisi source ekspor                                                          | Keputusan                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------- |
| Dashboard                                               | Navigasi, ringkasan stok/drawing, pencarian, aktivitas; terikat seluruh modul  | Portal baru dengan katalog dan pengelolaan akses  |
| Akun/profil/admin                                       | Registrasi, approval, password, sesi, role, scope, aktivitas memiliki backend  | Referensi kebutuhan; ganti autentikasi            |
| Bag Filter                                              | Empat equipment, overview/detail, umur, multi-bag, WO, history, demo persisten | Aplikasi pertama                                  |
| Consumable Room                                         | Master material, masuk/keluar, saldo, pencarian, pemeriksaan stok              | Tahap berikutnya                                  |
| Drawing Database                                        | Request, penugasan, pemeriksaan, approval, revisi, konflik perubahan           | Tahap berikutnya; file masih data URL di database |
| RCA                                                     | Editor, diagram, tindakan, versi, lampiran R2, ekspor                          | Audit khusus sebelum dipindahkan                  |
| Part Cost                                               | Kalkulasi dan cetak; state hilang ketika reload                                | Prototipe UI                                      |
| Project                                                 | Referensi tahapan PMA                                                          | Belum aplikasi pengelolaan project                |
| Apron Conveyor, Grate Cooler, Utilities, Monthly Report | Halaman awal/placeholder                                                       | Backlog                                           |
| Tools Tracking                                          | Kartu rencana                                                                  | Backlog                                           |

## Temuan Bag Filter dan penanganan v2

| Temuan baseline                              | Perubahan v2                                                   |
| -------------------------------------------- | -------------------------------------------------------------- |
| Bag aktif berdasarkan urutan pencatatan      | Urut `installed_at DESC, id DESC` dengan window function       |
| Batch tanpa WO terpecah                      | UUID batch selalu dibuat, terpisah dari WO                     |
| Demo aktif secara bawaan                     | Migrasi hanya mengisi katalog equipment/koordinat              |
| Audit dan penggantian tidak atomik           | Satu transaksi untuk batch, pemasangan, audit                  |
| Retry berpotensi menggandakan transaksi      | Key unik per actor + hash payload; konflik berbeda menjadi 409 |
| Endpoint mengambil stok/material tak terkait | API khusus Bag Filter                                          |
| Seluruh history dimuat sekaligus             | Seek pagination server, 50 batch/timeline/audit                |

## Bukti dan batas audit

- Manifest 359 file lulus; `pnpm check:export` tetap lulus setelah implementasi v2 dan pemindahan arsip. Source `site-source/`, `local-app/`, PRD awal, manifest, dan verifier dipertahankan di `.arsip/ekspor-2026-10-22/` pada workspace lokal. Arsip berisi data internal sehingga tidak disertakan dalam repo publik.
- Dua folder aplikasi adalah salinan, dengan lima file berbeda dan dua tambahan lokal.
- Suite ekspor awal melewati 12 pemeriksaan sebelum gagal karena path Windows. Normalisasi hanya pada harness sementara menghasilkan 14 pemeriksaan lulus; source referensi tidak diubah.
- Jumlah koordinat, determinisme demo, 19 WO demo per equipment, dan masalah tanggal mundur diverifikasi pada baseline.
- Paket tidak membawa `.git`, database operasional, atau lampiran live. Katalog internal 17.744 baris tidak diimpor.
- Audit awal belum menguji build/typecheck/browser. Validasi implementasi baru dicatat terpisah di `VALIDATION.md`.

Tidak ada klaim bahwa modul di luar Bag Filter telah dipindahkan atau siap produksi.
