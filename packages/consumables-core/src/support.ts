import { R22_ROOM_ID } from './room';
import { randomUUID } from 'node:crypto';
import { sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import {
  AppError,
  canConsume,
  decimalUnits,
  decimalString,
  type Identity,
  type StockAction,
} from '@plant/contracts';
import { getConsumablesDb } from './database';
type Executor = Pick<ReturnType<typeof getConsumablesDb>, 'execute'>;
export async function rows<T>(db: Executor, statement: SQL): Promise<T[]> {
  const [result] = await db.execute(statement);
  return JSON.parse(
    JSON.stringify(result, (k, v) =>
      (k === 'createdAt' || k === 'cursorSort') &&
      typeof v === 'string' &&
      /^\d{4}-\d{2}-\d{2} \d{2}:/.test(v)
        ? v.replace(' ', 'T') + 'Z'
        : v,
    ),
  ) as T[];
}
export const db = () => getConsumablesDb();
export const utcSql = (date: Date) => date.toISOString().replace('T', ' ').slice(0, 23);
export function requireStock(actor: Identity, action: StockAction) {
  if (!canConsume(actor, action)) throw new AppError(403, 'Akses Consumable Room belum diberikan.');
}
export function scope(actor: Identity, column: SQL) {
  requireStock(actor, 'read');
  return sql`${column}=${R22_ROOM_ID}`;
}
export const entry = (
  actor: Pick<Identity, 'id' | 'name'>,
  action: string,
  targetId: string,
  details: unknown,
) => ({
  id: randomUUID(),
  actorId: actor.id,
  actorName: actor.name,
  action,
  targetId,
  details: JSON.stringify(details),
  createdAt: new Date(),
});
export function failValidation(e: unknown): never {
  if (e instanceof z.ZodError) throw new AppError(400, e.issues[0]?.message || 'Input tidak valid.');
  if (e instanceof AppError) throw e;
  throw new AppError(400, e instanceof Error ? e.message : 'Input tidak valid.');
}
export function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (e) {
    return failValidation(e);
  }
}
export const amount = z.string().transform((v, ctx) => {
  try {
    return decimalString(decimalUnits(v));
  } catch (e) {
    ctx.addIssue({ code: 'custom', message: e instanceof Error ? e.message : 'Jumlah tidak valid.' });
    return z.NEVER;
  }
});
export const positive = amount.refine((v) => decimalUnits(v) > 0n, 'Jumlah harus lebih besar dari nol.');

export function code(e: unknown): string | undefined {
  if (!e || typeof e !== 'object') return;
  return (e as { code?: string }).code || code((e as { cause?: unknown }).cause);
}

export function search(value: string, columns: SQL[]) {
  if (value.length > 200) throw new AppError(400, 'Pencarian maksimal 200 karakter.');
  const terms = value.trim().split(/\s+/).filter(Boolean);
  return terms.map((term) => {
    const like = '%' + term.replace(/[\\%_]/g, '\\$&') + '%';
    return sql`(${sql.join(
      columns.map((c) => sql`${c} LIKE ${like}`),
      sql` OR `,
    )})`;
  });
}
function pageCursor(value: string | null) {
  if (!value) return null;
  try {
    const v = JSON.parse(Buffer.from(value, 'base64url').toString());
    if (typeof v.sort !== 'string' || v.sort.length > 200 || !z.uuid().safeParse(v.id).success) throw Error();
    return v as { sort: string; id: string };
  } catch {
    throw new AppError(400, 'Cursor tidak valid.');
  }
}
export async function page<T extends { id: string }>(
  select: SQL,
  conditions: SQL[],
  sort: SQL,
  idColumn: SQL,
  params: URLSearchParams,
  dateSort = false,
) {
  const c = pageCursor(params.get('cursor'));
  const count = params.get('limit') ? Number(params.get('limit')) : 50;
  if (!Number.isInteger(count) || count < 1 || count > 50) throw new AppError(400, 'Limit harus 1–50.');
  if (c) {
    if (dateSort && !Number.isFinite(Date.parse(c.sort))) throw new AppError(400, 'Cursor tidak valid.');
    const s = dateSort ? utcSql(new Date(c.sort)) : c.sort;
    conditions.push(
      dateSort
        ? sql`(${sort}<${s} OR (${sort}=${s} AND ${idColumn}<${c.id}))`
        : sql`(${sort}>${s} OR (${sort}=${s} AND ${idColumn}>${c.id}))`,
    );
  }
  const result = await rows<T & { cursorSort: string; cursorId?: string }>(
    db(),
    sql`${select} WHERE ${sql.join(conditions, sql` AND `)} ORDER BY ${sort} ${dateSort ? sql`DESC` : sql`ASC`},${idColumn} ${dateSort ? sql`DESC` : sql`ASC`} LIMIT ${count + 1}`,
  );
  const items = result.slice(0, count);
  const last = items.at(-1);
  const nextCursor =
    result.length > count && last
      ? Buffer.from(JSON.stringify({ sort: last.cursorSort, id: last.cursorId || last.id })).toString(
          'base64url',
        )
      : null;
  return { items: items.map(({ cursorSort, cursorId, ...item }) => item as unknown as T), nextCursor };
}
export const matCols = sql`m.id,m.mmid,m.description,m.common_name AS commonName,m.unit,m.sap_unit AS sapUnit,m.aliases,m.decimal_allowed AS decimalAllowed,m.conversion_reviewed AS conversionReviewed,EXISTS(SELECT 1 FROM stock_movements used WHERE used.material_id=m.id LIMIT 1) AS unitLocked,m.category,m.mrp_type AS mrpType,m.critical,m.pack_size AS packSize,m.active,m.version,m.source_batch AS sourceBatch,m.source_date AS sourceDate`;
export const invCols = sql`${matCols},i.id AS inventoryId,i.rack,i.quantity,i.initialized,i.active AS inventoryActive,i.version AS inventoryVersion`;
export const joinInv = sql`inventory i JOIN materials m ON m.id=i.material_id JOIN locations l ON l.id=i.location_id`;
export const moveCols = sql`v.id,v.material_id AS materialId,v.document_id AS documentId,v.line_no AS lineNo,v.common_name AS commonName,v.sap_unit AS sapUnit,v.sap_quantity AS sapQuantity,v.mmid,v.description,v.unit,v.type,v.quantity,v.balance_after AS balanceAfter,v.packs,v.pack_size AS packSize,v.reference,v.wo,v.job,v.reason,v.actor_id AS actorId,v.actor_name AS actorName,v.created_at AS createdAt`;
export const normalize = <T extends Record<string, unknown>>(item: T) => {
  for (const k of [
    'active',
    'critical',
    'initialized',
    'inventoryActive',
    'locationActive',
    'decimalAllowed',
    'conversionReviewed',
    'unitLocked',
  ])
    if (k in item) (item as Record<string, unknown>)[k] = !!item[k];
  return item;
};
