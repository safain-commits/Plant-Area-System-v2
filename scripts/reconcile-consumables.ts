import { getConsumablesDb, closeConsumablesDb } from '@plant/consumables-core';
import { sql } from 'drizzle-orm';
try {
  const [rows] = await getConsumablesDb().execute(
    sql`SELECT i.id,i.quantity,COALESCE(SUM(v.quantity),0) AS ledger FROM inventory i LEFT JOIN stock_movements v ON v.inventory_id=i.id GROUP BY i.id,i.quantity HAVING i.quantity<>COALESCE(SUM(v.quantity),0)`,
  );
  console.log(JSON.stringify({ event: 'stock.reconciliation', differences: rows }));
  if (Array.isArray(rows) && rows.length) process.exitCode = 1;
} catch {
  console.error(
    JSON.stringify({
      event: 'stock.reconciliation.failed',
      error: 'Rekonsiliasi belum dapat diverifikasi. Periksa koneksi database.',
    }),
  );
  process.exitCode = 1;
} finally {
  await closeConsumablesDb();
}
