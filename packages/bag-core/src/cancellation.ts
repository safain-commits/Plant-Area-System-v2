import { createHash, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import {
  AppError,
  cancellationSchema,
  getEquipment,
  hasPermission,
  type Identity,
  type BatchCancellation,
} from '@plant/contracts';
import { getBagDb } from './database';
import { batches, batchCancellations, bagAudit } from './schema';

export type CancellationColumns = {
  cancelledAt: Date | string | null;
  cancelledById: string | null;
  cancelledByName: string | null;
  cancellationReason: string | null;
};
export function cancellationMetadata(row: CancellationColumns): BatchCancellation | null {
  if (!row.cancelledAt) return null;
  const value = row.cancelledAt;
  return {
    reason: row.cancellationReason!,
    actorId: row.cancelledById!,
    actorName: row.cancelledByName!,
    cancelledAt: new Date(
      typeof value === 'string' && /^\d{4}-\d{2}-\d{2} /.test(value) ? value.replace(' ', 'T') + 'Z' : value,
    ).toISOString(),
  };
}
function errorCode(error: unknown): string | undefined {
  return error && typeof error === 'object'
    ? (error as { code?: string }).code || errorCode((error as { cause?: unknown }).cause)
    : undefined;
}
export async function cancelReplacement(
  actor: Identity,
  code: string,
  batchId: string,
  input: unknown,
  key: string | null,
) {
  if (!getEquipment(code)) throw new AppError(404, 'Equipment tidak ditemukan.');
  if (!hasPermission(actor, 'cancel', code))
    throw new AppError(403, 'Pembatalan memerlukan admin Bag Filter dalam cakupan equipment.');
  if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key))
    throw new AppError(400, 'Idempotency-Key diperlukan (8–128 karakter).');
  const parsed = cancellationSchema.safeParse(input);
  if (!parsed.success) throw new AppError(400, 'Alasan pembatalan wajib diisi, maksimal 500 karakter.');
  const hash = createHash('sha256')
    .update(JSON.stringify({ equipmentCode: code, batchId, reason: parsed.data.reason }))
    .digest('hex');
  const db = getBagDb();
  const match = and(eq(batchCancellations.actorId, actor.id), eq(batchCancellations.idempotencyKey, key));
  const result = (row: typeof batchCancellations.$inferSelect, replayed: boolean) => {
    if (row.requestHash !== hash)
      throw new AppError(409, 'Idempotency-Key sudah digunakan untuk data berbeda.');
    return {
      batchId: row.batchId,
      status: 'cancelled' as const,
      cancellation: {
        reason: row.reason,
        actorId: row.actorId,
        actorName: row.actorName,
        cancelledAt: row.cancelledAt.toISOString(),
      },
      replayed,
    };
  };
  try {
    return await db.transaction(
      async (tx) => {
        const [batch] = await tx
          .select()
          .from(batches)
          .where(and(eq(batches.id, batchId), eq(batches.equipmentCode, code)))
          .for('update');
        if (!batch) throw new AppError(404, 'Batch tidak ditemukan pada equipment ini.');
        const [replayed] = await tx.select().from(batchCancellations).where(match);
        if (replayed) return result(replayed, true);
        const [cancelled] = await tx
          .select()
          .from(batchCancellations)
          .where(eq(batchCancellations.batchId, batchId));
        if (cancelled)
          throw new AppError(409, 'Record sudah dibatalkan. Muat ulang riwayat.', 'BATCH_ALREADY_CANCELLED');
        const row = {
          batchId,
          reason: parsed.data.reason,
          actorId: actor.id,
          actorName: actor.name,
          cancelledAt: new Date(),
          idempotencyKey: key,
          requestHash: hash,
        };
        await tx.insert(batchCancellations).values(row);
        await tx.insert(bagAudit).values({
          id: randomUUID(),
          batchId,
          equipmentCode: code,
          actorId: actor.id,
          actorName: actor.name,
          action: 'bag.batch_cancelled',
          details: JSON.stringify({
            count: batch.positionCount,
            wo: batch.wo,
            brand: batch.brand,
            reason: row.reason,
          }),
          createdAt: row.cancelledAt,
        });
        return result(row, false);
      },
      { isolationLevel: 'read committed' },
    );
  } catch (error) {
    if (errorCode(error) === 'ER_DUP_ENTRY') {
      const [existing] = await db.select().from(batchCancellations).where(match);
      if (existing) return result(existing, true);
    }
    throw error;
  }
}
