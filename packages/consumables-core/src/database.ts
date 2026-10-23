import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema';
let pool: mysql.Pool | undefined;
let db: ReturnType<typeof create> | undefined;
function create(p: mysql.Pool) {
  return drizzle(p, { schema, mode: 'default' });
}
export function getConsumablesDb() {
  if (!db) {
    if (!process.env.CONSUMABLES_DATABASE_URL) throw Error('CONSUMABLES_DATABASE_URL diperlukan.');
    pool = mysql.createPool({
      uri: process.env.CONSUMABLES_DATABASE_URL,
      timezone: 'Z',
      connectionLimit: 10,
    });
    db = create(pool);
  }
  return db;
}
export async function closeConsumablesDb() {
  await pool?.end();
  pool = undefined;
  db = undefined;
}
