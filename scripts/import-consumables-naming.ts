import { readFile } from 'node:fs/promises';
import { importNaming } from '../packages/consumables-core/src/naming';
import { closeConsumablesDb } from '@plant/consumables-core';
import { AppError } from '@plant/contracts';
const args = process.argv.slice(2),
  files = args.filter((v) => !v.startsWith('--'));
if (
  files.length !== 1 ||
  args.some((v) => v.startsWith('--') && !['--apply', '--dry-run'].includes(v)) ||
  (args.includes('--apply') && args.includes('--dry-run'))
)
  throw Error('Usage: import-consumables-naming.ts <private-csv-file> [--dry-run|--apply]');
try {
  const bytes = await readFile(files[0]);
  const contents = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  console.log(JSON.stringify(await importNaming(contents, args.includes('--apply'))));
} catch (e) {
  console.error(
    JSON.stringify({
      event: 'catalog.naming-import.failed',
      error:
        e instanceof AppError
          ? e.message
          : 'File UTF-8/koneksi belum dapat diverifikasi. Tidak ada hasil apply yang dikonfirmasi.',
    }),
  );
  process.exitCode = 1;
} finally {
  await closeConsumablesDb();
}
