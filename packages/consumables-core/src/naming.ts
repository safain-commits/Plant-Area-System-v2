import { createHash, randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { AppError, normalizeAliases, decimalString, decimalUnits } from '@plant/contracts';
import { getConsumablesDb } from './database';
import { materials, movements, audit, imports } from './schema';
const headers = [
  'mmid',
  'common_name',
  'aliases',
  'unit',
  'sap_unit',
  'pack_size',
  'decimal_allowed',
] as const;
type NamingRow = {
  row: number;
  mmid: string;
  patch: Partial<
    Pick<
      typeof materials.$inferInsert,
      'commonName' | 'aliases' | 'unit' | 'sapUnit' | 'packSize' | 'decimalAllowed'
    >
  >;
};
export function parseNamingCsv(contents: string) {
  if (contents.length > 64 * 1024 * 1024) throw new AppError(400, 'CSV maksimal 64 MB.');
  const source = contents.replace(/^\uFEFF/, ''),
    table: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false,
    closed = false;
  const finishField = () => {
    row.push(field);
    field = '';
    closed = false;
  };
  const finishRow = () => {
    finishField();
    if (row.some((v) => v.trim())) table.push(row);
    row = [];
  };
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
      continue;
    }
    if (c === '"') {
      if (field || closed) throw new AppError(400, 'Tanda petik CSV tidak valid.');
      quoted = true;
    } else if (c === ',') finishField();
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && source[i + 1] === '\n') i++;
      finishRow();
    } else {
      if (closed) throw new AppError(400, 'Karakter setelah penutup petik CSV tidak valid.');
      field += c;
    }
  }
  if (quoted) throw new AppError(400, 'Petik CSV belum ditutup.');
  if (field || row.length || closed) finishRow();
  const header = table.shift()?.map((v) => v.trim());
  if (
    !header ||
    header.length !== headers.length ||
    new Set(header).size !== headers.length ||
    headers.some((h) => !header.includes(h))
  )
    throw new AppError(400, 'Header CSV wajib: ' + headers.join(','));
  if (!table.length || table.length > 100000) throw new AppError(400, 'CSV memerlukan 1–100.000 baris.');
  const seen = new Set<string>();
  const parsed: NamingRow[] = table.map((cells, index) => {
    const row = index + 2;
    const fail = (message: string): never => {
      throw new AppError(400, `Baris ${row}: ${message}`);
    };
    if (cells.length !== headers.length) fail('Jumlah kolom tidak sesuai.');
    const values = Object.fromEntries(header.map((h, i) => [h, cells[i].trim()]));
    if (Object.values(values).some((v) => /[\u0000-\u001f]/.test(v)))
      fail('Field mengandung karakter kontrol.');
    const mmid = values.mmid;
    if (!mmid || mmid.length > 80) fail('MMID wajib, maksimal 80 karakter.');
    if (seen.has(mmid.toUpperCase())) fail('MMID duplikat.');
    seen.add(mmid.toUpperCase());
    const patch: NamingRow['patch'] = {};
    if (values.common_name) {
      if (values.common_name.length > 160) fail('Nama umum maksimal 160 karakter.');
      patch.commonName = values.common_name;
    }
    if (values.aliases)
      try {
        patch.aliases = normalizeAliases(values.aliases);
      } catch (e) {
        fail((e as Error).message);
      }
    for (const [field, key] of [
      ['unit', 'unit'],
      ['sap_unit', 'sapUnit'],
    ] as const)
      if (values[field]) {
        if (values[field].length > 30) fail('Satuan maksimal 30 karakter.');
        patch[key] = values[field];
      }
    if (values.pack_size)
      try {
        const n = decimalUnits(values.pack_size);
        if (n <= 0n) throw Error('Konversi harus positif.');
        patch.packSize = decimalString(n);
      } catch (e) {
        fail((e as Error).message);
      }
    if (values.decimal_allowed) {
      if (!/^(true|false|1|0)$/i.test(values.decimal_allowed))
        fail('decimal_allowed harus true/false atau 1/0.');
      patch.decimalAllowed = /^(true|1)$/i.test(values.decimal_allowed);
    }
    return { row, mmid, patch };
  });
  return { checksum: createHash('sha256').update(contents).digest('hex'), rows: parsed };
}
export async function importNaming(contents: string, apply = false) {
  const data = parseNamingCsv(contents),
    db = getConsumablesDb(),
    batch = 'naming-' + data.checksum;
  return db.transaction(async (tx) => {
    const existing = await tx.select().from(materials),
      byCode = new Map(existing.map((m) => [m.mmid.toUpperCase(), m]));
    for (const row of data.rows)
      if (!byCode.has(row.mmid.toUpperCase()))
        throw new AppError(400, `Baris ${row.row}: MMID tidak dikenal.`);
    const ordered = data.rows
      .map((r) => ({ ...r, id: byCode.get(r.mmid.toUpperCase())!.id }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const changes: Array<{
      id: string;
      patch: NamingRow['patch'];
      version: number;
      conversionReviewed: boolean;
    }> = [];
    for (const row of ordered) {
      const [current] = await tx.select().from(materials).where(eq(materials.id, row.id)).for('update');
      if (row.patch.unit && row.patch.unit !== current.unit) {
        const [used] = await tx
          .select({ id: movements.id })
          .from(movements)
          .where(eq(movements.materialId, current.id))
          .limit(1);
        if (used) throw new AppError(409, `Baris ${row.row}: satuan R22 terkunci setelah transaksi pertama.`);
      }
      const conversionReviewed =
        row.patch.sapUnit !== undefined || row.patch.packSize !== undefined
          ? true
          : current.conversionReviewed;
      if (
        conversionReviewed !== current.conversionReviewed ||
        Object.entries(row.patch).some(([k, v]) => current[k as keyof typeof current] !== v)
      )
        changes.push({
          id: current.id,
          patch: row.patch,
          version: current.version,
          conversionReviewed,
        });
    }
    const [old] = await tx.select().from(imports).where(eq(imports.id, batch)).for('update');
    // A replay may not silently restore an old naming file over subsequent manual edits.
    if (old && changes.length)
      throw new AppError(
        409,
        'File ini pernah diterapkan, tetapi master sudah berubah. Tinjau perubahan dan buat file baru.',
      );
    if (apply && !old) {
      const now = new Date();
      for (const change of changes)
        await tx
          .update(materials)
          .set({
            ...change.patch,
            conversionReviewed: change.conversionReviewed,
            version: change.version + 1,
            updatedAt: now,
          })
          .where(eq(materials.id, change.id));
      await tx
        .insert(imports)
        .values({ id: batch, checksum: data.checksum, rowCount: data.rows.length, createdAt: now });
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: 'system:naming-import',
        actorName: 'Naming import',
        action: 'catalog.naming-imported',
        targetId: batch,
        details: JSON.stringify({
          checksum: data.checksum,
          count: data.rows.length,
          changed: changes.length,
        }),
        createdAt: now,
      });
    }
    return {
      checksum: data.checksum,
      count: data.rows.length,
      changed: changes.length,
      replayed: !!old,
      applied: apply && !old,
    };
  });
}
