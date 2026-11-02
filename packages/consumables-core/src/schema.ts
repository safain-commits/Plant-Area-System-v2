import {
  mysqlTable,
  varchar,
  text,
  boolean,
  int,
  decimal,
  timestamp,
  index,
  uniqueIndex,
  check,
  primaryKey,
  date,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
export const materials = mysqlTable(
  'materials',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    mmid: varchar('mmid', { length: 80 }).notNull().unique(),
    description: varchar('description', { length: 160 }).notNull(),
    commonName: varchar('common_name', { length: 160 }).notNull(),
    unit: varchar('unit', { length: 30 }).notNull(),
    sapUnit: varchar('sap_unit', { length: 30 }).notNull().default(''),
    aliases: varchar('aliases', { length: 500 }).notNull().default(''),
    decimalAllowed: boolean('decimal_allowed').notNull().default(true),
    conversionReviewed: boolean('conversion_reviewed').notNull().default(true),
    category: varchar('category', { length: 100 }).notNull(),
    mrpType: varchar('mrp_type', { length: 30 }).notNull(),
    critical: boolean('critical').notNull(),
    packSize: decimal('pack_size', { precision: 18, scale: 6 }),
    active: boolean('active').notNull().default(true),
    version: int('version').notNull().default(1),
    sourceBatch: varchar('source_batch', { length: 100 }),
    sourceDate: varchar('source_date', { length: 10 }),
    createdAt: timestamp('created_at', { fsp: 3 }).notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).notNull(),
  },
  (t) => [index('material_category_idx').on(t.category, t.id)],
);
export const locations = mysqlTable('locations', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  active: boolean('active').notNull().default(true),
  version: int('version').notNull().default(1),
  createdAt: timestamp('created_at', { fsp: 3 }).notNull(),
});
export const inventory = mysqlTable(
  'inventory',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    materialId: varchar('material_id', { length: 36 })
      .notNull()
      .references(() => materials.id),
    locationId: varchar('location_id', { length: 36 })
      .notNull()
      .references(() => locations.id),
    rack: varchar('rack', { length: 100 }).notNull(),
    quantity: decimal('quantity', { precision: 18, scale: 6 }).notNull().default('0'),
    initialized: boolean('initialized').notNull().default(false),
    active: boolean('active').notNull().default(true),
    version: int('version').notNull().default(1),
  },
  (t) => [
    uniqueIndex('inventory_material_location_uq').on(t.materialId, t.locationId),
    index('inventory_location_idx').on(t.locationId, t.id),
    check('inventory_quantity_nonnegative', sql`${t.quantity} >= 0`),
  ],
);
export const documents = mysqlTable(
  'stock_documents',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    number: varchar('number', { length: 30 }).notNull().unique(),
    type: varchar('type', { length: 16 }).notNull(),
    locationId: varchar('location_id', { length: 36 })
      .notNull()
      .references(() => locations.id),
    locationName: varchar('location_name', { length: 100 }).notNull(),
    hec: varchar('hec', { length: 20 }).notNull().default(''),
    wo: varchar('wo', { length: 100 }).notNull().default(''),
    note: varchar('note', { length: 500 }).notNull().default(''),
    channel: varchar('channel', { length: 10 }).notNull(),
    requesterName: varchar('requester_name', { length: 100 }).notNull(),
    requesterNik: varchar('requester_nik', { length: 30 }).notNull().default(''),
    sourceRef: varchar('source_ref', { length: 100 }).notNull().default(''),
    reservationNo: varchar('reservation_no', { length: 30 }).notNull().default(''),
    equipmentNo: varchar('equipment_no', { length: 100 }).notNull().default(''),
    functionalLocation: varchar('functional_location', { length: 100 }).notNull().default(''),
    costCenter: varchar('cost_center', { length: 40 }).notNull().default(''),
    requiredDate: date('required_date', { mode: 'string' }),
    lineCount: int('line_count').notNull(),
    actorId: varchar('actor_id', { length: 64 }).notNull(),
    actorName: varchar('actor_name', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { fsp: 3 }).notNull(),
  },
  (t) => [
    index('document_location_time_idx').on(t.locationId, t.createdAt, t.id),
    index('document_type_time_idx').on(t.type, t.createdAt, t.id),
    index('document_hec_idx').on(t.hec),
    index('document_wo_idx').on(t.wo),
    index('document_reservation_idx').on(t.reservationNo),
  ],
);
export const documentSequences = mysqlTable(
  'stock_document_sequences',
  {
    type: varchar('type', { length: 16 }).notNull(),
    year: int('year').notNull(),
    lastValue: int('last_value').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.type, t.year] })],
);
export const movements = mysqlTable(
  'stock_movements',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    documentId: varchar('document_id', { length: 36 }).references(() => documents.id),
    lineNo: int('line_no'),
    commonName: varchar('common_name', { length: 160 }),
    sapUnit: varchar('sap_unit', { length: 30 }),
    sapQuantity: decimal('sap_quantity', { precision: 18, scale: 6 }),
    inventoryId: varchar('inventory_id', { length: 36 })
      .notNull()
      .references(() => inventory.id),
    materialId: varchar('material_id', { length: 36 })
      .notNull()
      .references(() => materials.id),
    locationId: varchar('location_id', { length: 36 })
      .notNull()
      .references(() => locations.id),
    mmid: varchar('mmid', { length: 80 }).notNull(),
    description: varchar('description', { length: 160 }).notNull(),
    unit: varchar('unit', { length: 30 }).notNull(),
    locationName: varchar('location_name', { length: 100 }).notNull(),
    type: varchar('type', { length: 16 }).notNull(),
    quantity: decimal('quantity', { precision: 18, scale: 6 }).notNull(),
    balanceAfter: decimal('balance_after', { precision: 18, scale: 6 }).notNull(),
    packs: int('packs'),
    packSize: decimal('pack_size', { precision: 18, scale: 6 }),
    reference: varchar('reference', { length: 200 }).notNull(),
    wo: varchar('wo', { length: 100 }).notNull(),
    job: varchar('job', { length: 500 }).notNull(),
    reason: varchar('reason', { length: 500 }).notNull(),
    actorId: varchar('actor_id', { length: 64 }).notNull(),
    actorName: varchar('actor_name', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { fsp: 3 }).notNull(),
  },
  (t) => [
    index('movement_location_time_idx').on(t.locationId, t.createdAt, t.id),
    index('movement_material_idx').on(t.materialId, t.createdAt, t.id),
    uniqueIndex('movement_document_line_uq').on(t.documentId, t.lineNo),
  ],
);
export const idempotency = mysqlTable(
  'stock_idempotency',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    actorId: varchar('actor_id', { length: 64 }).notNull(),
    key: varchar('request_key', { length: 128 }).notNull(),
    hash: varchar('payload_hash', { length: 64 }).notNull(),
    movementId: varchar('movement_id', { length: 36 }).references(() => movements.id),
    documentId: varchar('document_id', { length: 36 }).references(() => documents.id),
  },
  (t) => [
    uniqueIndex('stock_idempotency_actor_key_uq').on(t.actorId, t.key),
    check(
      'stock_idempotency_one_target',
      sql`(${t.movementId} IS NOT NULL) <> (${t.documentId} IS NOT NULL)`,
    ),
  ],
);
export const audit = mysqlTable(
  'consumables_audit',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    actorId: varchar('actor_id', { length: 64 }).notNull(),
    actorName: varchar('actor_name', { length: 100 }).notNull(),
    action: varchar('action', { length: 64 }).notNull(),
    targetId: varchar('target_id', { length: 100 }).notNull(),
    details: text('details').notNull(),
    createdAt: timestamp('created_at', { fsp: 3 }).notNull(),
  },
  (t) => [index('consumables_audit_time_idx').on(t.createdAt, t.id)],
);
export const imports = mysqlTable('catalog_imports', {
  id: varchar('id', { length: 100 }).primaryKey(),
  checksum: varchar('checksum', { length: 64 }).notNull(),
  rowCount: int('row_count').notNull(),
  createdAt: timestamp('created_at', { fsp: 3 }).notNull(),
});
