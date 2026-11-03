import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema';
// Next development recompiles modules; sockets must survive those module instances.
const development = process.env.NODE_ENV === 'development';
const cache = globalThis as typeof globalThis & {
  __plantAuthPool?: mysql.Pool;
  __plantAuthAdapterPool?: mysql.Pool;
};
let pool = development ? cache.__plantAuthPool : undefined;
let db: ReturnType<typeof createDatabase> | undefined;
let adapterPool = development ? cache.__plantAuthAdapterPool : undefined;
let adapterDb: ReturnType<typeof createDatabase> | undefined;
function createDatabase(p: mysql.Pool) {
  return drizzle(p, { schema, mode: 'default' });
}
export function getAuthDb() {
  if (!db) {
    if (!process.env.AUTH_DATABASE_URL) throw new Error('AUTH_DATABASE_URL belum dikonfigurasi.');
    pool ??= mysql.createPool({
      uri: process.env.AUTH_DATABASE_URL,
      timezone: 'Z',
      connectionLimit: 10,
      ...(development ? { maxIdle: 2, idleTimeout: 60_000 } : {}),
    });
    if (development) cache.__plantAuthPool = pool;
    db = createDatabase(pool);
  }
  return db;
}
// Login holds a management transaction for its limiter while Better Auth owns
// its session transaction. A separate pool prevents nested pool exhaustion.
export function getAuthAdapterDb() {
  if (!adapterDb) {
    if (!process.env.AUTH_DATABASE_URL) throw new Error('AUTH_DATABASE_URL belum dikonfigurasi.');
    adapterPool ??= mysql.createPool({
      uri: process.env.AUTH_DATABASE_URL,
      timezone: 'Z',
      connectionLimit: 10,
      ...(development ? { maxIdle: 2, idleTimeout: 60_000 } : {}),
    });
    if (development) cache.__plantAuthAdapterPool = adapterPool;
    adapterDb = createDatabase(adapterPool);
  }
  return adapterDb;
}
export async function closeAuthDb() {
  await Promise.all([pool?.end(), adapterPool?.end()]);
  if (cache.__plantAuthPool === pool) delete cache.__plantAuthPool;
  if (cache.__plantAuthAdapterPool === adapterPool) delete cache.__plantAuthAdapterPool;
  pool = undefined;
  db = undefined;
  adapterPool = undefined;
  adapterDb = undefined;
}
