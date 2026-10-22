import { existsSync } from 'node:fs';

const verifier = new URL('../.arsip/ekspor-2026-10-22/verify-package.mjs', import.meta.url);
if (existsSync(verifier)) await import(verifier.href);
else console.log('Arsip ekspor hanya tersedia lokal; pemeriksaan checksum dilewati.');
