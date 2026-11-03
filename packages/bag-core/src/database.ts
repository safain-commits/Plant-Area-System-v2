import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema';
const development = process.env.NODE_ENV === 'development';
const cache = globalThis as typeof globalThis & { __plantBagPool?: mysql.Pool };
let pool = development ? cache.__plantBagPool : undefined;
let db: ReturnType<typeof createDatabase> | undefined;
function createDatabase(p: mysql.Pool) {
  return drizzle(p, { schema, mode: 'default' });
}
export function getBagDb() {
  if (!db) {
    if (!process.env.BAG_DATABASE_URL) throw new Error('BAG_DATABASE_URL belum dikonfigurasi.');
    pool ??= mysql.createPool({
      uri: process.env.BAG_DATABASE_URL,
      timezone: 'Z',
      connectionLimit: 10,
      ...(development ? { maxIdle: 2, idleTimeout: 60_000 } : {}),
    });
    if (development) cache.__plantBagPool = pool;
    db = createDatabase(pool);
  }
  return db;
}
export async function closeBagDb() {
  await pool?.end();
  if (cache.__plantBagPool === pool) delete cache.__plantBagPool;
  pool = undefined;
  db = undefined;
}
