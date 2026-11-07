import { R22_ROOM_ID } from './room';
import { createHash, randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  AppError,
  canConsume,
  normalizeHec,
  HEC_PATTERN,
  decimalString,
  decimalUnits,
  validateStockQuantity,
  sapToR22,
  canonicalDocumentPayload,
  type Identity,
  type StockDocument,
  type StockDocumentLine,
  type StockDocumentType,
  type StockLineConflict,
  type DocumentResult,
  type MaterialSearchResult,
} from '@plant/contracts';
import {
  documents,
  documentSequences,
  materials,
  locations,
  inventory,
  movements,
  idempotency,
  audit,
} from './schema';
import {
  db,
  rows,
  parse,
  positive,
  recordId,
  requireStock,
  scope,
  entry,
  code,
  page,
  search,
  utcSql,
  matCols,
  moveCols,
  normalize,
} from './support';

const text = (n: number) => z.string().trim().max(n).default('');
const hec = z
  .string()
  .transform(normalizeHec)
  .refine((v) => HEC_PATTERN.test(v), 'HAC/SAC wajib dengan format XXX-XXX, contoh 452-BU1.');
const qtyLine = z.object({ materialId: recordId, quantity: positive }).strict();
const requester = z
  .object({ name: z.string().trim().min(1).max(100), nik: text(30) })
  .strict()
  .optional();
const header = { hec, wo: text(100), note: text(500), requester };
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    'Tanggal tidak valid.',
  )
  .optional();
const pickLine = z.union([
  z
    .object({
      materialId: recordId,
      sapQuantity: positive,
      materialVersion: z.number().int().positive().optional(),
    })
    .strict(),
  qtyLine,
]);
const schemas = {
  consume: z.object({ ...header, lines: z.array(qtyLine).min(1).max(50) }).strict(),
  return: z.object({ ...header, sourceRef: text(100), lines: z.array(qtyLine).min(1).max(50) }).strict(),
  picklist: z
    .object({
      reservationNo: z.string().trim().min(1).max(30),
      wo: z.string().trim().min(1).max(100),
      woDescription: text(500),
      equipmentNo: text(100),
      functionalLocation: text(100),
      costCenter: z.string().trim().min(1, 'Cost Center wajib diisi.').max(40),
      requiredDate: date,
      lines: z.array(pickLine).min(1).max(100),
    })
    .strict(),
};
export class DocumentConflict extends AppError {
  constructor(public lines: StockLineConflict[]) {
    super(409, 'Ada baris yang perlu ditinjau. Saldo belum diubah.', 'STOCK_LINE_CONFLICT');
  }
}
const docCols = sql`d.id,d.number,d.type,d.hec,d.wo,d.note,d.channel,d.requester_name AS requesterName,d.requester_nik AS requesterNik,d.source_ref AS sourceRef,d.reservation_no AS reservationNo,d.equipment_no AS equipmentNo,d.functional_location AS functionalLocation,d.cost_center AS costCenter,DATE_FORMAT(d.required_date,'%Y-%m-%d') AS requiredDate,d.line_count AS lineCount,d.actor_id AS actorId,d.actor_name AS actorName,d.created_at AS createdAt`;
type Tx = Parameters<Parameters<ReturnType<typeof db>['transaction']>[0]>[0];
async function readResult(tx: Tx | ReturnType<typeof db>, id: string): Promise<DocumentResult> {
  const [document] = await rows<StockDocument>(
    tx,
    sql`SELECT ${docCols} FROM stock_documents d WHERE d.id=${id}`,
  );
  const lines = await rows<StockDocumentLine>(
    tx,
    sql`SELECT ${moveCols} FROM stock_movements v WHERE v.document_id=${id} AND v.line_no IS NOT NULL ORDER BY v.line_no`,
  );
  return { document, lines };
}
export async function createDocument(
  actor: Identity,
  type: StockDocumentType,
  body: unknown,
  key: string | null,
): Promise<DocumentResult> {
  if (!Object.hasOwn(schemas, type)) throw new AppError(400, 'Jenis dokumen tidak valid.');
  requireStock(actor, type === 'consume' ? 'issue' : type === 'return' ? 'return' : 'receive');
  // Check impersonation before schema parsing, including explicitly supplied null/undefined.
  if (body && typeof body === 'object' && Object.hasOwn(body, 'requester') && !canConsume(actor, 'onbehalf'))
    throw new AppError(403, 'Hanya R22 Cashier atau admin yang dapat mengisi peminta lain.');
  const input = {
    ...parse(schemas[type] as z.ZodType<Record<string, unknown>>, body),
    locationId: R22_ROOM_ID,
  } as {
    locationId: string;
    hec?: string;
    wo: string;
    note?: string;
    requester?: { name: string; nik?: string };
    sourceRef?: string;
    reservationNo?: string;
    woDescription?: string;
    equipmentNo?: string;
    functionalLocation?: string;
    costCenter?: string;
    requiredDate?: string;
    lines: Array<{ materialId: string; quantity?: string; sapQuantity?: string; materialVersion?: number }>;
  };
  if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key))
    throw new AppError(400, 'Idempotency-Key wajib, 8–128 karakter.');
  if (new Set(input.lines.map((l) => l.materialId)).size !== input.lines.length)
    throw new AppError(400, 'Material duplikat dalam dokumen.');
  const hash = createHash('sha256')
    .update(canonicalDocumentPayload({ type, ...input }))
    .digest('hex');
  async function replay(executor: Tx | ReturnType<typeof db>, locked = false) {
    const query = executor
      .select()
      .from(idempotency)
      .where(and(eq(idempotency.actorId, actor.id), eq(idempotency.key, key!)));
    const [old] = locked ? await query.for('update') : await query;
    if (!old) return null;
    if (old.hash !== hash || !old.documentId)
      throw new AppError(409, 'Key sudah digunakan untuk payload berbeda.');
    return { ...(await readResult(executor, old.documentId)), replayed: true };
  }
  const previous = await replay(db());
  if (previous) return previous;
  for (let attempt = 0; attempt < 3; attempt++)
    try {
      return await db().transaction(async (tx) => {
        const [location] = await tx
          .select()
          .from(locations)
          .where(eq(locations.id, input.locationId))
          .for('update');
        if (!location) throw new AppError(404, 'Konfigurasi R22 belum tersedia. Jalankan migrasi.');
        const lockedMaterials = new Map<string, typeof materials.$inferSelect>();
        for (const id of input.lines.map((l) => l.materialId).sort()) {
          const [m] = await tx.select().from(materials).where(eq(materials.id, id)).for('update');
          if (!m) throw new AppError(404, 'MMID tidak ada pada master. Admin perlu menambahkan material.');
          lockedMaterials.set(id, m);
        }
        // Location lock also serializes creation of missing inventory rows.
        const existing = await tx.select().from(inventory).where(eq(inventory.locationId, input.locationId));
        const wanted = new Set(input.lines.map((l) => l.materialId));
        const stocks = new Map<string, typeof inventory.$inferSelect>();
        for (const item of existing
          .filter((i) => wanted.has(i.materialId))
          .sort((a, b) => a.id.localeCompare(b.id))) {
          const [i] = await tx.select().from(inventory).where(eq(inventory.id, item.id)).for('update');
          stocks.set(i.materialId, i);
        }
        const again = await replay(tx, true);
        if (again) return again;
        const conflicts: StockLineConflict[] = [],
          converted = new Map<string, string>();
        for (const [idx, line] of input.lines.entries()) {
          const m = lockedMaterials.get(line.materialId)!,
            i = stocks.get(line.materialId);
          let q = line.quantity || line.sapQuantity || '0',
            error = '';
          if (!location.active || !m.active || (i && !i.active))
            error = 'Material atau daftar stok tidak aktif.';
          else if (!i && type !== 'picklist') error = 'Material belum terdaftar dalam stok R22.';
          else if (i && !i.initialized) error = 'Belum dihitung. Admin perlu mengonfirmasi saldo awal.';
          if (!error) {
            try {
              if (line.sapQuantity) {
                if (!m.conversionReviewed) error = 'Konversi lama perlu ditinjau admin; gunakan satuan R22.';
                else if (line.materialVersion !== undefined && line.materialVersion !== m.version)
                  error = 'Konfigurasi material berubah. Muat ulang konversi.';
                else q = sapToR22(line.sapQuantity, m);
              } else q = validateStockQuantity(line.quantity!, m.decimalAllowed);
            } catch (e) {
              throw new AppError(400, `Baris ${idx + 1} (${m.mmid}): ${(e as Error).message}`);
            }
          }
          if (!error && type === 'consume' && decimalUnits(q) > decimalUnits(i!.quantity))
            error = 'Stok tidak mencukupi.';
          if (!error && type !== 'consume')
            try {
              decimalString(decimalUnits(i?.quantity || '0') + decimalUnits(q));
            } catch {
              throw new AppError(400, `Baris ${idx + 1}: saldo melampaui kapasitas.`);
            }
          if (error)
            conflicts.push({
              lineNo: idx + 1,
              materialId: m.id,
              mmid: m.mmid,
              available: i?.quantity || '0.000000',
              requested: q,
              error,
            });
          converted.set(m.id, q);
        }
        if (conflicts.length) throw new DocumentConflict(conflicts);
        const now = new Date(Date.now()),
          year = new Date(now.getTime() + 7 * 3600000).getUTCFullYear();
        await tx
          .insert(documentSequences)
          .values({ type, year, lastValue: 0 })
          .onDuplicateKeyUpdate({ set: { lastValue: sql`${documentSequences.lastValue}` } });
        const [sequence] = await tx
          .select()
          .from(documentSequences)
          .where(and(eq(documentSequences.type, type), eq(documentSequences.year, year)))
          .for('update');
        if (sequence.lastValue >= 999999)
          throw new AppError(409, 'Kapasitas nomor dokumen tahun ini telah tercapai.');
        const next = sequence.lastValue + 1;
        await tx
          .update(documentSequences)
          .set({ lastValue: next })
          .where(and(eq(documentSequences.type, type), eq(documentSequences.year, year)));
        const number = `R22-${{ consume: 'CO', return: 'RO', picklist: 'PL' }[type]}-${year}-${String(next).padStart(6, '0')}`;
        const extracted = normalizeHec(input.functionalLocation?.split(/\s/)[0] || '');
        const doc: typeof documents.$inferInsert = {
          id: randomUUID(),
          number,
          type,
          locationId: location.id,
          locationName: location.name,
          hec: type === 'picklist' ? (HEC_PATTERN.test(extracted) ? extracted : '') : input.hec,
          wo: input.wo,
          note: type === 'picklist' ? input.woDescription : input.note,
          channel: input.requester ? 'cashier' : 'self',
          requesterName: input.requester?.name || actor.name,
          requesterNik: input.requester?.nik || '',
          sourceRef: input.sourceRef || '',
          reservationNo: input.reservationNo || '',
          equipmentNo: input.equipmentNo || '',
          functionalLocation: input.functionalLocation || '',
          costCenter: input.costCenter || '',
          requiredDate: input.requiredDate || null,
          lineCount: input.lines.length,
          actorId: actor.id,
          actorName: actor.name,
          createdAt: now,
        };
        await tx.insert(documents).values(doc);
        for (const [idx, line] of input.lines.entries()) {
          const m = lockedMaterials.get(line.materialId)!,
            q = converted.get(m.id)!;
          let i = stocks.get(m.id);
          const base = {
            materialId: m.id,
            locationId: location.id,
            mmid: m.mmid,
            description: m.description,
            commonName: m.commonName,
            unit: m.unit,
            locationName: location.name,
            packs: null,
            packSize: null,
            reference: doc.reservationNo || doc.sourceRef || '',
            wo: doc.wo || '',
            job: doc.hec || '',
            reason: '',
            actorId: actor.id,
            actorName: actor.name,
            createdAt: now,
            documentId: doc.id,
          };
          if (!i) {
            i = {
              id: randomUUID(),
              materialId: m.id,
              locationId: location.id,
              rack: '',
              quantity: '0.000000',
              initialized: true,
              active: true,
              version: 1,
            };
            await tx.insert(inventory).values(i);
            const openingId = randomUUID();
            await tx.insert(movements).values({
              ...base,
              id: openingId,
              inventoryId: i.id,
              type: 'opening',
              quantity: '0.000000',
              balanceAfter: '0.000000',
              reason: `Auto-daftar dari picklist ${number}`,
            });
            await tx.insert(audit).values(
              entry(actor, 'stock.opening', openingId, {
                documentId: doc.id,
                inventoryId: i.id,
                quantity: '0.000000',
                balanceAfter: '0.000000',
              }),
            );
          }
          const delta = type === 'consume' ? -decimalUnits(q) : decimalUnits(q),
            after = decimalString(decimalUnits(i.quantity) + delta),
            id = randomUUID();
          await tx
            .update(inventory)
            .set({ quantity: after, version: i.version + 1 })
            .where(eq(inventory.id, i.id));
          const kind = type === 'consume' ? 'issue' : type === 'picklist' ? 'receipt' : 'return';
          await tx.insert(movements).values({
            ...base,
            id,
            inventoryId: i.id,
            type: kind,
            lineNo: idx + 1,
            quantity: decimalString(delta),
            balanceAfter: after,
            sapUnit: line.sapQuantity ? m.sapUnit : null,
            sapQuantity: line.sapQuantity || null,
            packSize: line.sapQuantity ? m.packSize || '1.000000' : null,
          });
          await tx.insert(audit).values(
            entry(actor, `stock.${kind}`, id, {
              documentId: doc.id,
              inventoryId: i.id,
              before: i.quantity,
              quantity: decimalString(delta),
              balanceAfter: after,
            }),
          );
        }
        await tx
          .insert(idempotency)
          .values({ id: randomUUID(), actorId: actor.id, key: key!, hash, documentId: doc.id });
        await tx
          .insert(audit)
          .values(entry(actor, `document.${type}`, doc.id, { ...doc, lines: input.lines.length }));
        const prior =
          type === 'picklist'
            ? await rows<StockDocument>(
                tx,
                sql`SELECT ${docCols} FROM stock_documents d WHERE d.reservation_no=${doc.reservationNo} AND d.id<>${doc.id} AND ${scope(actor, sql`d.location_id`)} ORDER BY d.created_at DESC,d.id DESC LIMIT 50`,
              )
            : [];
        return { ...(await readResult(tx, doc.id)), replayed: false, previousDocuments: prior };
      });
    } catch (e) {
      if (code(e) === 'ER_DUP_ENTRY') {
        const value = await replay(db());
        if (value) return value;
      }
      if (attempt < 2 && ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(code(e) || '')) continue;
      throw e;
    }
  throw new AppError(503, 'Transaksi sibuk. Coba kembali dengan key yang sama.');
}
export async function documentDetail(actor: Identity, id: string) {
  const [item] = await rows<StockDocument>(
    db(),
    sql`SELECT ${docCols} FROM stock_documents d WHERE d.id=${id} AND ${scope(actor, sql`d.location_id`)}`,
  );
  if (!item) throw new AppError(404, 'Dokumen tidak ditemukan.');
  return readResult(db(), id);
}
export function dateConditions(p: URLSearchParams, column: ReturnType<typeof sql>) {
  return ['from', 'to'].flatMap((k) => {
    const v = p.get(k);
    if (!v) return [];
    const checked = date.safeParse(v);
    if (!checked.success) throw new AppError(400, 'Tanggal tidak valid.');
    const d = new Date(v + 'T00:00:00+07:00');
    return [
      k === 'from'
        ? sql`${column}>=${utcSql(d)}`
        : sql`${column}<${utcSql(new Date(d.getTime() + 86400000))}`,
    ];
  });
}
export async function listDocuments(actor: Identity, p: URLSearchParams) {
  const conditions = [
    scope(actor, sql`d.location_id`),
    ...search(p.get('q') || '', [
      sql`d.number`,
      sql`d.hec`,
      sql`d.wo`,
      sql`d.reservation_no`,
      sql`d.requester_name`,
      sql`d.actor_name`,
      sql`d.note`,
    ]),
    ...dateConditions(p, sql`d.created_at`),
  ];
  if (p.get('type')) {
    if (!Object.hasOwn(schemas, p.get('type')!)) throw new AppError(400, 'Jenis dokumen tidak valid.');
    conditions.push(sql`d.type=${p.get('type')}`);
  }
  if (p.get('reservationNo')) conditions.push(sql`d.reservation_no=${p.get('reservationNo')}`);
  return page<StockDocument>(
    sql`SELECT ${docCols},d.created_at AS cursorSort FROM stock_documents d`,
    conditions,
    sql`d.created_at`,
    sql`d.id`,
    p,
    true,
  );
}
export async function searchMaterials(actor: Identity, p: URLSearchParams, catalog = false) {
  const location = R22_ROOM_ID;
  requireStock(actor, catalog ? 'receive' : 'read');
  const q = (p.get('q') || '').trim();
  if (!q) return { items: [] };
  const escaped = q.replace(/[\\%_]/g, '\\$&');
  const conditions = [
    sql`m.active=1`,
    ...search(q, [sql`m.mmid`, sql`m.common_name`, sql`m.aliases`, sql`m.description`, sql`m.category`]),
  ];
  if (location) {
    const [l] = await db().select().from(locations).where(eq(locations.id, location));
    if (!l?.active) throw new AppError(409, 'Konfigurasi R22 belum tersedia.');
  }
  if (!catalog) conditions.push(sql`i.active=1`);
  const found = await rows<MaterialSearchResult>(
    db(),
    sql`SELECT ${matCols},i.id AS inventoryId,COALESCE(i.rack,'') AS rack,COALESCE(i.quantity,0) AS quantity,COALESCE(i.initialized,0) AS initialized,COALESCE(i.active,0) AS inventoryActive FROM materials m LEFT JOIN inventory i ON i.material_id=m.id AND i.location_id=${location} WHERE ${sql.join(conditions, sql` AND `)} ORDER BY CASE WHEN m.mmid=${q} THEN 0 WHEN m.mmid LIKE ${escaped + '%'} THEN 1 WHEN m.common_name LIKE ${'%' + escaped + '%'} OR m.aliases LIKE ${'%' + escaped + '%'} THEN 2 ELSE 3 END,m.mmid,m.id LIMIT 8`,
  );
  return { items: found.map(normalize) };
}
export async function hecSuggestions(actor: Identity, q: string) {
  if (q.length > 200) throw new AppError(400, 'Pencarian maksimal 200 karakter.');
  return {
    items: (
      await rows<{ hec: string }>(
        db(),
        sql`SELECT d.hec FROM stock_documents d WHERE ${scope(actor, sql`d.location_id`)} AND d.hec<>'' AND d.hec LIKE ${normalizeHec(q).replace(/[\\%_]/g, '\\$&') + '%'} GROUP BY d.hec ORDER BY MAX(d.created_at) DESC,d.hec LIMIT 8`,
      )
    ).map((v) => v.hec),
  };
}
