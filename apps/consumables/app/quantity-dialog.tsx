'use client';
import { useEffect, useState } from 'react';
import { Button, Input, Overlay } from '@plant/ui';
import {
  decimalUnits,
  decimalString,
  formatQuantity,
  localDecimal,
  validateStockQuantity,
  type MaterialSearchResult,
} from '@plant/contracts';
export function QuantityDialog({
  material,
  onClose,
  onAdd,
  consume = false,
  already = '0',
}: {
  material: MaterialSearchResult | null;
  onClose: () => void;
  onAdd: (m: MaterialSearchResult, q: string) => void;
  consume?: boolean;
  already?: string;
}) {
  const [value, setValue] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    setValue('');
    setError('');
  }, [material?.id]);
  let reserved = 0n;
  try {
    reserved = decimalUnits(localDecimal(already));
  } catch {}
  const available = material ? decimalString(decimalUnits(material.quantity) - reserved) : '0';
  return (
    <Overlay open={!!material} onClose={onClose} title="Tambah jumlah material">
      {material && (
        <form
          onInvalid={(e) => e.currentTarget.classList.add('was-submitted')}
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              const q = validateStockQuantity(localDecimal(value), material.decimalAllowed);
              if (!material.initialized || !material.inventoryActive)
                throw Error('Stok belum siap digunakan. Hubungi admin untuk saldo awal/status material.');
              if (consume && decimalUnits(q) > decimalUnits(available, true))
                throw Error('Jumlah melebihi stok tersedia setelah isi keranjang.');
              onAdd(material, q);
              onClose();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <div>
            <p className="fine">{material.mmid}</p>
            <h2>{material.commonName || material.description}</h2>
            <p className="muted">{material.description}</p>
          </div>
          <div className="stock-preview">
            <span>Stok tersedia</span>
            <strong>
              {formatQuantity(material.quantity)} {material.unit}
            </strong>
            {consume && reserved > 0n && (
              <small>
                {formatQuantity(decimalString(reserved))} {material.unit} sudah di keranjang
              </small>
            )}
          </div>
          <label>
            <span>Jumlah ({material.unit}) </span>
            <Input
              autoFocus
              required
              inputMode={material.decimalAllowed ? 'decimal' : 'numeric'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Jumlah positif"
            />
          </label>
          {!material.decimalAllowed && <small>Gunakan jumlah bulat untuk satuan {material.unit}.</small>}
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button type="button" className="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button className="primary">Tambah ke keranjang</Button>
          </div>
        </form>
      )}
    </Overlay>
  );
}
