# Audit interaksi UI — 23 Oktober 2026

Perbaikan hover dan dropdown sudah diterapkan pada komponen bersama. Build produksi lokal diperbarui pada `https://localhost:8443`. Pengujian ini mencakup Portal, Auth, Bag Filter, dan Consumable Room; tidak dilakukan pada deployment produksi.

## Bug yang diperbaiki

| Temuan sebelum perbaikan                                            | Penyebab dan perubahan                                                                                                                                                                        |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Teks akun, detail sesi, dan chevron sulit dibaca ketika hover       | Selector global `button:hover:not(:disabled)` mengalahkan warna permukaan komponen. Hover dasar sekarang memakai specificity rendah; akun/sesi dan navigasi mempunyai hover netral eksplisit. |
| Tombol keluar pada tema gelap memakai teks hitam di permukaan gelap | Aturan hover sidebar lama menimpa latar tombol. Latar dan teks hover kini memakai pasangan token tombol utama.                                                                                |
| Dropdown tahun tetap terbuka setelah klik di luar                   | Dialog berada dalam label field; aktivasi label dapat membuka trigger kembali. Overlay sekarang memakai portal ke `document.body`, dengan batas propagasi event React.                        |

Baseline browser lokal mereproduksi kedua kelompok bug. Teks nama akun pada hover terang memiliki kontras sekitar **1,30:1**, dan menu tahun tetap `aria-expanded="true"` setelah klik backdrop. Dua tes regresi awal gagal pada kondisi tersebut sebelum build perbaikan diterapkan.

Klik backdrop hanya menutup overlay jika penekanan pointer juga dimulai di backdrop. Pencarian/klik di dalam menu serta drag dari dalam ke luar tidak menutupnya. Escape, pemilihan opsi, fokus kembali ke trigger, dan draft pada sheet penggantian tetap berfungsi. `react-dom` dicantumkan sebagai dependency eksplisit `@plant/ui` pada versi yang sudah dipakai aplikasi.

## Hasil TestSprite

TestSprite dijalankan melalui MCP dengan tiga kasus terarah, akun sintetis sementara, dan build produksi. Hasil mentah tetap berada di folder lokal yang diabaikan Git dan Docker. Status di bawah mengikuti laporan alat, tanpa mengubah kegagalan menjadi lulus.

| Kasus                             | Status alat | Observasi dan batas pemeriksaan                                                                                                                                                                                                                                                                  |
| --------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TC002 — dropdown dismissal        | Failed      | Alat melaporkan penutupan dropdown desktop Bag Filter/Consumables melalui Escape dan klik di luar, serta nilai tahun tetap. Kasus tidak selesai karena kontrol browser alat tidak dapat mengganti ukuran viewport untuk pemeriksaan mobile.                                                      |
| TC007 — hover terang              | Blocked     | Login dan halaman stok/pengelolaan tercapai. Kontrol browser yang tersedia pada run ini tidak menyediakan aksi hover; kontras hover tidak dapat dinilai oleh TestSprite.                                                                                                                         |
| TC009 — hover gelap dan dismissal | Failed      | Alat melaporkan menu tahun tetap terbuka setelah klik Tema. Hover/pointer leave juga tidak dapat dijalankan. Skrip ekspor memeriksa posisi absolut `dialog[8]`; identitas dialog pada assertion tidak dipastikan. Skenario Tema diperiksa lagi dengan pointer nyata seperti dijelaskan di bawah. |

**Tidak ada kasus TestSprite yang lulus secara penuh: 0 passed, 2 failed, 1 blocked.** Ini bukan klaim bahwa semua observasi desktop gagal, maupun bahwa semua aspek UI sudah diverifikasi oleh TestSprite.

Run awal terhalang cookie sesi: login menghasilkan 200, tetapi request berikutnya melalui tunnel HTTP tidak membawa cookie `Secure` dan diarahkan kembali ke login. Adapter loopback pengujian sementara menjembatani cookie hanya untuk origin pengujian HTTP, sambil mempertahankan cookie upstream HTTPS dan konfigurasi aplikasi. Setelah itu login TestSprite berhasil mencapai Portal serta API kedua aplikasi. Adapter dan tunnel dihentikan setelah pengujian; perubahan adapter tidak menjadi bagian deployment.

## Verifikasi browser lokal

Playwright Chromium memakai gateway HTTPS, pointer hover/click nyata, dan akun fixture terpisah. Empat belas skenario dijalankan bersama dan lulus; satu skenario tambahan untuk laporan Tema TestSprite kemudian dijalankan dan lulus. Total **15 skenario unik lulus**:

- Enam skenario pada `tests/e2e/ui-interactions.spec.ts`: kontras hover terang/gelap, dismissal pada viewport 1440/390 px, menu pabrikan di dalam sheet tanpa kehilangan draft, serta klik Tema ketika dropdown tahun Portal terbuka.
- Tiga skenario Consumables UI polish: dashboard, skala kuartal/error/retry, serta sidebar sesuai peran.
- Dua skenario operasional Consumables: SSO, saldo awal/penerimaan/pemakaian/history, dan penolakan akses yang tidak sah. Fixture transaksi dibersihkan oleh suite.
- Empat skenario tema/platform: Sistem/manual/storage, sebelum hydration, lintas aplikasi, enam peta, sheet, kalender, keyboard, dan kontras warna bag.

Tes hover memeriksa warna teks hasil computed style terhadap latar komposit aktual, termasuk nama/email akun, detail sesi, logout, menu equipment, opsi dropdown, filter stok, baris stok yang tersedia, dan tab pengelolaan. Teks yang diperiksa memenuhi **4,5:1** pada kedua tema. Screenshot hover akun terang/gelap juga diperiksa secara visual.

Temuan TC009 **tidak direproduksi dengan klik pointer nyata** di Portal pada kedua tema: klik posisi tombol Tema saat menu tahun terbuka menutup menu tahun, mempertahankan nilainya, dan mengembalikan fokus. Klik berikutnya membuka Tema; menu tahun tetap tertutup. Menu tema dan notifikasi juga lulus dismissal di luar serta pengembalian fokus. Ini adalah hasil verifikasi lokal terpisah, bukan penggantian status TestSprite.

Pengujian 390 px menggunakan viewport Chromium, bukan perangkat ponsel fisik. Audit ini bukan sertifikasi aksesibilitas lengkap atau jaminan kontras setiap elemen di seluruh aplikasi.

## Pemeriksaan tambahan dan pembersihan

- Typecheck root lulus; build Next.js memeriksa TypeScript keempat aplikasi.
- Seluruh **12 unit test** lulus.
- Build Docker Auth, Portal, Bag Filter, dan Consumables dengan frozen lockfile berhasil; keempat container sehat setelah pembaruan.
- Pemeriksaan format pada file perbaikan lulus.
- Akun TestSprite, grant, dan sesinya dicabut/dihapus. Pemeriksaan database memastikan akun tersebut menghasilkan **nol batch Bag Filter, nol pergerakan stok, dan nol audit operasional Consumables**.
- Kredensial pada artefak TestSprite disamarkan setelah akun dicabut. Folder `testsprite_tests/` dikecualikan dari Git dan image Docker; arsip/katalog internal tidak diunggah sebagai dokumen pengujian.

Tidak menjalankan ulang seluruh integrasi MySQL atau backup/restore untuk perbaikan interaksi ini, karena tidak ada perubahan schema maupun logika transaksi.

Referensi implementasi: [React createPortal](https://react.dev/reference/react-dom/createPortal) menjelaskan bahwa event portal tetap mengikuti pohon React; karena itu pemindahan DOM disertai penghentian propagasi di batas dialog. Dokumentasi React diperiksa melalui Context7.
