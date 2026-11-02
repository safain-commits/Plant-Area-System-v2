import mysql from 'mysql2/promise';
import { preflightSingleRoom } from './consumables-room-migration';
const uri = process.env.CONSUMABLES_MIGRATION_DATABASE_URL || process.env.CONSUMABLES_DATABASE_URL;
if (!uri || new URL(uri).pathname !== '/plant_consumables')
  throw Error('URL database Consumable Room diperlukan.');
const c = await mysql.createConnection(uri);
try {
  const result = await preflightSingleRoom(c);
  console.log(JSON.stringify({ event: 'consumables.single-room.preflight', ...result }));
  if (!result.ready) process.exitCode = 1;
} finally {
  await c.end();
}
