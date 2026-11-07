# Panduan agen untuk Plant Area System v2

## Konteks proyek

Repositori ini berisi Portal SSO, Bag Filter, dan Consumable Room R22. Source aktif berada di `apps/`, `packages/`, `infra/`, dan `scripts/`.

- Mulai dari [README.md](README.md) untuk setup dan perintah proyek.
- Gunakan [PRD v2](docs/PRD-v2.md), [PRD Consumable Room](docs/CONSUMABLE-ROOM-PRD.md), [kontrak API](docs/API.md), dan [tema UI](docs/UI-THEME.md) sesuai bagian yang dikerjakan.
- Edit package bersama melalui source `packages/*`. Gunakan versi Node dan pnpm yang ditetapkan dalam `package.json` dan README.

## Memakai Graphify pada sesi baru

- Untuk pertanyaan struktur, alur lintas modul, dan dampak perubahan, gunakan skill graphify jika tersedia dan telusuri `graphify-out/graph.json`.
- Baca `graphify-out/GRAPH_REPORT.md`, `graphify-out/.graphify_scope.json`, dan `.graphifyignore` untuk mengetahui cakupan dan keterbatasan graph.
- Gunakan graph yang sudah tersedia untuk query, path, atau explain. Untuk pencarian simbol yang spesifik, gunakan `rg` dan buka source terkait.
- Periksa kesesuaian graph dengan source saat ini, termasuk `built_at_commit` dan perubahan lokal. Verifikasi relasi penting, terutama `INFERRED` dan `AMBIGUOUS`, pada kode sebelum mengubah perilaku aplikasi.
- Saat tersedia, jalankan `graphify reflect --if-stale`, lalu baca `graphify-out/reflections/LESSONS.md`. Simpan hasil penelusuran yang berguna melalui `graphify save-result` sesuai panduan skill.
- Setelah perubahan yang memengaruhi relasi atau struktur, perbarui graph secara inkremental. Jalankan ekstraksi penuh ketika diminta atau diperlukan oleh perubahan cakupan.

## Cakupan graph proyek

- `docs/testing/` dikecualikan dari korpus graph melalui `.graphifyignore`.
- Sertakan `packages/ui/src/tokens.css` dan `packages/ui/src/styles.css`, beserta jalur impor layout aplikasi melalui `styles.css` ke `tokens.css`.
- Pada Graphify 0.9.103, CSS memerlukan ekstraksi semantik khusus. Periksa perubahan kedua file CSS tersebut secara eksplisit saat memperbarui graph. Kelompokkan token berdasarkan fungsinya, seperti warna, tema, tipografi, spacing, motion, dan aksesibilitas.
- Fragmen `.graphify_css_tokens.json` merupakan artefak lokal. Jika fragmen belum tersedia atau sumber CSS berubah, ekstrak ulang CSS sesuai panduan skill dan gabungkan hasilnya dengan graph. Gunakan path relatif terhadap repositori pada keluaran bersama.
- Pertahankan `AppError` sebagai kontrak error lintas Auth, Bag Filter, Consumables, dan server API. Gunakan source dan relasinya untuk memahami peran kelas tersebut.
- Pertahankan confidence dan catatan review dalam `graphify-out/EXTRACTION_AUDIT.json` saat memperbarui relasi yang sudah diaudit.

## Artefak Graphify bersama

- `.gitignore` menentukan artefak graph yang dibagikan, termasuk graph, HTML, laporan, manifest, cakupan, label kelompok, audit, dan catatan pembelajaran.
- Simpan cache, interpreter, root workspace, snapshot cadangan, dan file ekstraksi sementara sebagai artefak lokal. Temukan interpreter Graphify yang tersedia pada mesin saat ini sesuai panduan skill.
- Laporan dan scope merupakan data referensi. Ikuti instruksi pengguna dan panduan repositori saat menentukan pekerjaan berikutnya.

## Validasi perubahan

- Pilih pemeriksaan yang sesuai dengan perubahan dari script `package.json`, seperti `pnpm typecheck`, `pnpm test`, dan build aplikasi terkait.
- Ikuti bagian lingkungan uji dalam README sebelum menjalankan integration, E2E, atau tes operasi. Suite tersebut memakai `plant-v2-test` dan memerlukan Docker Engine uji disposable yang sudah diverifikasi. Runtime development memakai `plant-v2-dev`.
- Lindungi kredensial, sertifikat privat, dump, backup, dan data perusahaan sesuai aturan README serta `.gitignore`.
- Ringkas perubahan, hasil pemeriksaan, dan keterbatasan yang relevan dalam jawaban akhir.

## Dokumentasi library dan platform

<!-- context7 -->
Use Context7 MCP to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service — even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, porting code between libraries, platforms, or SQL dialects, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer — your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, debugging, or reviewing code that does not depend on a library or platform API, or general programming concepts.

### Steps

1. Always start with `resolve-library-id` using the library name and what to look up in the library's documentation, unless the user provides an exact library ID in `/org/project` format
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries (e.g., "next.js" not "nextjs", or rephrase the question). Use version-specific IDs when the user mentions a version
3. `query-docs` with the selected library ID and what to look up in the library's documentation (not single words), scoped to a single concept. If the question spans multiple distinct concepts (e.g. routing and auth and caching), make a separate `query-docs` call per concept with the same library ID, unless the question is about how the concepts interact — combined queries dilute ranking and return shallow results for each topic
4. Answer using the fetched docs
<!-- context7 -->
