import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { appCatalog } from '@plant/contracts';
import { getAuthDb, closeAuthDb, authSchema } from '@plant/auth-core';
import { seedEquipment, closeBagDb } from '@plant/bag-core';
import { closeConsumablesDb } from '@plant/consumables-core';
import { migrateConsumablesCatalog, provisionConsumables } from './consumables-migration';
import { migrateEquipmentData } from './equipment-migration';

try {
  await provisionConsumables();
  for (const [key, folder] of [
    ['AUTH_MIGRATION_DATABASE_URL', 'auth-core'],
    ['BAG_MIGRATION_DATABASE_URL', 'bag-core'],
    ['CONSUMABLES_MIGRATION_DATABASE_URL', 'consumables-core'],
  ] as const) {
    const url = process.env[key];
    if (!url) throw new Error(`${key} diperlukan untuk migrasi.`);
    const connection = await mysql.createConnection({ uri: url, timezone: 'Z', multipleStatements: true });
    try {
      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        "SELECT GET_LOCK('plant_schema_migration',30) AS acquired",
      );
      if (rows[0].acquired !== 1) throw new Error('Migrasi lain masih berjalan.');
      await migrate(drizzle(connection), { migrationsFolder: `packages/${folder}/migrations` });
      if (folder !== 'consumables-core') await migrateEquipmentData(connection, folder);
      if (folder === 'auth-core') await migrateConsumablesCatalog(connection);
      await connection.query("SELECT RELEASE_LOCK('plant_schema_migration')");
      console.log(JSON.stringify({ event: 'migration.complete', database: folder }));
    } finally {
      await connection.end();
    }
  }
  for (const app of appCatalog)
    await getAuthDb()
      .insert(authSchema.applications)
      .values({ id: app.id, name: app.name, status: app.status, path: 'path' in app ? app.path : null })
      .onDuplicateKeyUpdate({ set: { name: app.name } });
  await seedEquipment();
  console.log(JSON.stringify({ event: 'catalog.seeded', actualInstallationsCreated: 0 }));
} finally {
  await closeAuthDb();
  await closeBagDb();
  await closeConsumablesDb();
}
