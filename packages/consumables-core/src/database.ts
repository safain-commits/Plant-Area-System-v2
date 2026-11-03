import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema';
const development = process.env.NODE_ENV === 'development';
const cache = globalThis as typeof globalThis & { __plantConsumablesPool?: mysql.Pool };
let pool = development ? cache.__plantConsumablesPool : undefined;
let db: ReturnType<typeof create> | undefined;
function create(p: mysql.Pool) {
  return drizzle(p, { schema, mode: 'default' });
}
export function getConsumablesDb() {
  if (!db) {
    if (!process.env.CONSUMABLES_DATABASE_URL) throw Error('CONSUMABLES_DATABASE_URL diperlukan.');
    pool ??= mysql.createPool({
      uri: process.env.CONSUMABLES_DATABASE_URL,
      timezone: 'Z',
      connectionLimit: 10,
      ...(development ? { maxIdle: 2, idleTimeout: 60_000 } : {}),
    });
    if (development) cache.__plantConsumablesPool = pool;
    db = create(pool);
  }
  return db;
}
export async function closeConsumablesDb() {
  await pool?.end();
  if (cache.__plantConsumablesPool === pool) delete cache.__plantConsumablesPool;
  pool = undefined;
  db = undefined;
}
