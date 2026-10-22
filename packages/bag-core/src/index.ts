import { createHash, randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  AppError,
  replacementSchema,
  validateInstallationDate,
  equipment,
  getEquipment,
  positionKey,
  type Identity,
  type Position,
} from '@plant/contracts';
import { getBagDb } from './database';
import { equipmentTable, coordinates, batches, installations, bagAudit } from './schema';
export { getBagDb, closeBagDb } from './database';
export * as bagSchema from './schema';

export function canonicalReplacement(input: unknown) {
  const parsed = replacementSchema.safeParse(input);
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message || 'Penggantian tidak valid.');
  if (!validateInstallationDate(parsed.data.installedAt))
    throw new AppError(400, 'Tanggal pemasangan harus sejak 2000 dan tidak melebihi waktu sekarang.');
  return {
    ...parsed.data,
    installedAt: new Date(parsed.data.installedAt).toISOString(),
    positions: [...parsed.data.positions].sort((a, b) => positionKey(a).localeCompare(positionKey(b))),
  };
}
// Drizzle returns raw MySQL DATETIME values as strings without an offset.
// Interpret those explicitly as UTC, independent of the application host timezone.
const dateString = (value: Date | string) =>
  new Date(
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2} /.test(value) ? value.replace(' ', 'T') + 'Z' : value,
  ).toISOString();
function codeOf(error: unknown): string | undefined {
  return error && typeof error === 'object'
    ? (error as { code?: string }).code || codeOf((error as { cause?: unknown }).cause)
    : undefined;
}
export async function createReplacement(
  actor: Pick<Identity, 'id' | 'name'>,
  input: unknown,
  key: string | null,
) {
  if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key))
    throw new AppError(400, 'Idempotency-Key diperlukan (8–128 karakter).');
  const value = canonicalReplacement(input),
    db = getBagDb();
  const hash = createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const match = and(eq(batches.actorId, actor.id), eq(batches.idempotencyKey, key));
  const replay = (record: typeof batches.$inferSelect) => {
    if (record.requestHash !== hash)
      throw new AppError(409, 'Idempotency-Key sudah digunakan untuk data berbeda.');
    return { batchId: record.id, count: record.positionCount, replayed: true };
  };
  try {
    return await db.transaction(
      async (tx) => {
        const [existing] = await tx.select().from(batches).where(match);
        if (existing) return replay(existing);
        const id = randomUUID(),
          now = new Date(),
          installedAt = new Date(value.installedAt);
        await tx.insert(batches).values({
          id,
          equipmentCode: value.equipmentCode,
          actorId: actor.id,
          actorName: actor.name,
          installedAt,
          reason: value.reason,
          wo: value.wo,
          createdAt: now,
          idempotencyKey: key,
          requestHash: hash,
          positionCount: value.positions.length,
        });
        await tx.insert(installations).values(
          value.positions.map((p) => ({
            ...p,
            batchId: id,
            equipmentCode: value.equipmentCode,
            installedAt,
          })),
        );
        await tx.insert(bagAudit).values({
          id: randomUUID(),
          batchId: id,
          equipmentCode: value.equipmentCode,
          actorId: actor.id,
          actorName: actor.name,
          action: 'bag.batch_created',
          details: JSON.stringify({ count: value.positions.length, wo: value.wo }),
          createdAt: now,
        });
        return { batchId: id, count: value.positions.length, replayed: false };
      },
      { isolationLevel: 'read committed' },
    );
  } catch (e) {
    if (codeOf(e) === 'ER_DUP_ENTRY') {
      const [existing] = await db.select().from(batches).where(match);
      if (existing) return replay(existing);
    }
    throw e;
  }
}
export async function seedEquipment() {
  const db = getBagDb();
  for (const eq of equipment) {
    await db
      .insert(equipmentTable)
      .values({ code: eq.code, perSide: eq.perSide })
      .onDuplicateKeyUpdate({ set: { code: eq.code } });
    const rows: (typeof coordinates.$inferInsert)[] = [];
    for (const side of ['Utara', 'Selatan'])
      for (let compartment = 1; compartment <= eq.perSide; compartment++)
        for (let column = 1; column <= 8; column++)
          for (let row = 1; row <= 17; row++)
            rows.push({ equipmentCode: eq.code, side, compartment, column, row });
    for (let start = 0; start < rows.length; start += 500)
      await db
        .insert(coordinates)
        .values(rows.slice(start, start + 500))
        .onDuplicateKeyUpdate({ set: { equipmentCode: eq.code } });
  }
}
export type SnapshotPosition = Position & { id: string; batchId: string; installedAt: string };
export async function snapshot(code: string) {
  const eq = getEquipment(code);
  if (!eq) throw new AppError(404, 'Equipment tidak ditemukan.');
  const [result] = await getBagDb().execute(sql`
    SELECT CAST(r.id AS CHAR) AS id, r.batch_id AS batchId, r.side, r.compartment, r.col AS \`column\`, r.row_no AS \`row\`, r.installed_at AS installedAt
    FROM (SELECT i.*, ROW_NUMBER() OVER (PARTITION BY side,compartment,col,row_no ORDER BY installed_at DESC,id DESC) AS rn
      FROM installations i WHERE equipment_code=${code}) r WHERE r.rn=1`);
  const positions = (
    result as unknown as (Position & { id: string; batchId: string; installedAt: Date })[]
  ).map((p) => ({ ...p, installedAt: dateString(p.installedAt) }));
  return {
    equipment: eq,
    positions,
    recorded: positions.length,
    total: eq.compartments * 136,
    serverTime: new Date().toISOString(),
  };
}
type Cursor = { at: string; id: string };
export function encodeCursor(at: string, id: string) {
  return Buffer.from(JSON.stringify({ at, id })).toString('base64url');
}
function cursor(value: string | null): Cursor | null {
  if (!value) return null;
  try {
    if (value.length > 256) throw Error();
    const p = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      typeof p.at !== 'string' ||
      !Number.isFinite(Date.parse(p.at)) ||
      typeof p.id !== 'string' ||
      !/^[A-Za-z0-9-]{1,64}$/.test(p.id)
    )
      throw Error();
    return p;
  } catch {
    throw new AppError(400, 'Cursor tidak valid.');
  }
}
const likeText = (value: string) => `%${value.replace(/[\\%_]/g, '\\$&')}%`;
export async function batchHistory(code: string, query = '', after: string | null = null) {
  const eq = getEquipment(code);
  if (!eq) throw new AppError(404, 'Equipment tidak ditemukan.');
  if (query.length > 200) throw new AppError(400, 'Pencarian maksimal 200 karakter.');
  const c = cursor(after),
    q = likeText(query.trim());
  const filter = query.trim()
    ? sql`AND (b.wo LIKE ${q} OR b.reason LIKE ${q}
    OR DATE_FORMAT(DATE_ADD(b.installed_at, INTERVAL 7 HOUR),'%Y-%m-%d %H:%i') LIKE ${q}
    OR EXISTS (SELECT 1 FROM installations p WHERE p.batch_id=b.id AND CONCAT(IF(p.side='Utara',p.compartment,${eq.compartments + 1}-p.compartment),' ',ELT(p.col,'H','G','F','E','D','C','B','A'),p.row_no) LIKE ${q}))`
    : sql``;
  const boundary = c
    ? sql`AND (b.created_at < ${new Date(c.at)} OR (b.created_at=${new Date(c.at)} AND b.id < ${c.id}))`
    : sql``;
  const [raw] = await getBagDb()
    .execute(sql`SELECT b.id,b.equipment_code AS equipmentCode,b.installed_at AS installedAt,b.created_at AS createdAt,
    b.reason,b.wo,b.actor_name AS actorName,b.position_count AS positionCount FROM replacement_batches b WHERE b.equipment_code=${code}
    ${filter} ${boundary} ORDER BY b.created_at DESC,b.id DESC LIMIT 51`);
  type Row = {
    id: string;
    equipmentCode: string;
    installedAt: Date;
    createdAt: Date;
    reason: string;
    wo: string;
    actorName: string;
    positionCount: number;
  };
  const rows = raw as unknown as Row[],
    page = rows.slice(0, 50);
  const positions = page.length
    ? await getBagDb()
        .select({
          batchId: installations.batchId,
          side: installations.side,
          compartment: installations.compartment,
          column: installations.column,
          row: installations.row,
        })
        .from(installations)
        .where(
          inArray(
            installations.batchId,
            page.map((b) => b.id),
          ),
        )
    : [];
  return {
    items: page.map((b) => ({
      ...b,
      installedAt: dateString(b.installedAt),
      createdAt: dateString(b.createdAt),
      positions: positions.filter((p) => p.batchId === b.id) as (Position & { batchId: string })[],
    })),
    nextCursor: rows.length > 50 ? encodeCursor(dateString(page[49].createdAt), page[49].id) : null,
  };
}
export async function positionHistory(code: string, p: Position, after: string | null = null) {
  const eq = getEquipment(code);
  if (!eq) throw new AppError(404, 'Equipment tidak ditemukan.');
  const c = cursor(after);
  if (c && !/^\d+$/.test(c.id)) throw new AppError(400, 'Cursor koordinat tidak valid.');
  const boundary = c
    ? sql`WHERE (r.installed_at < ${new Date(c.at)} OR (r.installed_at=${new Date(c.at)} AND r.id < ${c.id}))`
    : sql``;
  const [raw] = await getBagDb()
    .execute(sql`SELECT CAST(r.id AS CHAR) AS id,r.batch_id AS batchId,r.installed_at AS installedAt,r.endedAt,
    b.reason,b.wo,b.actor_name AS actorName,b.created_at AS createdAt FROM
    (SELECT i.*,LEAD(installed_at) OVER (ORDER BY installed_at,id) AS endedAt FROM installations i
      WHERE equipment_code=${code} AND side=${p.side} AND compartment=${p.compartment} AND col=${p.column} AND row_no=${p.row}) r
    JOIN replacement_batches b ON b.id=r.batch_id ${boundary} ORDER BY r.installed_at DESC,r.id DESC LIMIT 51`);
  type Row = {
    id: string;
    batchId: string;
    installedAt: Date;
    endedAt: Date | null;
    reason: string;
    wo: string;
    actorName: string;
    createdAt: Date;
  };
  const rows = raw as unknown as Row[],
    page = rows.slice(0, 50);
  return {
    items: page.map((r) => ({
      ...r,
      installedAt: dateString(r.installedAt),
      endedAt: r.endedAt ? dateString(r.endedAt) : null,
      createdAt: dateString(r.createdAt),
    })),
    nextCursor: rows.length > 50 ? encodeCursor(dateString(page[49].installedAt), page[49].id) : null,
  };
}
export async function auditHistory(codes: string[], after: string | null = null) {
  if (!codes.length) return { items: [], nextCursor: null };
  const c = cursor(after),
    boundary = c
      ? sql`AND (created_at < ${new Date(c.at)} OR (created_at=${new Date(c.at)} AND id < ${c.id}))`
      : sql``;
  const list = sql.join(
    codes.map((code) => sql`${code}`),
    sql`, `,
  );
  const [raw] = await getBagDb().execute(
    sql`SELECT id,batch_id AS batchId,equipment_code AS equipmentCode,actor_id AS actorId,actor_name AS actorName,action,details,created_at AS createdAt FROM bag_audit WHERE equipment_code IN (${list}) ${boundary} ORDER BY created_at DESC,id DESC LIMIT 51`,
  );
  const rows = raw as unknown as { id: string; createdAt: Date; details: string }[],
    page = rows.slice(0, 50);
  return {
    items: page.map((r) => ({ ...r, createdAt: dateString(r.createdAt), details: JSON.parse(r.details) })),
    nextCursor: rows.length > 50 ? encodeCursor(dateString(page[49].createdAt), page[49].id) : null,
  };
}
