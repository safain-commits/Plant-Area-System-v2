import { sql } from 'drizzle-orm';
import {
  AppError,
  equipment,
  ageBucket,
  ageHours,
  ageStops,
  bagAgeScaleDays,
  hasPermission,
  wibWeekStarts,
  type EquipmentCode,
  type Identity,
  type PortalSummary,
  type PortalTone,
} from '@plant/contracts';
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
    sql`SELECT id,equipment_code AS equipmentCode,wo,reason,brand,position_count AS positionCount,actor_name AS actorName,installed_at AS installedAt,created_at AS createdAt FROM replacement_batches b WHERE equipment_code IN (${scope(catalog.map((e) => e.code))}) AND NOT EXISTS (SELECT 1 FROM batch_cancellations c WHERE c.batch_id=b.id) ${filter} ORDER BY created_at DESC,id DESC LIMIT ${Math.min(50, Math.max(1, limit))}`,
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
export async function dashboard(codes: EquipmentCode[], year: number, now = Date.now()) {
  const currentYear = new Date(now + 7 * 3600000).getUTCFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > currentYear)
    throw new AppError(400, `Tahun harus antara 2000 dan ${currentYear}.`);
  const catalog = allowed(codes),
    distribution = Array(7).fill(0) as number[];
  const start = Date.parse(`${year - 1}-01-01T00:00:00+07:00`);
  const end = Date.parse(`${year + 1}-01-01T00:00:00+07:00`);
  const series = Array.from({ length: 4 }, (_, i) => ({
    quarter: i + 1,
    label: `Q${i + 1}`,
    total: 0,
    brands: {} as Record<string, number>,
  }));
  const perEquipment = catalog.map((e) => ({
    code: e.code,
    total: e.compartments * e.bagsPerCompartment,
    installed: 0,
    older900: 0,
    older1260: 0,
  }));
  let previousTotal = 0;
  if (catalog.length) {
    const list = scope(catalog.map((e) => e.code));
    const [current] = await getBagDb().execute(
      sql`SELECT equipment_code AS equipmentCode,installed_at AS installedAt FROM (SELECT equipment_code,installed_at,ROW_NUMBER() OVER(PARTITION BY equipment_code,side,compartment,col,row_no ORDER BY installed_at DESC,id DESC) AS rn FROM installations i WHERE equipment_code IN (${list}) AND NOT EXISTS (SELECT 1 FROM batch_cancellations c WHERE c.batch_id=i.batch_id)) r WHERE rn=1`,
    );
    for (const p of current as unknown as { equipmentCode: EquipmentCode; installedAt: Date | string }[]) {
      const hours = ageHours(iso(p.installedAt), now)!;
      distribution[ageBucket(hours)]++;
      const target = perEquipment.find((e) => e.code === p.equipmentCode)!;
      target.installed++;
      // Preserve the legacy API field for older readers; current UI uses older1260.
      if (hours >= 900 * 24) target.older900++;
      if (hours >= bagAgeScaleDays * 24) target.older1260++;
    }
    const [history] = await getBagDb().execute(
      sql`SELECT YEAR(DATE_ADD(installed_at,INTERVAL 7 HOUR)) AS year,QUARTER(DATE_ADD(installed_at,INTERVAL 7 HOUR)) AS quarter,brand,SUM(position_count) AS total FROM replacement_batches b WHERE equipment_code IN (${list}) AND NOT EXISTS (SELECT 1 FROM batch_cancellations c WHERE c.batch_id=b.id) AND installed_at>=${new Date(start)} AND installed_at<${new Date(end)} AND installed_at<=${new Date(now + 60000)} GROUP BY year,quarter,brand ORDER BY year,quarter`,
    );
    for (const h of history as unknown as {
      year: number;
      quarter: number;
      brand: string | null;
      total: number | string;
    }[]) {
      if (Number(h.year) === year) {
        const quarter = series[Number(h.quarter) - 1];
        quarter.total += Number(h.total);
        quarter.brands[h.brand || 'Belum tercatat'] = Number(h.total);
      } else previousTotal += Number(h.total);
    }
  }
  const total = perEquipment.reduce((sum, e) => sum + e.total, 0),
    installed = perEquipment.reduce((sum, e) => sum + e.installed, 0),
    older900 = perEquipment.reduce((sum, e) => sum + e.older900, 0),
    older1260 = perEquipment.reduce((sum, e) => sum + e.older1260, 0);
  return {
    serverTime: new Date(now).toISOString(),
    year,
    currentYear,
    total,
    installed,
    neverInstalled: total - installed,
    older900,
    older1260,
    distribution,
    perEquipment,
    series,
    periodTotal: series.reduce((s, d) => s + d.total, 0),
    previousTotal,
    recent: await activity(codes),
  };
}

const ageTones: PortalTone[] = ['accent', 'neutral', 'neutral', 'neutral', 'warning', 'warning', 'danger'];
export async function portalSummary(actor: Identity, now = Date.now()): Promise<PortalSummary> {
  if (!hasPermission(actor, 'read')) throw new AppError(403, 'Akses Bag Filter belum diberikan.');
  const grant = actor.grants.find(
    (g): g is Extract<typeof g, { appId: 'bag-filter' }> => g.appId === 'bag-filter',
  )!;
  const codes = grant.equipment;
  const catalog = allowed(codes),
    distribution = Array(7).fill(0) as number[];
  const perEquipment = catalog.map((e) => ({
    code: e.code,
    total: e.compartments * e.bagsPerCompartment,
    installed: 0,
    older1260: 0,
  }));
  if (catalog.length) {
    const list = scope(catalog.map((e) => e.code));
    const [current] = await getBagDb().execute(
      sql`SELECT equipment_code AS equipmentCode,installed_at AS installedAt FROM (SELECT equipment_code,installed_at,ROW_NUMBER() OVER(PARTITION BY equipment_code,side,compartment,col,row_no ORDER BY installed_at DESC,id DESC) AS rn FROM installations i WHERE equipment_code IN (${list}) AND NOT EXISTS (SELECT 1 FROM batch_cancellations c WHERE c.batch_id=i.batch_id)) r WHERE rn=1`,
    );
    for (const p of current as unknown as { equipmentCode: EquipmentCode; installedAt: Date | string }[]) {
      const hours = ageHours(iso(p.installedAt), now)!;
      distribution[ageBucket(hours)]++;
      const target = perEquipment.find((e) => e.code === p.equipmentCode)!;
      target.installed++;
      if (hours >= bagAgeScaleDays * 24) target.older1260++;
    }
  }
  const total = perEquipment.reduce((sum, e) => sum + e.total, 0),
    installed = perEquipment.reduce((sum, e) => sum + e.installed, 0),
    older1260 = perEquipment.reduce((sum, e) => sum + e.older1260, 0);
  const readOnly = grant.role === 'viewer';
  const primaryEquipment = (perEquipment.find((e) => e.older1260 > 0) ?? perEquipment[0])?.code;
  const recentRows = await activity(codes, '', 5);

  const weeks = wibWeekStarts(now, 12);
  const weekCounts: Record<string, number> = Object.fromEntries(weeks.map((w) => [w.start, 0]));
  if (catalog.length) {
    const list = scope(catalog.map((e) => e.code));
    const [batches] = await getBagDb().execute(
      sql`SELECT installed_at AS installedAt FROM replacement_batches b WHERE equipment_code IN (${list}) AND NOT EXISTS (SELECT 1 FROM batch_cancellations c WHERE c.batch_id=b.id) AND installed_at >= ${new Date(weeks[0].startMs)} AND installed_at < ${new Date(weeks[11].endMs)} AND installed_at <= ${new Date(now + 60000)}`,
    );
    for (const b of batches as unknown as { installedAt: Date | string }[]) {
      const t = Date.parse(iso(b.installedAt));
      const targetWeek = weeks.find((w) => t >= w.startMs && t < w.endMs);
      if (targetWeek) weekCounts[targetWeek.start]++;
    }
  }

  const pct = total > 0 ? ((installed / total) * 100).toFixed(1).replace('.', ',') : '0,0';

  return {
    appId: 'bag-filter',
    updatedAt: recentRows[0]?.createdAt ?? new Date(now).toISOString(),
    headline: {
      label: 'Terpasang',
      value: installed,
      total,
      unit: 'posisi',
      caption:
        total > 0 ? `${pct}% posisi mempunyai catatan pemasangan aktif.` : 'Belum ada posisi bag tercatat.',
      href: '/bag-filter',
    },
    metrics: [
      {
        key: 'older1260',
        label: `Umur ≥ ${bagAgeScaleDays.toLocaleString('id-ID')} hari`,
        value: older1260,
        tone: older1260 > 0 ? 'danger' : 'neutral',
        ...(primaryEquipment
          ? { href: `/bag-filter/equipment/${primaryEquipment.toLowerCase()}?age=${bagAgeScaleDays}` }
          : {}),
      },
      {
        key: 'neverInstalled',
        label: 'Belum tercatat',
        value: total - installed,
        tone: 'neutral',
        href: '/bag-filter',
      },
    ],
    attention: perEquipment
      .filter((e) => e.older1260 > 0)
      .map((e) => ({
        key: `bag-age-${e.code}`,
        group: {
          key: 'bag-age',
          label: `Bag ≥ ${bagAgeScaleDays.toLocaleString('id-ID')} hari`,
          unit: 'bag',
        },
        label: `${e.code} · bag ≥ ${bagAgeScaleDays.toLocaleString('id-ID')} hari`,
        value: e.older1260,
        severity: 'danger' as const,
        href: `/bag-filter/equipment/${e.code.toLowerCase()}?age=${bagAgeScaleDays}`,
      })),
    activity: {
      unitSingular: 'batch',
      weeks: weeks.map((w) => ({ start: w.start, count: weekCounts[w.start] })),
    },
    recent: recentRows.slice(0, 5).map((item) => ({
      id: item.id,
      title: `Penggantian ${item.equipmentCode}`,
      meta: `${item.brand || 'Pabrikan belum diisi'} · ${item.actorName}${item.wo ? ` · WO ${item.wo}` : ''}`,
      at: item.createdAt,
      href: `/bag-filter/equipment/${item.equipmentCode.toLowerCase()}?batch=${encodeURIComponent(item.id)}`,
      value: item.positionCount,
      unit: 'bag',
    })),
    ...(readOnly || !primaryEquipment
      ? {}
      : {
          action: {
            label: 'Catat penggantian',
            href: `/bag-filter/equipment/${primaryEquipment.toLowerCase()}`,
            icon: 'plus',
          },
        }),
  };
}
