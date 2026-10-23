import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { eq, and } from 'drizzle-orm';
import { createUser, setAppGrant, setGrant, getAuthDb, authSchema, closeAuthDb } from '@plant/auth-core';
import { AppError, type Identity } from '@plant/contracts';
import { migrateConsumablesCatalog } from '../../scripts/consumables-migration';
if (
  process.env.TEST_DATABASE !== '1' ||
  !process.env.AUTH_MIGRATION_DATABASE_URL?.includes('127.0.0.1:13306/plant_auth')
)
  throw Error('Isolated database required.');
const actor: Identity = {
  id: randomUUID(),
  name: 'Access test',
  email: 'access@example.test',
  position: '',
  portalAdmin: true,
  mustChangePassword: false,
  grants: [],
};
test('targeted grants validate live locations and preserve Bag Filter access on revoke/failure', async () => {
  const { id } = await createUser(actor, {
    name: 'Access fixture',
    email: `${randomUUID()}@example.test`,
    password: 'temporary-stock-password',
  });
  await setGrant(actor, id, { appId: 'bag-filter', role: 'viewer', equipment: ['561-BF1'] });
  const locationId = randomUUID(),
    native = globalThis.fetch;
  process.env.CONSUMABLES_INTERNAL_URL = 'http://scope-fixture';
  try {
    globalThis.fetch = async () =>
      Response.json({ items: [{ id: locationId, name: 'Fixture', active: true }] });
    await setAppGrant(actor, id, 'consumables', {
      appId: 'consumables',
      role: 'storekeeper',
      locationIds: [locationId],
    });
    const read = () => getAuthDb().select().from(authSchema.grants).where(eq(authSchema.grants.userId, id));
    assert.equal((await read()).length, 2);
    await assert.rejects(
      setAppGrant(actor, id, 'consumables', {
        appId: 'consumables',
        role: 'operator',
        locationIds: [randomUUID()],
      }),
      (e: unknown) => e instanceof AppError && e.status === 400,
    );
    globalThis.fetch = async () => {
      throw Error('Unavailable');
    };
    await assert.rejects(
      setAppGrant(actor, id, 'consumables', {
        appId: 'consumables',
        role: 'viewer',
        locationIds: [locationId],
      }),
      (e: unknown) => e instanceof AppError && e.status === 503,
    );
    assert.equal((await read()).find((g) => g.appId === 'consumables')?.role, 'storekeeper');
    await setAppGrant(actor, id, 'consumables', null);
    assert.deepEqual(
      (await read()).map((g) => g.appId),
      ['bag-filter'],
    );
  } finally {
    globalThis.fetch = native;
    delete process.env.CONSUMABLES_INTERNAL_URL;
  }
});
test('additive migration activates planned app, grants only active bootstrap once and preserves disable/revoke', async () => {
  const connection = await mysql.createConnection(process.env.AUTH_MIGRATION_DATABASE_URL!),
    name = 'consumables_fixture_' + randomUUID().replaceAll('-', '');
  if (!/^consumables_fixture_[a-f0-9]{32}$/.test(name)) throw Error('Invalid fixture name.');
  try {
    await connection.query(`CREATE DATABASE \`${name}\``);
    await connection.query(`USE \`${name}\``);
    await migrate(drizzle(connection), { migrationsFolder: 'packages/auth-core/migrations' });
    await connection.query(
      "INSERT INTO applications(id,name,status,path) VALUES ('bag-filter','Bag Filter','active','/bag-filter'),('consumables','Consumable Room','planned',NULL)",
    );
    const bootstrap = randomUUID(),
      other = randomUUID();
    for (const id of [bootstrap, other])
      await connection.query(
        'INSERT INTO users(id,name,email,email_verified,created_at,updated_at,position,active,portal_admin,must_change_password) VALUES (?,?,?,1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),?,1,1,0)',
        [id, 'Fixture', id + '@example.test', ''],
      );
    await connection.query(
      'INSERT INTO auth_audit(id,actor_id,actor_name,action,target_id,details,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(3))',
      [randomUUID(), bootstrap, 'Fixture', 'bootstrap.created', bootstrap, '{}'],
    );
    await connection.query(
      "INSERT INTO app_grants(user_id,app_id,role,equipment) VALUES (?,'bag-filter','viewer','[\"561-BF1\"]')",
      [other],
    );
    await migrateConsumablesCatalog(connection);
    const [grants] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT user_id,app_id,role FROM app_grants WHERE app_id='consumables'",
    );
    assert.equal(grants.length, 1);
    assert.equal(grants[0].user_id, bootstrap);
    await connection.query("DELETE FROM app_grants WHERE app_id='consumables'");
    await connection.query("UPDATE applications SET status='disabled' WHERE id='consumables'");
    await migrateConsumablesCatalog(connection);
    const [remaining] = await connection.query<mysql.RowDataPacket[]>('SELECT app_id FROM app_grants');
    assert.deepEqual(
      remaining.map((v) => v.app_id),
      ['bag-filter'],
    );
    const [apps] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT status,path FROM applications WHERE id='consumables'",
    );
    assert.equal(apps[0].status, 'disabled');
    assert.equal(apps[0].path, '/consumables');
  } finally {
    await connection.query('USE plant_auth');
    await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await connection.end();
  }
});
after(async () => {
  await closeAuthDb();
});
