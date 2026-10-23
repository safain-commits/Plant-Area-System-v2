import { createHash, randomUUID } from 'node:crypto';
import { eq, and, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import {
  AppError,
  canConsume,
  decimalUnits,
  decimalString,
  type Identity,
  type StockAction,
  type Material,
  type StockLocation,
  type InventoryItem,
  type Movement,
  type StockDashboard,
} from '@plant/contracts';
import { getConsumablesDb } from './database';
import { materials, locations, inventory, movements, idempotency, audit } from './schema';
export { getConsumablesDb, closeConsumablesDb } from './database';
export * as consumablesSchema from './schema';
type Executor = Pick<ReturnType<typeof getConsumablesDb>, 'execute'>;
async function rows<T>(db: Executor, statement: SQL): Promise<T[]> {
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
const db = () => getConsumablesDb();
const utcSql = (date: Date) => date.toISOString().replace('T', ' ').slice(0, 23);
export function requireStock(actor: Identity, action: StockAction, locationId?: string) {
  if (!canConsume(actor, action, locationId))
    throw new AppError(403, 'Akses Consumable Room atau lokasi belum diberikan.');
}
function scope(actor: Identity, column: SQL) {
  requireStock(actor, 'read');
  const g = actor.grants.find((v) => v.appId === 'consumables')!;
  return g.role === 'admin'
    ? sql`1=1`
    : sql`${column} IN (${sql.join(
        g.locationIds.map((v) => sql`${v}`),
        sql`,`,
      )})`;
}
const entry = (actor: Pick<Identity, 'id' | 'name'>, action: string, targetId: string, details: unknown) => ({
  id: randomUUID(),
  actorId: actor.id,
  actorName: actor.name,
  action,
  targetId,
  details: JSON.stringify(details),
  createdAt: new Date(),
});
function failValidation(e: unknown): never {
  if (e instanceof z.ZodError) throw new AppError(400, e.issues[0]?.message || 'Input tidak valid.');
  if (e instanceof AppError) throw e;
  throw new AppError(400, e instanceof Error ? e.message : 'Input tidak valid.');
}
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (e) {
    return failValidation(e);
  }
}
const amount = z.string().transform((v, ctx) => {
  try {
    return decimalString(decimalUnits(v));
  } catch (e) {
    ctx.addIssue({ code: 'custom', message: e instanceof Error ? e.message : 'Jumlah tidak valid.' });
    return z.NEVER;
  }
});
const positive = amount.refine((v) => decimalUnits(v) > 0n, 'Jumlah harus lebih besar dari nol.');
const materialInput = z
  .object({
    mmid: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(160),
    commonName: z.string().trim().max(160).default(''),
    unit: z.string().trim().min(1).max(30),
    category: z.string().trim().min(1).max(100),
    mrpType: z.string().trim().max(30).default(''),
    critical: z.boolean().default(false),
    packSize: positive.nullable().default(null),
    active: z.boolean().default(true),
    version: z.number().int().positive().optional(),
  })
  .strict();
const locationInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    active: z.boolean().default(true),
    version: z.number().int().positive().optional(),
  })
  .strict();
const inventoryInput = z
  .object({
    materialId: z.uuid(),
    locationId: z.uuid(),
    rack: z.string().trim().max(100).default(''),
    active: z.boolean().default(true),
    version: z.number().int().positive().optional(),
  })
  .strict();
function code(e: unknown): string | undefined {
  if (!e || typeof e !== 'object') return;
  return (e as { code?: string }).code || code((e as { cause?: unknown }).cause);
}
export async function saveMaterial(actor: Identity, body: unknown, id?: string) {
  requireStock(actor, 'manage');
  const input = parse(materialInput, body);
  const now = new Date();
  try {
    return await db().transaction(async (tx) => {
      if (!id) {
        if (!input.active) throw new AppError(400, 'Material baru harus aktif.');
        id = randomUUID();
        await tx.insert(materials).values({ ...input, id, version: 1, createdAt: now, updatedAt: now });
      } else {
        const [old] = await tx.select().from(materials).where(eq(materials.id, id)).for('update');
        if (!old) throw new AppError(404, 'Material tidak ditemukan.');
        if (input.version !== old.version)
          throw new AppError(409, 'Master berubah. Muat ulang sebelum menyimpan.');
        if (input.mmid !== old.mmid) throw new AppError(400, 'SAP/MMID tidak dapat diubah.');
        if (input.unit !== old.unit) {
          const [used] = await tx
            .select({ id: movements.id })
            .from(movements)
            .where(eq(movements.materialId, id))
            .limit(1);
          if (used) throw new AppError(409, 'Satuan dikunci setelah transaksi pertama.');
        }
        if (!input.active) {
          const [stock] = await tx
            .select({ id: inventory.id })
            .from(inventory)
            .where(and(eq(inventory.materialId, id), sql`${inventory.quantity}>0`))
            .limit(1);
          if (stock) throw new AppError(409, 'Material masih memiliki saldo.');
        }
        await tx
          .update(materials)
          .set({ ...input, version: old.version + 1, updatedAt: now })
          .where(eq(materials.id, id));
      }
      await tx.insert(audit).values(entry(actor, 'material.saved', id, { ...input }));
      return { id };
    });
  } catch (e) {
    if (code(e) === 'ER_DUP_ENTRY') throw new AppError(409, 'SAP/MMID sudah terdaftar.');
    throw e;
  }
}
export async function saveLocation(actor: Identity, body: unknown, id?: string) {
  requireStock(actor, 'manage');
  const input = parse(locationInput, body);
  try {
    return await db().transaction(async (tx) => {
      if (!id) {
        if (!input.active) throw new AppError(400, 'Lokasi baru harus aktif.');
        id = randomUUID();
        await tx.insert(locations).values({ ...input, id, version: 1, createdAt: new Date() });
      } else {
        const [old] = await tx.select().from(locations).where(eq(locations.id, id)).for('update');
        if (!old) throw new AppError(404, 'Lokasi tidak ditemukan.');
        if (input.version !== old.version) throw new AppError(409, 'Lokasi berubah. Muat ulang.');
        if (!input.active) {
          const [stock] = await tx
            .select({ id: inventory.id })
            .from(inventory)
            .where(and(eq(inventory.locationId, id), sql`${inventory.quantity}>0`))
            .limit(1);
          if (stock) throw new AppError(409, 'Lokasi masih memiliki saldo.');
        }
        await tx
          .update(locations)
          .set({ ...input, version: old.version + 1 })
          .where(eq(locations.id, id));
      }
      await tx.insert(audit).values(entry(actor, 'location.saved', id, input));
      return { id };
    });
  } catch (e) {
    if (code(e) === 'ER_DUP_ENTRY') throw new AppError(409, 'Nama lokasi sudah terdaftar.');
    throw e;
  }
}
export async function saveInventory(actor: Identity, body: unknown, id?: string) {
  requireStock(actor, 'manage');
  const input = parse(inventoryInput, body);
  try {
    return await db().transaction(async (tx) => {
      const [m] = await tx.select().from(materials).where(eq(materials.id, input.materialId)).for('update');
      const [l] = await tx.select().from(locations).where(eq(locations.id, input.locationId)).for('update');
      if (!m || !l) throw new AppError(404, 'Material atau lokasi tidak ditemukan.');
      if (!m.active || !l.active) throw new AppError(409, 'Material/lokasi tidak aktif.');
      if (!id) {
        if (!input.active) throw new AppError(400, 'Daftar stok baru harus aktif.');
        id = randomUUID();
        await tx.insert(inventory).values({ ...input, id, version: 1 });
      } else {
        const [old] = await tx.select().from(inventory).where(eq(inventory.id, id)).for('update');
        if (!old) throw new AppError(404, 'Daftar stok tidak ditemukan.');
        if (old.materialId !== input.materialId || old.locationId !== input.locationId)
          throw new AppError(400, 'Identitas daftar stok tidak dapat diubah.');
        if (input.version !== old.version) throw new AppError(409, 'Stok berubah. Muat ulang.');
        if (!input.active && decimalUnits(old.quantity) > 0n)
          throw new AppError(409, 'Material masih memiliki saldo pada lokasi ini.');
        await tx
          .update(inventory)
          .set({ rack: input.rack, active: input.active, version: old.version + 1 })
          .where(eq(inventory.id, id));
      }
      await tx.insert(audit).values(entry(actor, 'inventory.saved', id, input));
      return { id };
    });
  } catch (e) {
    if (code(e) === 'ER_DUP_ENTRY') throw new AppError(409, 'Material sudah terdaftar pada lokasi ini.');
    throw e;
  }
}
const common = { materialId: z.uuid(), locationId: z.uuid() };
const schemas = {
  opening: z
    .object({
      ...common,
      quantity: amount,
      reason: z.string().trim().min(1).max(500),
      expectedVersion: z.number().int().positive(),
    })
    .strict(),
  adjustment: z
    .object({
      ...common,
      quantity: amount,
      reason: z.string().trim().min(1).max(500),
      expectedVersion: z.number().int().positive(),
    })
    .strict(),
  issue: z
    .object({
      ...common,
      quantity: positive,
      job: z.string().trim().min(1).max(500),
      wo: z.string().trim().max(100).default(''),
      reference: z.string().trim().max(200).default(''),
    })
    .strict(),
  receipt: z.discriminatedUnion('mode', [
    z
      .object({
        ...common,
        mode: z.literal('base'),
        quantity: positive,
        reference: z.string().trim().min(1).max(200),
      })
      .strict(),
    z
      .object({
        ...common,
        mode: z.literal('pack'),
        packs: z.number().int().min(1).max(100000),
        materialVersion: z.number().int().positive(),
        reference: z.string().trim().min(1).max(200),
      })
      .strict(),
  ]),
};
type MoveKind = keyof typeof schemas;
export async function postMovement(actor: Identity, kind: MoveKind, body: unknown, key: string | null) {
  if (!Object.hasOwn(schemas, kind)) throw new AppError(400, 'Jenis transaksi tidak valid.');
  const input = parse(schemas[kind] as z.ZodType<Record<string, unknown>>, body) as Record<
    string,
    unknown
  > & { materialId: string; locationId: string };
  requireStock(
    actor,
    kind === 'issue' ? 'issue' : kind === 'receipt' ? 'receive' : 'manage',
    input.locationId,
  );
  if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key))
    throw new AppError(400, 'Idempotency-Key wajib, 8–128 karakter.');
  const canonical = JSON.stringify(
    Object.fromEntries(Object.entries({ kind, ...input }).sort(([a], [b]) => a.localeCompare(b))),
  );
  const hash = createHash('sha256').update(canonical).digest('hex');
  async function replay() {
    const [old] = await db()
      .select()
      .from(idempotency)
      .where(and(eq(idempotency.actorId, actor.id), eq(idempotency.key, key!)));
    if (!old) return null;
    if (old.hash !== hash) throw new AppError(409, 'Key sudah digunakan untuk payload berbeda.');
    const [move] = await db().select().from(movements).where(eq(movements.id, old.movementId));
    return { movement: move, replayed: true };
  }
  const old = await replay();
  if (old) return old;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db().transaction(async (tx) => {
        const [m] = await tx.select().from(materials).where(eq(materials.id, input.materialId)).for('update');
        const [l] = await tx.select().from(locations).where(eq(locations.id, input.locationId)).for('update');
        const [i] = await tx
          .select()
          .from(inventory)
          .where(and(eq(inventory.materialId, input.materialId), eq(inventory.locationId, input.locationId)))
          .for('update');
        // Recheck after acquiring locks: another identical request may have committed while waiting.
        const [previous] = await tx
          .select()
          .from(idempotency)
          .where(and(eq(idempotency.actorId, actor.id), eq(idempotency.key, key!)))
          .for('update');
        if (previous) {
          if (previous.hash !== hash) throw new AppError(409, 'Key sudah digunakan untuk payload berbeda.');
          const [movement] = await tx.select().from(movements).where(eq(movements.id, previous.movementId));
          return { movement, replayed: true };
        }
        if (!m || !l || !i) throw new AppError(404, 'Material belum terdaftar pada lokasi ini.');
        if (!m.active || !l.active || !i.active) throw new AppError(409, 'Material atau lokasi tidak aktif.');
        if (kind !== 'opening' && !i.initialized)
          throw new AppError(409, 'Konfirmasikan saldo awal terlebih dahulu.');
        if (kind === 'opening' && i.initialized) throw new AppError(409, 'Saldo awal sudah dicatat.');
        if ((kind === 'opening' || kind === 'adjustment') && input.expectedVersion !== i.version)
          throw new AppError(409, 'Saldo berubah. Muat ulang sebelum menghitung selisih.');
        const before = decimalUnits(i.quantity);
        let delta = 0n;
        let packs: number | null = null;
        if (kind === 'opening' || kind === 'adjustment') delta = decimalUnits(input.quantity) - before;
        else if (kind === 'issue') delta = -decimalUnits(input.quantity);
        else if (input.mode === 'pack') {
          if (!m.packSize || input.materialVersion !== m.version)
            throw new AppError(409, 'Konfigurasi kemasan berubah/belum diatur. Muat ulang.');
          packs = input.packs as number;
          delta = decimalUnits(m.packSize) * BigInt(packs);
        } else delta = decimalUnits(input.quantity);
        const after = before + delta;
        if (after < 0n) throw new AppError(409, 'Stok tidak mencukupi.');
        if (kind === 'adjustment' && delta === 0n) throw new AppError(400, 'Jumlah fisik sama dengan saldo.');
        let quantity: string, balanceAfter: string;
        try {
          quantity = decimalString(delta);
          balanceAfter = decimalString(after);
        } catch (e) {
          return failValidation(e);
        }
        const movement = {
          id: randomUUID(),
          inventoryId: i.id,
          materialId: m.id,
          locationId: l.id,
          mmid: m.mmid,
          description: m.description,
          unit: m.unit,
          locationName: l.name,
          type: kind,
          quantity,
          balanceAfter,
          packs,
          packSize: packs === null ? null : m.packSize,
          reference: String(input.reference || ''),
          wo: String(input.wo || ''),
          job: String(input.job || ''),
          reason: String(input.reason || ''),
          actorId: actor.id,
          actorName: actor.name,
          createdAt: new Date(),
        };
        await tx
          .update(inventory)
          .set({ quantity: balanceAfter, initialized: true, version: i.version + 1 })
          .where(eq(inventory.id, i.id));
        await tx.insert(movements).values(movement);
        await tx
          .insert(idempotency)
          .values({ id: randomUUID(), actorId: actor.id, key: key!, hash, movementId: movement.id });
        await tx.insert(audit).values(
          entry(actor, `stock.${kind}`, movement.id, {
            inventoryId: i.id,
            before: i.quantity,
            quantity,
            balanceAfter,
          }),
        );
        return { movement, replayed: false };
      });
    } catch (e) {
      if (code(e) === 'ER_DUP_ENTRY') {
        const result = await replay();
        if (result) return result;
      }
      if (attempt < 2 && ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(code(e) || '')) continue;
      throw e;
    }
  }
  throw new AppError(503, 'Transaksi sibuk. Coba lagi dengan key yang sama.');
}
function search(value: string, columns: SQL[]) {
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
async function page<T extends { id: string }>(
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
const matCols = sql`m.id,m.mmid,m.description,m.common_name AS commonName,m.unit,m.category,m.mrp_type AS mrpType,m.critical,m.pack_size AS packSize,m.active,m.version,m.source_batch AS sourceBatch,m.source_date AS sourceDate`;
const invCols = sql`${matCols},i.id AS inventoryId,i.location_id AS locationId,l.name AS locationName,i.rack,i.quantity,i.initialized,i.active AS inventoryActive,i.version AS inventoryVersion,l.active AS locationActive`;
const joinInv = sql`inventory i JOIN materials m ON m.id=i.material_id JOIN locations l ON l.id=i.location_id`;
const moveCols = sql`v.id,v.material_id AS materialId,v.location_id AS locationId,v.mmid,v.description,v.unit,v.location_name AS locationName,v.type,v.quantity,v.balance_after AS balanceAfter,v.packs,v.pack_size AS packSize,v.reference,v.wo,v.job,v.reason,v.actor_id AS actorId,v.actor_name AS actorName,v.created_at AS createdAt`;
const normalize = <T extends Record<string, unknown>>(item: T) => {
  for (const k of ['active', 'critical', 'initialized', 'inventoryActive', 'locationActive'])
    if (k in item) (item as Record<string, unknown>)[k] = !!item[k];
  return item;
};
export async function listLocations(actor: Identity) {
  const items = await rows<StockLocation>(
    db(),
    sql`SELECT id,name,active,version FROM locations WHERE ${scope(actor, sql`id`)} ORDER BY name`,
  );
  return { items: items.map(normalize) };
}
export async function internalLocations() {
  return (
    await rows<StockLocation>(db(), sql`SELECT id,name,active,version FROM locations ORDER BY name`)
  ).map(normalize);
}
export async function listMaterials(actor: Identity, p: URLSearchParams) {
  requireStock(actor, 'read');
  const conditions = [
    sql`1=1`,
    ...search(p.get('q') || '', [sql`m.mmid`, sql`m.description`, sql`m.common_name`, sql`m.category`]),
  ];
  if (p.get('category')) conditions.push(sql`m.category=${p.get('category')}`);
  if (p.get('active') !== 'all') conditions.push(sql`m.active=1`);
  const result = await page<Material>(
    sql`SELECT ${matCols},m.mmid AS cursorSort FROM materials m`,
    conditions,
    sql`m.mmid`,
    sql`m.id`,
    p,
  );
  return { ...result, items: result.items.map(normalize) };
}
export async function listInventory(actor: Identity, p: URLSearchParams) {
  if (
    p.get('availability') &&
    !['available', 'empty', 'uncounted', 'critical'].includes(p.get('availability')!)
  )
    throw new AppError(400, 'Filter ketersediaan tidak valid.');
  const conditions = [
    scope(actor, sql`i.location_id`),
    ...search(p.get('q') || '', [
      sql`m.mmid`,
      sql`m.description`,
      sql`m.common_name`,
      sql`m.category`,
      sql`i.rack`,
    ]),
  ];
  if (p.get('locationId')) {
    requireStock(actor, 'read', p.get('locationId')!);
    conditions.push(sql`i.location_id=${p.get('locationId')}`);
  }
  if (p.get('materialId')) conditions.push(sql`i.material_id=${p.get('materialId')}`);
  if (p.get('category')) conditions.push(sql`m.category=${p.get('category')}`);
  if (p.get('active') !== 'all') conditions.push(sql`i.active=1 AND m.active=1 AND l.active=1`);
  if (p.get('availability') === 'available') conditions.push(sql`i.initialized=1 AND i.quantity>0`);
  else if (p.get('availability') === 'empty') conditions.push(sql`i.initialized=1 AND i.quantity=0`);
  else if (p.get('availability') === 'uncounted') conditions.push(sql`i.initialized=0`);
  else if (p.get('availability') === 'critical')
    conditions.push(sql`m.critical=1 AND i.initialized=1 AND i.quantity=0`);
  const result = await page<InventoryItem>(
    sql`SELECT ${invCols},m.mmid AS cursorSort,i.id AS cursorId FROM ${joinInv}`,
    conditions,
    sql`m.mmid`,
    sql`i.id`,
    p,
  );
  return { ...result, items: result.items.map(normalize) };
}
export async function listCategories(actor: Identity) {
  requireStock(actor, 'read');
  return {
    items: (
      await rows<{ category: string }>(db(), sql`SELECT DISTINCT category FROM materials ORDER BY category`)
    ).map((v) => v.category),
  };
}
export async function materialDetail(actor: Identity, id: string) {
  requireStock(actor, 'read');
  const [material] = await db().select().from(materials).where(eq(materials.id, id));
  if (!material) throw new AppError(404, 'Material tidak ditemukan.');
  const stocks = await rows<InventoryItem>(
    db(),
    sql`SELECT ${invCols} FROM ${joinInv} WHERE m.id=${id} AND ${scope(actor, sql`i.location_id`)} ORDER BY l.name`,
  );
  return { material, stocks: stocks.map(normalize) };
}
export async function listMovements(actor: Identity, p: URLSearchParams) {
  const conditions = [
    scope(actor, sql`v.location_id`),
    ...search(p.get('q') || '', [
      sql`v.mmid`,
      sql`v.description`,
      sql`v.reference`,
      sql`v.wo`,
      sql`v.job`,
      sql`v.reason`,
      sql`v.actor_name`,
    ]),
  ];
  if (p.get('locationId')) {
    requireStock(actor, 'read', p.get('locationId')!);
    conditions.push(sql`v.location_id=${p.get('locationId')}`);
  }
  if (p.get('materialId')) conditions.push(sql`v.material_id=${p.get('materialId')}`);
  if (p.get('type')) {
    if (!['opening', 'receipt', 'issue', 'adjustment'].includes(p.get('type')!))
      throw new AppError(400, 'Jenis transaksi tidak valid.');
    conditions.push(sql`v.type=${p.get('type')}`);
  }
  for (const key of ['from', 'to'])
    if (p.get(key)) {
      const d = p.get(key)!;
      const t = new Date(d + 'T00:00:00+07:00');
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
        !Number.isFinite(t.getTime()) ||
        new Date(t.getTime() + 7 * 3600000).toISOString().slice(0, 10) !== d
      )
        throw new AppError(400, 'Tanggal tidak valid.');
      conditions.push(
        key === 'from'
          ? sql`v.created_at>=${utcSql(t)}`
          : sql`v.created_at<${utcSql(new Date(t.getTime() + 86400000))}`,
      );
    }
  return page<Movement>(
    sql`SELECT ${moveCols},v.created_at AS cursorSort FROM stock_movements v`,
    conditions,
    sql`v.created_at`,
    sql`v.id`,
    p,
    true,
  );
}
export async function movementDetail(actor: Identity, id: string) {
  const [item] = await rows<Movement>(
    db(),
    sql`SELECT ${moveCols} FROM stock_movements v WHERE v.id=${id} AND ${scope(actor, sql`v.location_id`)}`,
  );
  if (!item) throw new AppError(404, 'Transaksi tidak ditemukan.');
  return { movement: item };
}
export async function auditList(actor: Identity, p: URLSearchParams) {
  requireStock(actor, 'audit');
  return page<{
    id: string;
    action: string;
    actorName: string;
    targetId: string;
    details: string;
    createdAt: string;
  }>(
    sql`SELECT id,action,actor_name AS actorName,target_id AS targetId,details,created_at AS createdAt,created_at AS cursorSort FROM consumables_audit`,
    [sql`1=1`],
    sql`created_at`,
    sql`id`,
    p,
    true,
  );
}
export async function stockDashboard(
  actor: Identity,
  year = new Date(Date.now() + 7 * 3600000).getUTCFullYear(),
): Promise<StockDashboard> {
  const currentYear = new Date(Date.now() + 7 * 3600000).getUTCFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > currentYear)
    throw new AppError(400, 'Tahun tidak valid.');
  const [counts] = await rows<Record<string, number | string>>(
    db(),
    sql`SELECT COUNT(*) AS operational,COALESCE(SUM(i.initialized=1 AND i.quantity>0),0) AS available,COALESCE(SUM(i.initialized=1 AND i.quantity=0),0) AS \`empty\`,COALESCE(SUM(i.initialized=1 AND i.quantity=0 AND m.critical=1),0) AS criticalEmpty,COALESCE(SUM(i.initialized=0),0) AS uncounted FROM ${joinInv} WHERE ${scope(actor, sql`i.location_id`)} AND i.active=1 AND m.active=1 AND l.active=1`,
  );
  const summary = await rows<{ quarter: number; type: MoveKind; count: number }>(
    db(),
    sql`SELECT QUARTER(DATE_ADD(v.created_at,INTERVAL 7 HOUR)) AS quarter,v.type,COUNT(*) AS count FROM stock_movements v WHERE ${scope(actor, sql`v.location_id`)} AND v.created_at>=${utcSql(new Date(`${year}-01-01T00:00:00+07:00`))} AND v.created_at<${utcSql(new Date(`${year + 1}-01-01T00:00:00+07:00`))} GROUP BY quarter,v.type`,
  );
  const series = Array.from({ length: 4 }, (_, i) => ({
    quarter: i + 1,
    opening: 0,
    receipt: 0,
    issue: 0,
    adjustment: 0,
  }));
  for (const v of summary) series[v.quarter - 1][v.type] = Number(v.count);
  return {
    operational: Number(counts.operational),
    available: Number(counts.available),
    empty: Number(counts.empty),
    criticalEmpty: Number(counts.criticalEmpty),
    uncounted: Number(counts.uncounted),
    year,
    currentYear,
    series,
    recent: (await listMovements(actor, new URLSearchParams({ limit: '8' }))).items,
  };
}
export async function discovery(actor: Identity, q: string) {
  const p = new URLSearchParams({ q, limit: '8' });
  const [m, v] = await Promise.all([listMaterials(actor, p), listMovements(actor, p)]);
  return { materials: m.items, items: v.items };
}
export async function reconcile(actor: Identity) {
  requireStock(actor, 'audit');
  return {
    items: await rows<{ id: string; quantity: string; ledger: string }>(
      db(),
      sql`SELECT i.id,i.quantity,COALESCE(SUM(v.quantity),0) AS ledger FROM inventory i LEFT JOIN stock_movements v ON v.inventory_id=i.id GROUP BY i.id,i.quantity HAVING i.quantity<>COALESCE(SUM(v.quantity),0)`,
    ),
  };
}
