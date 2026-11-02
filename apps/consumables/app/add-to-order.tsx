'use client';
import { useState } from 'react';
import { Button, Toast, cartKey, readCart, writeCart } from '@plant/ui';
import {
  canConsume,
  decimalUnits,
  decimalString,
  localDecimal,
  type Identity,
  type InventoryItem,
} from '@plant/contracts';
import { QuantityDialog } from './quantity-dialog';
export function AddToOrder({ identity, item }: { identity: Identity; item: InventoryItem }) {
  const [type, setType] = useState<'consume' | 'return' | null>(null),
    [notice, setNotice] = useState(''),
    [link, setLink] = useState('');
  const ready = item.initialized && item.inventoryActive && item.active;
  const existing = type
    ? readCart(cartKey(identity.id, type)).lines.find((l) => l.material.id === item.id)?.quantity || '0'
    : '0';
  return (
    <>
      <div className="form-actions">
        {canConsume(identity, 'issue') && (
          <Button
            type="button"
            className="primary small"
            disabled={!ready || decimalUnits(item.quantity) === 0n}
            onClick={() => setType('consume')}
          >
            Tambah ke Consume Order
          </Button>
        )}
        {canConsume(identity, 'return') && (
          <Button
            type="button"
            className="secondary small"
            disabled={!ready}
            onClick={() => setType('return')}
          >
            Tambah ke Return Order
          </Button>
        )}
      </div>
      {link && (
        <p className="notice">
          {notice} <a href={link}>Buka keranjang</a>
        </p>
      )}
      <QuantityDialog
        material={type ? item : null}
        onClose={() => setType(null)}
        consume={type === 'consume'}
        already={existing}
        onAdd={(m, q) => {
          const key = cartKey(identity.id, type!),
            draft = readCart(key),
            line = draft.lines.find((l) => l.material.id === m.id);
          if (!line && draft.lines.length >= 50) throw Error('Maksimal 50 material per order.');
          const sum = decimalString(
            decimalUnits(localDecimal(line?.quantity || '0')) + decimalUnits(q),
          ).replace(/\.?0+$/, '');
          writeCart(key, {
            ...draft,
            lines: line
              ? draft.lines.map((l) => (l.material.id === m.id ? { material: m, quantity: sum } : l))
              : [...draft.lines, { material: m, quantity: sum }],
          });
          setNotice(`${m.commonName || m.description} ditambahkan.`);
          setLink(`/consumables/${type}`);
        }}
      />
    </>
  );
}
