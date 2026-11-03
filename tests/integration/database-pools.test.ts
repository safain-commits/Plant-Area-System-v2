import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

if (process.env.TEST_DATABASE !== '1')
  throw Error('Pool reload verification requires an isolated test database.');
for (const key of ['AUTH_DATABASE_URL', 'BAG_DATABASE_URL', 'CONSUMABLES_DATABASE_URL']) {
  const url = new URL(process.env[key] || '');
  if (!['localhost', '127.0.0.1', 'mysql'].includes(url.hostname))
    throw Error('Pool verification requires a local test database host.');
}

test('development reloads share bounded pools, preserve the separate Auth adapter and close cleanly', async () => {
  const previous = process.env.NODE_ENV;
  Reflect.set(process.env, 'NODE_ENV', 'development');
  try {
    for (const spec of [
      { name: 'auth-core', getters: ['getAuthDb', 'getAuthAdapterDb'], close: 'closeAuthDb' },
      { name: 'bag-core', getters: ['getBagDb'], close: 'closeBagDb' },
      { name: 'consumables-core', getters: ['getConsumablesDb'], close: 'closeConsumablesDb' },
    ]) {
      const modules = [];
      const ids = spec.getters.map(() => new Set<number>());
      const wrappers = spec.getters.map(() => new Set<unknown>());
      try {
        for (let reload = 0; reload < 12; reload++) {
          const url = new URL(`../../packages/${spec.name}/src/database.ts`, import.meta.url);
          url.searchParams.set('reload', randomUUID());
          const module = await import(url.href);
          if (modules.length) assert.notStrictEqual(module, modules[0], 'Must actually reload the module');
          modules.push(module);
          for (const [index, getter] of spec.getters.entries()) {
            const db = module[getter]();
            wrappers[index].add(db);
            const [rows] = await db.execute('SELECT CONNECTION_ID() AS connectionId');
            ids[index].add(Number(rows[0].connectionId));
          }
        }
        for (const [index, getter] of spec.getters.entries()) {
          assert.equal(wrappers[index].size, 12, `${getter}: wrappers must follow the reloaded schema`);
          assert.equal(ids[index].size, 1, `${getter}: reloads must reuse the existing socket pool`);
        }
        if (ids.length === 2)
          assert.notEqual([...ids[0]][0], [...ids[1]][0], 'Auth management and adapter pools stay separate');
        await modules.at(-1)![spec.close]();
        const freshUrl = new URL(`../../packages/${spec.name}/src/database.ts`, import.meta.url);
        freshUrl.searchParams.set('reload', randomUUID());
        const fresh = await import(freshUrl.href);
        modules.push(fresh);
        for (const [index, getter] of spec.getters.entries()) {
          const [rows] = await fresh[getter]().execute('SELECT CONNECTION_ID() AS connectionId');
          assert.ok(!ids[index].has(Number(rows[0].connectionId)), 'Closing must evict the cached pool');
        }
      } finally {
        await Promise.allSettled(modules.map((module) => module[spec.close]()));
      }
    }
  } finally {
    if (previous === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
    else Reflect.set(process.env, 'NODE_ENV', previous);
  }
});
