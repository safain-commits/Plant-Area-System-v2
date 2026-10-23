import { createHash, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { AppError } from '@plant/contracts';
import { getConsumablesDb } from './database';
import { materials, imports, audit } from './schema';
export function parseCatalog(contents: string) {
  let input: unknown;
  try {
    input = JSON.parse(contents);
  } catch {
    throw new AppError(400, 'JSON katalog tidak valid.');
  }
  const x = input as { batch?: unknown; rows?: unknown };
  if (
    !x ||
    typeof x !== 'object' ||
    typeof x.batch !== 'string' ||
    !/^[-A-Za-z0-9_]{1,100}$/.test(x.batch) ||
    !Array.isArray(x.rows) ||
    !x.rows.length ||
    x.rows.length > 100000
  )
    throw new AppError(400, 'Format katalog tidak sesuai.');
  const seen = new Set<string>();
  const parsed = x.rows.map((row: unknown, index: number) => {
    if (!Array.isArray(row) || row.length !== 10)
      throw new AppError(400, `Baris ${index + 1}: diperlukan 10 kolom.`);
    const [mmid, description, commonName, unit, mrpType, critical, sourceDate, oldStock, oldValue, category] =
      row;
    const strings = [mmid, description, commonName, unit, mrpType, sourceDate, category];
    if (
      strings.some((v) => typeof v !== 'string') ||
      !mmid.trim() ||
      mmid.length > 80 ||
      !description.trim() ||
      description.length > 160 ||
      commonName.length > 160 ||
      !unit.trim() ||
      unit.length > 30 ||
      mrpType.length > 30 ||
      !category.trim() ||
      category.length > 100 ||
      ![0, 1].includes(critical) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(sourceDate) ||
      !Number.isFinite(Date.parse(sourceDate)) ||
      new Date(sourceDate).toISOString().slice(0, 10) !== sourceDate ||
      typeof oldStock !== 'number' ||
      !Number.isFinite(oldStock) ||
      typeof oldValue !== 'number' ||
      !Number.isFinite(oldValue)
    )
      throw new AppError(400, `Baris ${index + 1}: data master tidak valid.`);
    const key = mmid.trim().toUpperCase();
    if (seen.has(key)) throw new AppError(400, `Kode duplikat pada baris ${index + 1}.`);
    seen.add(key);
    return {
      mmid: mmid.trim(),
      description: description.trim(),
      commonName: commonName.trim(),
      unit: unit.trim(),
      mrpType: mrpType.trim(),
      critical: critical === 1,
      sourceDate,
      category: category.trim(),
    };
  });
  return { batch: x.batch, checksum: createHash('sha256').update(contents).digest('hex'), rows: parsed };
}
export async function importCatalog(contents: string, apply = false) {
  const data = parseCatalog(contents),
    db = getConsumablesDb();
  return db.transaction(async (tx) => {
    // Serialize imports against one another. Conflicts with manual creation also rollback the entire apply.
    await tx.execute((await import('drizzle-orm')).sql`SELECT id FROM materials ORDER BY id FOR UPDATE`);
    const [old] = await tx.select().from(imports).where(eq(imports.id, data.batch)).for('update');
    if (old) {
      if (old.checksum !== data.checksum)
        throw new AppError(409, 'Batch impor yang sama memiliki checksum berbeda.');
      return { batch: data.batch, count: data.rows.length, inserted: 0, replayed: true, applied: false };
    }
    const existing = await tx.select().from(materials);
    const byCode = new Map(existing.map((m) => [m.mmid.toUpperCase(), m]));
    const newRows = [];
    for (const m of data.rows) {
      const current = byCode.get(m.mmid.toUpperCase());
      if (current) {
        if (Object.entries(m).some(([k, v]) => current[k as keyof typeof current] !== v))
          throw new AppError(409, `Konflik master pada MMID ${m.mmid}; tidak ada data diubah.`);
      } else
        newRows.push({
          id: randomUUID(),
          ...m,
          sourceBatch: data.batch,
          packSize: null,
          version: 1,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
    }
    if (apply) {
      for (let i = 0; i < newRows.length; i += 250)
        await tx.insert(materials).values(newRows.slice(i, i + 250));
      await tx.insert(imports).values({
        id: data.batch,
        checksum: data.checksum,
        rowCount: data.rows.length,
        createdAt: new Date(),
      });
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: 'system:catalog-import',
        actorName: 'Catalog import',
        action: 'catalog.imported',
        targetId: data.batch,
        details: JSON.stringify({
          checksum: data.checksum,
          count: data.rows.length,
          inserted: newRows.length,
        }),
        createdAt: new Date(),
      });
    }
    return {
      batch: data.batch,
      count: data.rows.length,
      inserted: newRows.length,
      replayed: false,
      applied: apply,
    };
  });
}
