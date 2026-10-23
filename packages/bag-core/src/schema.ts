import {
  mysqlTable,
  varchar,
  int,
  bigint,
  datetime,
  text,
  index,
  uniqueIndex,
  primaryKey,
  foreignKey,
} from 'drizzle-orm/mysql-core';
export const dataMigrations = mysqlTable('data_migrations', {
  id: varchar('id', { length: 100 }).primaryKey(),
  completedAt: datetime('completed_at', { fsp: 3, mode: 'date' }).notNull(),
});
export const equipmentTable = mysqlTable('equipment', {
  code: varchar('code', { length: 16 }).primaryKey(),
  perSide: int('per_side').notNull(),
});
export const coordinates = mysqlTable(
  'coordinates',
  {
    equipmentCode: varchar('equipment_code', { length: 16 })
      .notNull()
      .references(() => equipmentTable.code),
    side: varchar('side', { length: 8 }).notNull(),
    compartment: int('compartment').notNull(),
    column: int('col').notNull(),
    row: int('row_no').notNull(),
  },
  (t) => [primaryKey({ columns: [t.equipmentCode, t.side, t.compartment, t.column, t.row] })],
);
export const batches = mysqlTable(
  'replacement_batches',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    equipmentCode: varchar('equipment_code', { length: 16 })
      .notNull()
      .references(() => equipmentTable.code),
    actorId: varchar('actor_id', { length: 36 }).notNull(),
    actorName: varchar('actor_name', { length: 100 }).notNull(),
    installedAt: datetime('installed_at', { fsp: 3, mode: 'date' }).notNull(),
    reason: varchar('reason', { length: 500 }).notNull(),
    wo: varchar('wo', { length: 100 }).notNull(),
    brand: varchar('brand', { length: 40 }),
    createdAt: datetime('created_at', { fsp: 3, mode: 'date' }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    requestHash: varchar('request_hash', { length: 64 }).notNull(),
    positionCount: int('position_count').notNull(),
  },
  (t) => [
    uniqueIndex('batch_actor_key_unique').on(t.actorId, t.idempotencyKey),
    index('batch_equipment_time_idx').on(t.equipmentCode, t.createdAt, t.id),
  ],
);
export const installations = mysqlTable(
  'installations',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
    batchId: varchar('batch_id', { length: 36 })
      .notNull()
      .references(() => batches.id),
    equipmentCode: varchar('equipment_code', { length: 16 }).notNull(),
    side: varchar('side', { length: 8 }).notNull(),
    compartment: int('compartment').notNull(),
    column: int('col').notNull(),
    row: int('row_no').notNull(),
    installedAt: datetime('installed_at', { fsp: 3, mode: 'date' }).notNull(),
  },
  (t) => [
    uniqueIndex('batch_position_unique').on(t.batchId, t.side, t.compartment, t.column, t.row),
    index('installation_position_time_idx').on(
      t.equipmentCode,
      t.side,
      t.compartment,
      t.column,
      t.row,
      t.installedAt,
      t.id,
    ),
    foreignKey({
      columns: [t.equipmentCode, t.side, t.compartment, t.column, t.row],
      foreignColumns: [
        coordinates.equipmentCode,
        coordinates.side,
        coordinates.compartment,
        coordinates.column,
        coordinates.row,
      ],
      name: 'installation_coordinate_fk',
    }),
  ],
);
export const bagAudit = mysqlTable(
  'bag_audit',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    batchId: varchar('batch_id', { length: 36 })
      .notNull()
      .references(() => batches.id),
    equipmentCode: varchar('equipment_code', { length: 16 }).notNull(),
    actorId: varchar('actor_id', { length: 36 }).notNull(),
    actorName: varchar('actor_name', { length: 100 }).notNull(),
    action: varchar('action', { length: 64 }).notNull(),
    details: text('details').notNull(),
    createdAt: datetime('created_at', { fsp: 3, mode: 'date' }).notNull(),
  },
  (t) => [index('bag_audit_equipment_time_idx').on(t.equipmentCode, t.createdAt, t.id)],
);
