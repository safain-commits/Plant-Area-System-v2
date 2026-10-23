import { sql } from 'drizzle-orm';
import { AppError, equipment, ageBucket, ageHours, type EquipmentCode } from '@plant/contracts';
import { getBagDb } from './database';

const allowed = (codes: EquipmentCode[]) => equipment.filter((e) => codes.includes(e.code));
const scope = (codes: string[]) =>
  sql.join(
    codes.map((code) => sql`${code}`),
    sql`, `,
  );
const iso = (value: Date | string) =>
  value instanceof Date
    ? value.toISOString()
    : new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z').toISOString();
export async function activity(codes: EquipmentCode[], query = '', limit = 12) {
  if (query.length > 200) throw new AppError(400, 'Pencarian maksimal 200 karakter.');
  const catalog = allowed(codes);
  if (!catalog.length) return [];
  const q = `%${query.trim().replace(/[\\%_]/g, '\\$&')}%`;
  const filter = query.trim()
    ? sql`AND (wo LIKE ${q} OR reason LIKE ${q} OR brand LIKE ${q} OR equipment_code LIKE ${q} OR id=${query.trim()})`
    : sql``;
  const [rows] = await getBagDb().execute(
    sql`SELECT id,equipment_code AS equipmentCode,wo,reason,brand,position_count AS positionCount,actor_name AS actorName,installed_at AS installedAt,created_at AS createdAt FROM replacement_batches WHERE equipment_code IN (${scope(catalog.map((e) => e.code))}) ${filter} ORDER BY created_at DESC,id DESC LIMIT ${Math.min(50, Math.max(1, limit))}`,
  );
  return (
    rows as unknown as {
      id: string;
      equipmentCode: EquipmentCode;
      wo: string;
      reason: string;
      brand: string | null;
      positionCount: number;
      actorName: string;
      installedAt: Date | string;
      createdAt: Date | string;
    }[]
  ).map((row) => ({ ...row, installedAt: iso(row.installedAt), createdAt: iso(row.createdAt) }));
}
export async function dashboard(codes: EquipmentCode[], days: number, now = Date.now()) {
  if (days !== 7 && days !== 30) throw new AppError(400, 'Periode harus 7 atau 30 hari.');
  const catalog = allowed(codes),
    distribution = Array(7).fill(0) as number[];
  const today = new Date(now + 7 * 3600000).toISOString().slice(0, 10);
  const start = Date.parse(today + 'T00:00:00+07:00') - (days - 1) * 86400000;
  const series = Array.from({ length: days }, (_, i) => ({
    date: new Date(start + i * 86400000 + 7 * 3600000).toISOString().slice(0, 10),
    total: 0,
    brands: {} as Record<string, number>,
  }));
  const perEquipment = catalog.map((e) => ({
    code: e.code,
    total: e.compartments * e.bagsPerCompartment,
    installed: 0,
    older900: 0,
  }));
  let previousTotal = 0;
  if (catalog.length) {
    const list = scope(catalog.map((e) => e.code));
    const [current] = await getBagDb().execute(
      sql`SELECT equipment_code AS equipmentCode,installed_at AS installedAt FROM (SELECT equipment_code,installed_at,ROW_NUMBER() OVER(PARTITION BY equipment_code,side,compartment,col,row_no ORDER BY installed_at DESC,id DESC) AS rn FROM installations WHERE equipment_code IN (${list})) r WHERE rn=1`,
    );
    for (const p of current as unknown as { equipmentCode: EquipmentCode; installedAt: Date | string }[]) {
      const hours = ageHours(iso(p.installedAt), now)!;
      distribution[ageBucket(hours)]++;
      const target = perEquipment.find((e) => e.code === p.equipmentCode)!;
      target.installed++;
      if (hours >= 21600) target.older900++;
    }
    const [history] = await getBagDb().execute(
      sql`SELECT DATE_FORMAT(DATE_ADD(installed_at,INTERVAL 7 HOUR),'%Y-%m-%d') AS day,brand,SUM(position_count) AS total FROM replacement_batches WHERE equipment_code IN (${list}) AND installed_at>=${new Date(start - days * 86400000)} AND installed_at<=${new Date(now + 60000)} GROUP BY day,brand ORDER BY day`,
    );
    for (const h of history as unknown as { day: string; brand: string | null; total: number | string }[]) {
      const day = series.find((s) => s.date === h.day);
      if (day) {
        day.total += Number(h.total);
        day.brands[h.brand || 'Belum tercatat'] = Number(h.total);
      } else if (h.day < series[0].date) previousTotal += Number(h.total);
    }
  }
  const total = perEquipment.reduce((sum, e) => sum + e.total, 0),
    installed = perEquipment.reduce((sum, e) => sum + e.installed, 0),
    older900 = perEquipment.reduce((sum, e) => sum + e.older900, 0);
  return {
    serverTime: new Date(now).toISOString(),
    days,
    total,
    installed,
    neverInstalled: total - installed,
    older900,
    distribution,
    perEquipment,
    series,
    periodTotal: series.reduce((s, d) => s + d.total, 0),
    previousTotal,
    recent: await activity(codes),
  };
}
