import type mysql from 'mysql2/promise';
import { R22_ROOM_ID } from '../packages/consumables-core/src/room';
export async function preflightSingleRoom(c: mysql.Connection) {
  const counts: Record<string, number> = {};
  for (const table of ['inventory', 'stock_movements', 'stock_documents']) {
    const [exists] = await c.query<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?',
      [table],
    );
    if (!Number(exists[0].n)) {
      counts[table] = 0;
      continue;
    }
    const [rows] = await c.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM \`${table}\` WHERE location_id<>?`,
      [R22_ROOM_ID],
    );
    counts[table] = Number(rows[0].n);
  }
  const [exists] = await c.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='locations'",
  );
  let conflicts = 0;
  if (Number(exists[0].n)) {
    const [rows] = await c.query<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM locations WHERE (name='R22' AND id<>?) OR (id=? AND (name<>'R22' OR active=0))",
      [R22_ROOM_ID, R22_ROOM_ID],
    );
    conflicts = Number(rows[0].n);
  }
  return {
    ready: !Object.values(counts).some(Boolean) && !conflicts,
    nonCanonicalRows: counts,
    roomConflicts: conflicts,
  };
}
