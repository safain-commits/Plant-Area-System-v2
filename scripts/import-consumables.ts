import { readFile } from 'node:fs/promises';
import { importCatalog } from '@plant/consumables-core/import';
import { closeConsumablesDb } from '@plant/consumables-core';
import { AppError } from '@plant/contracts';
const args = process.argv.slice(2),
  file = args.find((v) => !v.startsWith('--'));
if (
  !file ||
  args.some((v) => v.startsWith('--') && !['--apply', '--dry-run'].includes(v)) ||
  (args.includes('--apply') && args.includes('--dry-run'))
)
  throw Error('Usage: import-consumables.ts <private-json-file> [--dry-run|--apply]');
try {
  console.log(JSON.stringify(await importCatalog(await readFile(file, 'utf8'), args.includes('--apply'))));
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'catalog.import.failed',
      error:
        error instanceof AppError
          ? error.message
          : 'Impor belum dapat diverifikasi. Periksa file/koneksi dan jalankan ulang batch yang sama.',
    }),
  );
  process.exitCode = 1;
} finally {
  await closeConsumablesDb();
}
