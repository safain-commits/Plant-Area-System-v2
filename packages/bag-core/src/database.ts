import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema';
let pool: mysql.Pool | undefined;
let db: ReturnType<typeof createDatabase> | undefined;
function createDatabase(p: mysql.Pool) {
  return drizzle(p, { schema, mode: 'default' });
}
export function getBagDb() {
  if (!db) {
    if (!process.env.BAG_DATABASE_URL) throw new Error('BAG_DATABASE_URL belum dikonfigurasi.');
    pool = mysql.createPool({ uri: process.env.BAG_DATABASE_URL, timezone: 'Z', connectionLimit: 10 });
    db = createDatabase(pool);
  }
  return db;
}
export async function closeBagDb() {
  await pool?.end();
  pool = undefined;
  db = undefined;
}
