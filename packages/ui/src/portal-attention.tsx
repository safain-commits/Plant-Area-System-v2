'use client';
import { useEffect, useState } from 'react';
import { canConsume, type Identity, type StockDashboard } from '@plant/contracts';
import { Icon } from './icon';
type Item = { label: string; value: number; href: string };
export function PortalAttention({ identity }: { identity: Identity }) {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    const c = new AbortController();
    async function read() {
      const result: Item[] = [];
      const requests = await Promise.allSettled([
        identity.grants.some((g) => g.appId === 'bag-filter')
          ? fetch('/bag-filter/api/dashboard', { signal: c.signal, cache: 'no-store' }).then(async (r) => {
              if (!r.ok) throw Error('Ringkasan Bag Filter belum tersedia');
              const d = await r.json();
              return d.perEquipment
                .filter((e: { older1260: number }) => e.older1260 > 0)
                .map((e: { code: string; older1260: number }) => ({
                  label: `${e.code} · bag ≥ 1.260 hari`,
                  value: e.older1260,
                  href: `/bag-filter/equipment/${e.code.toLowerCase()}?age=1260`,
                }));
            })
          : Promise.resolve([]),
        canConsume(identity, 'read')
          ? fetch('/consumables/api/dashboard', { signal: c.signal, cache: 'no-store' }).then(async (r) => {
              if (!r.ok) throw Error('Ringkasan Consumable Room belum tersedia');
              const d: StockDashboard = await r.json();
              return [
                {
                  label: 'Kritis, stok nol',
                  value: d.criticalEmpty,
                  href: '/consumables/stock?availability=critical',
                },
                {
                  label: 'Material belum dihitung',
                  value: d.uncounted,
                  href: '/consumables/stock?availability=uncounted',
                },
              ].filter((v) => v.value > 0);
            })
          : Promise.resolve([]),
      ]);
      for (const r of requests) if (r.status === 'fulfilled') result.push(...r.value);
      if (!c.signal.aborted) setItems(result);
    }
    void read();
    return () => c.abort();
  }, [identity]);
  if (!items.length) return null;
  return (
    <section className="portal-attention" aria-label="Perlu perhatian">
      <h2>
        <Icon name="info" />
        Perlu perhatian
      </h2>
      <div>
        {items.map((i) => (
          <a key={i.href} href={i.href}>
            <strong>{i.value.toLocaleString('id-ID')}</strong>
            <span>{i.label}</span>
            <Icon name="chevron" />
          </a>
        ))}
      </div>
    </section>
  );
}
