import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema';
let pool: mysql.Pool | undefined;
let db: ReturnType<typeof createDatabase> | undefined;
let adapterPool: mysql.Pool | undefined;
let adapterDb: ReturnType<typeof createDatabase> | undefined;
function createDatabase(p: mysql.Pool) {
  return drizzle(p, { schema, mode: 'default' });
}
export function getAuthDb() {
  if (!db) {
    if (!process.env.AUTH_DATABASE_URL) throw new Error('AUTH_DATABASE_URL belum dikonfigurasi.');
    pool = mysql.createPool({ uri: process.env.AUTH_DATABASE_URL, timezone: 'Z', connectionLimit: 10 });
    db = createDatabase(pool);
  }
  return db;
}
// Login holds a management transaction for its limiter while Better Auth owns
// its session transaction. A separate pool prevents nested pool exhaustion.
export function getAuthAdapterDb() {
  if (!adapterDb) {
    if (!process.env.AUTH_DATABASE_URL) throw new Error('AUTH_DATABASE_URL belum dikonfigurasi.');
    adapterPool = mysql.createPool({
      uri: process.env.AUTH_DATABASE_URL,
      timezone: 'Z',
      connectionLimit: 10,
    });
    adapterDb = createDatabase(adapterPool);
  }
  return adapterDb;
}
export async function closeAuthDb() {
  await Promise.all([pool?.end(), adapterPool?.end()]);
  pool = undefined;
  db = undefined;
  adapterPool = undefined;
  adapterDb = undefined;
}
