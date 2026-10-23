import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
// Explicitly provisions existing MySQL volumes; initdb scripts run only for empty volumes.
export async function provisionConsumables() {
  try {
    await provision();
  } catch {
    throw Error(
      'Provisioning Consumables gagal. Periksa URL, kredensial dan hak migrasi; detail koneksi tidak dicatat.',
    );
  }
}
async function provision() {
  const runtime = process.env.CONSUMABLES_DATABASE_URL,
    migration = process.env.CONSUMABLES_MIGRATION_DATABASE_URL;
  if (!runtime || !migration) throw Error('URL database Consumables diperlukan.');
  const r = new URL(runtime),
    m = new URL(migration),
    password = decodeURIComponent(r.password);
  if (
    r.pathname !== '/plant_consumables' ||
    m.pathname !== '/plant_consumables' ||
    r.username !== 'plant_consumables' ||
    r.hostname !== m.hostname ||
    (r.port || '3306') !== (m.port || '3306') ||
    !/^[A-Za-z0-9_-]{24,128}$/.test(password)
  )
    throw Error('Konfigurasi provisioning Consumables tidak valid.');
  const c = await mysql.createConnection({
    host: m.hostname,
    port: Number(m.port) || 3306,
    user: decodeURIComponent(m.username),
    password: decodeURIComponent(m.password),
    timezone: 'Z',
  });
  try {
    await c.query(
      'CREATE DATABASE IF NOT EXISTS plant_consumables CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci',
    );
    await c.query("CREATE USER IF NOT EXISTS 'plant_consumables'@'%' IDENTIFIED BY ?", [password]);
    await c.query("GRANT SELECT,INSERT,UPDATE,DELETE ON plant_consumables.* TO 'plant_consumables'@'%'");
  } finally {
    await c.end();
  }
  const probe = await mysql.createConnection({ uri: runtime, timezone: 'Z' });
  try {
    await probe.query('SELECT 1');
  } finally {
    await probe.end();
  }
}
export async function migrateConsumablesCatalog(c: mysql.Connection) {
  await c.beginTransaction();
  try {
    const [done] = await c.query<mysql.RowDataPacket[]>(
      "SELECT id FROM data_migrations WHERE id='consumables-v1' FOR UPDATE",
    );
    if (!done.length) {
      await c.query(
        "INSERT INTO applications(id,name,status,path) VALUES ('consumables','Consumable Room','active','/consumables') ON DUPLICATE KEY UPDATE name=VALUES(name),path=VALUES(path),status=IF(status='planned','active',status)",
      );
      const [people] = await c.query<mysql.RowDataPacket[]>(
        "SELECT DISTINCT u.id,u.name FROM users u JOIN auth_audit a ON a.target_id=u.id AND a.action='bootstrap.created' WHERE u.active=1 AND u.portal_admin=1",
      );
      for (const u of people) {
        const [result] = await c.query<mysql.ResultSetHeader>(
          "INSERT IGNORE INTO app_grants(user_id,app_id,role,equipment,scope) VALUES (?,'consumables','admin','[]',?)",
          [u.id, JSON.stringify({ locationIds: [] })],
        );
        if (result.affectedRows)
          await c.query(
            'INSERT INTO auth_audit(id,actor_id,actor_name,action,target_id,details,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(3))',
            [randomUUID(), u.id, u.name, 'consumables.bootstrap_granted', u.id, '{}'],
          );
      }
      await c.query(
        "INSERT INTO data_migrations(id,completed_at) VALUES ('consumables-v1',UTC_TIMESTAMP(3))",
      );
    }
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  }
}
