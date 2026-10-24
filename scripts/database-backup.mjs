// Binary-safe Docker mysqldump wrapper for PowerShell and Bash. Does not stop services.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, rename, stat, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { createGzip, createGunzip } from 'node:zlib';
import { Writable } from 'node:stream';
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  if (i < 0 || !args[i + 1]) throw Error('Missing option');
  return args[i + 1];
};
try {
  const container = option('--container'),
    out = option('--out');
  assert.match(container, /^[A-Za-z0-9][A-Za-z0-9_.-]+$/);
  assert.ok(out.endsWith('.sql.gz'));
  await access(out).then(
    () => {
      throw Error('Output already exists');
    },
    (e) => {
      if (e.code !== 'ENOENT') throw e;
    },
  );
  const temporary = out + '.partial';
  const child = spawn(
    'docker',
    [
      'exec',
      container,
      'bash',
      '-c',
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --quick --no-tablespaces --set-gtid-purged=OFF --tz-utc --hex-blob --routines --events --triggers --databases plant_auth plant_bag_filter plant_consumables',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  // Drain stderr without retaining secret-bearing diagnostics.
  child.stderr.resume();
  const exit = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => (code === 0 ? resolve() : reject(Error('Dump failed'))));
  });
  await Promise.all([
    pipeline(child.stdout, createGzip(), createWriteStream(temporary, { flags: 'wx', mode: 0o600 })),
    exit,
  ]).catch((e) => {
    child.kill();
    throw e;
  });
  const h = createHash('sha256');
  let bytes = 0;
  await pipeline(
    createReadStream(temporary),
    new Writable({
      write(chunk, _encoding, done) {
        bytes += chunk.length;
        h.update(chunk);
        done();
      },
    }),
  );
  // Streaming decompression validates gzip CRC and trailer without loading the dump into memory.
  let sqlBytes = 0;
  await pipeline(
    createReadStream(temporary),
    createGunzip(),
    new Writable({
      write(chunk, _encoding, done) {
        sqlBytes += chunk.length;
        done();
      },
    }),
  );
  assert.ok(sqlBytes > 0);
  await rename(temporary, out);
  const receipt = {
    format: 1,
    createdAt: new Date().toISOString(),
    file: out,
    sha256: h.digest('hex'),
    bytes,
    uncompressedBytes: sqlBytes,
    databases: ['plant_auth', 'plant_bag_filter', 'plant_consumables'],
    consistentSnapshot: 'single-transaction; freeze writers and DDL externally for migration',
    restoreTested: false,
  };
  await writeFile(out + '.json', JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  assert.equal((await stat(out)).size, bytes);
  console.log(JSON.stringify({ event: 'database.backup_saved', ...receipt }));
} catch {
  console.error(
    JSON.stringify({
      event: 'database.backup_failed',
      message:
        'Periksa container, akses Docker/MySQL, direktori privat, dan nama output baru. File .partial bukan backup siap pakai.',
    }),
  );
  process.exitCode = 1;
}
