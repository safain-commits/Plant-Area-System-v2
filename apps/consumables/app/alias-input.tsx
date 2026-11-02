'use client';
import { useState } from 'react';
import { Input } from '@plant/ui';
export function AliasInput({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial),
    parts = value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  return (
    <label className="r22-span-all">
      Alias / kata kunci
      <Input
        name="aliases"
        maxLength={500}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Contoh: baut, mur, fastener"
      />
      <small>Pisahkan dengan koma. Maksimal 10 alias, masing-masing 40 karakter.</small>
      <span className="r22-alias-chips">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            <button
              type="button"
              aria-label={`Hapus alias ${part}`}
              onClick={() => setValue(parts.filter((_, j) => j !== i).join(', '))}
            >
              ×
            </button>
          </span>
        ))}
      </span>
    </label>
  );
}
