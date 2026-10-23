# Tema UI — Clean Modern Industrial

Palette sumber: `tmp/color-palette.svg`. Portal, Auth, dan Bag Filter menggunakan stylesheet dan komponen tema bersama dari `@plant/ui`. Preferensi awal **Sistem** mengikuti perangkat; tombol ikon matahari/bulan mengganti **Terang/Gelap** dalam satu klik. Pilihan **Sistem** tersedia di **Profil ? Tampilan ? Preferensi tema**. Sidebar tetap gelap pada kedua mode.

## Palette dan token

| Peran / token                          | Terang                | Gelap                 |
| -------------------------------------- | --------------------- | --------------------- |
| Brand Lime / `--brand-lime`            | `#BDFB07`             | Sama                  |
| Brand Black / `--brand-black`          | `#0A0B0B`             | Sama                  |
| Brand White / `--brand-white`          | `#FFFFFF`             | Sama                  |
| Myrtle Green / `--brand-green`         | `#193618`             | Sama                  |
| Pumpkin / `--brand-pumpkin`            | `#FF7300`             | Sama                  |
| Lavender Indigo / `--brand-lavender`   | `#9B5DE6`             | Sama                  |
| Slate / `--brand-slate`                | `#383F45`             | Sama                  |
| Latar / `--page`                       | `#F4F6F7`             | `#0A0B0B`             |
| Panel/input / `--surface`              | `#FFFFFF`             | `#161B1F`             |
| Permukaan sekunder / `--surface-muted` | `#EBEFF1`             | `#22292F`             |
| Teks / `--text`                        | `#0A0B0B`             | `#F5F7F8`             |
| Teks sekunder / `--text-muted`         | `#5F6B73`             | `#B5BEC6`             |
| Border dekoratif / `--border`          | `#D9DFE3`             | `#383F45`             |
| Border kontrol / `--control-border`    | `#7A858D`             | Sama                  |
| Informasi / `--info-bg`, `--info-text` | `#F4ECFC` / `#7138B5` | `#2B2038` / `#C9A7F3` |
| Focus / `--focus`                      | Myrtle Green          | Lime                  |

Warna `#383F45` diberi nama **Slate** untuk membedakannya dari Myrtle Green `#193618`; SVG asal memberi keduanya nama yang sama. Turunan netral dan warna status lengkap ada di bagian `:root` stylesheet. Nilai UI tidak ditulis langsung di komponen aplikasi. Teks pendukung dark mode dinaikkan menjadi `#B5BEC6`; metadata history/timeline dan label koordinat memakai 12 px. Tombol koordinat memakai pasangan `--info-bg`/`--info-text`, hover memakai `--info-hover` (`#E9D9F8` / `#3A2B4B`) agar label tidak kembali menjadi hijau tua pada latar gelap.

## Pemakaian komponen

- Aksi utama memakai `button.primary`: Lime dengan teks Black; hover `#AEE609`. Menu aktif juga Lime dan tetap aktif ketika di-hover. Jangan memakai Lime untuk semua tombol atau seluruh kartu.
- Tombol biasa/`secondary` menggunakan permukaan netral dan border kontrol. `danger` memakai merah dengan teks putih untuk penonaktifan aplikasi dan reset password. Kondisi disabled memiliki token sendiri.
- Panel dan kartu memakai radius 10–12 px dan bayangan netral tipis pada mode terang. Hero Portal dan panel identitas Auth memakai Myrtle Green; aksen brand Lime tetap kecil.
- Badge informasi/peran, jumlah history, dan tautan koordinat memakai Lavender lembut. Badge `success` dan notice keberhasilan memakai hijau; `neutral` dipakai pada rencana/nonaktif; `orange` memakai Pumpkin lembut untuk perhatian. Pesan error tetap merah dengan teks penjelasan.
- Kompartemen overview menggunakan Myrtle Green pada mode terang dan Slate pada mode gelap, keduanya dengan label putih. Field, tabel, placeholder, loading, notice, focus, dan kontrol native mengikuti tema.

Contoh:

```tsx
<button className="primary">Simpan</button>
<button className="secondary">Kembali</button>
<button className="danger">Nonaktifkan</button>
<span className="badge success">Aktif</span>
```

## Kontrak tema

`ThemePreference = 'light' | 'dark' | 'system'`, `ResolvedTheme = 'light' | 'dark'`. Root layout setiap aplikasi menyertakan `ThemeScript` di head dan `ThemeProvider` di body. `ThemeToggle` ditempatkan di topbar atau di atas form Auth; ukurannya 36 ? 36 px di desktop dan 40 ? 40 px di mobile. `ThemePreferenceControl` menyediakan tiga pilihan di Profil. Ikon menunjukkan tema aktif, title menjelaskan aksi berikutnya, dan tombol mempunyai label aksesibel **Tema gelap** serta `aria-pressed`.

- `ThemeScript` menetapkan `data-theme` dan `data-theme-preference` sebelum konten ditampilkan. Hanya kedua atribut html ini yang memerlukan `suppressHydrationWarning`; isi halaman tetap melalui pemeriksaan hydration normal.
- Preferensi disimpan di `localStorage['plant-ui-theme']`, berlaku pada origin/browser yang sama, lintas tab dan aplikasi. Logout tidak menghapus preferensi. Tidak ada sinkronisasi akun/perangkat, cookie tambahan, API tema, atau migrasi database.
- Provider mengikuti perubahan `prefers-color-scheme` hanya dalam mode Sistem dan menangani event storage antar-tab. Event sessionStorage diabaikan. Saat halaman kembali dari back/forward cache, preferensi dan tema perangkat dibaca ulang. Listener dibersihkan saat unmount. Pergantian tema tidak mengganti key atau me-remount isi halaman sehingga draft tetap ada.
- Preferensi invalid/hilang kembali ke Sistem. Storage yang diblokir tidak menghalangi pemilihan pada halaman aktif; setelah navigasi dokumen/reload kembali mengikuti Sistem.
- CSS menggunakan `color-scheme` dan `light-dark()` untuk satu sumber token, termasuk fallback sesuai perangkat sebelum JavaScript berjalan. Target browser adalah browser modern dengan dukungan CSS ini, termasuk Chromium yang dipakai pilot. Browser lawas tanpa dukungan `light-dark()` tidak termasuk target validasi.
- Script hanya memuat konstanta terpercaya dan berjalan dengan CSP deployment yang sudah ada; tidak menambah izin CSP atau resource eksternal.

## Peta sebagai warna data

Fungsi `bagColor` tetap identik: hijau 0–900 hari dan nilai abu-abu kosong `#E6EAE9` sama pada kedua tema. Pumpkin `--bag-selected` menandai bag terpilih, dengan outline pilihan dan focus keyboard yang terpisah. Garis netral pada mode gelap membantu membedakan bag tua dari latar. Swatch legenda mempunyai outline netral agar warna umur paling tua tetap tampak tanpa mengubah nilai warna datanya.

Label detail dipilih melalui `dataTextTone` berdasarkan luminansi warna sel. Token data memakai hitam murni `#000000` atau putih `#FFFFFF` agar seluruh langkah umur melewati rasio 4,5:1; hitam brand tetap digunakan untuk tombol Lime/Pumpkin. Pengujian unit memeriksa seluruh 21.601 langkah jam hingga 900 hari, nilai kosong, serta umur di atas batas.

Koordinat, orientasi, letak label kolom, jeda stiffener tanpa border, pilihan lintas kompartemen, dan persistence tidak berubah akibat tema.

## Verifikasi dan referensi

Tes browser berada di `tests/e2e/theme.spec.ts`: preferensi Sistem/manual, reload, sinkronisasi tab, storage diblokir, initial theme tanpa bundle framework, navigasi tiga aplikasi, kedua tema pada enam peta, kontras token, draft, focus, dan logout. Akun tes tersendiri dibuat dan dihapus hanya pada deployment uji. Smoke test SSO/pencatatan tetap memakai suite platform.

Standar pemeriksaan: [WCAG kontras teks](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [WCAG kontras nonteks](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). Implementasi merujuk [React hydration](https://react.dev/reference/react-dom/client/hydrateRoot), [React effect lifecycle](https://react.dev/reference/react/useEffect), dan [CSS light-dark](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark). Hasil pemeriksaan aktual dicatat di `VALIDATION.md`.
