'use client';
import { useEffect, useRef, useState } from 'react';
import {
  formatDate,
  positionLabel,
  type BatchCancellation,
  type BatchStatus,
  type Equipment,
  type Position,
} from '@plant/contracts';
import { Button, Overlay, Textarea } from '@plant/ui';

export type BatchRecord = {
  id: string;
  installedAt: string;
  createdAt: string;
  reason: string;
  wo: string;
  brand: string | null;
  actorName: string;
  positionCount: number;
  positions: Position[];
  status: BatchStatus;
  cancellation: BatchCancellation | null;
};
export function CancellationNotice({ cancellation }: { cancellation: BatchCancellation }) {
  return (
    <div className="cancellation-notice">
      <span className="badge cancellation-badge">Dibatalkan</span>
      <small>{cancellation.reason}</small>
      <small>
        {cancellation.actorName} · dibatalkan {formatDate(cancellation.cancelledAt)} WIB
      </small>
    </div>
  );
}
export function BatchCancellationDialog({
  batch,
  equipment,
  anchor,
  onClose,
  onCancelled,
  onConflict,
}: {
  batch: BatchRecord | null;
  equipment: Equipment;
  anchor: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onCancelled: (batchId: string, cancellation: BatchCancellation) => void;
  onConflict: () => void;
}) {
  const [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const retry = useRef<{ payload: string; key: string } | null>(null);
  const pending = useRef(false);
  useEffect(() => {
    setReason('');
    setError('');
  }, [batch?.id]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!batch || pending.current || !reason.trim()) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const payload = JSON.stringify({ reason: reason.trim() });
    const fingerprint = `${batch.id}:${payload}`;
    if (retry.current?.payload !== fingerprint)
      retry.current = { payload: fingerprint, key: crypto.randomUUID() };
    try {
      const response = await fetch(
        `/bag-filter/api/equipment/${equipment.code}/batches/${encodeURIComponent(batch.id)}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': retry.current.key },
          body: payload,
          signal: AbortSignal.timeout(15000),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        if (data.code === 'BATCH_ALREADY_CANCELLED') onConflict();
        throw Error(data.error || 'Record belum dapat dibatalkan.');
      }
      retry.current = null;
      onCancelled(data.batchId, data.cancellation);
    } catch (err) {
      setError(
        err instanceof Error && err.name !== 'TimeoutError' && err.name !== 'TypeError'
          ? err.message
          : 'Koneksi terputus atau waktu tunggu habis. Coba kembali dengan alasan yang sama; pembatalan tidak digandakan.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Overlay
      open={!!batch}
      onClose={() => {
        if (!pending.current) onClose();
      }}
      title="Batalkan record"
      kind="dialog"
      anchor={anchor}
      className="batch-cancellation-dialog"
    >
      {batch && (
        <form className="form-stack cancellation-form" onSubmit={submit}>
          <p className="fine cancellation-explanation">
            Seluruh batch dibatalkan. Kondisi bag dihitung kembali dari pemasangan yang masih sah. Record dan
            jejak audit tetap disimpan.
          </p>
          <dl className="cancellation-summary">
            <div>
              <dt>Equipment</dt>
              <dd>{equipment.code}</dd>
            </div>
            <div>
              <dt>Jumlah</dt>
              <dd>{batch.positionCount} bag</dd>
            </div>
            <div>
              <dt>Pemasangan</dt>
              <dd>{formatDate(batch.installedAt)} WIB</dd>
            </div>
            <div>
              <dt>Brand/Pabrikan</dt>
              <dd>{batch.brand || 'Belum tercatat'}</dd>
            </div>
            <div>
              <dt>WO</dt>
              <dd>{batch.wo || 'Tanpa WO'}</dd>
            </div>
            <div>
              <dt>Pencatat</dt>
              <dd>
                {batch.actorName} · {formatDate(batch.createdAt)} WIB
              </dd>
            </div>
          </dl>
          <p className="fine cancellation-coordinates">
            {batch.positions
              .slice(0, 12)
              .map((p) => positionLabel(p, equipment))
              .join(' · ')}
            {batch.positions.length > 12 ? ` · +${batch.positions.length - 12} koordinat lainnya` : ''}
          </p>
          <label>
            Alasan pembatalan
            <Textarea
              autoFocus
              required
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
              placeholder="Contoh: salah memilih equipment, seharusnya 422-BF1"
            />
          </label>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <div className="cancellation-actions">
            <button type="button" className="secondary" disabled={busy} onClick={onClose}>
              Kembali
            </button>
            <Button className="danger" busy={busy} disabled={!reason.trim()}>
              Batalkan record
            </Button>
          </div>
        </form>
      )}
    </Overlay>
  );
}
