// Synthetic screenshots only; this script deliberately refuses persistent deployments.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { chromium, request } from '@playwright/test';
import {
  createUser,
  updateUserAccess,
  setGrant,
  setAppGrant,
  changePassword,
  closeAuthDb,
} from '@plant/auth-core';
import { equipmentCodes, type Identity } from '@plant/contracts';
if (
  process.env.TEST_DATABASE !== '1' ||
  process.env.PUBLIC_ORIGIN !== 'https://localhost:8443' ||
  existsSync('.test-runtime/REAL-DATA-PRESENT.json')
)
  throw Error('Requires isolated synthetic test deployment.');
const stage = process.argv[2];
if (!['before', 'after'].includes(stage)) throw Error('Specify before or after.');
const baseURL = process.env.PUBLIC_ORIGIN;
const statePath = '.test-runtime/ui-audit-account.json';
let account: { id: string; email: string; password: string };
if (existsSync(statePath)) account = JSON.parse(await readFile(statePath, 'utf8'));
else {
  const email = `ui-audit-${randomUUID()}@example.test`,
    temporary = randomUUID(),
    password = randomUUID() + randomUUID();
  const actor: Identity = {
    id: randomUUID(),
    email,
    name: 'Operator Uji',
    position: '',
    portalAdmin: true,
    mustChangePassword: false,
    grants: [],
  };
  const { id } = await createUser(actor, { name: actor.name, email, password: temporary });
  await updateUserAccess(actor, id, { active: true, portalAdmin: true });
  await setGrant(actor, id, { appId: 'bag-filter', role: 'admin', equipment: [...equipmentCodes] });
  await setAppGrant(actor, id, 'consumables', { appId: 'consumables', role: 'admin' });
  await changePassword({ ...actor, id }, temporary, password);
  account = { id, email, password };
  await writeFile(statePath, JSON.stringify(account), { mode: 0o600 });
}
await closeAuthDb();
const client = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
async function save(path: string, data: unknown) {
  const r = await client.post(path, { data, headers: { origin: baseURL!, 'Idempotency-Key': randomUUID() } });
  if (!r.ok()) throw Error(`${path}: ${r.status()} ${await r.text()}`);
  return r.json();
}
await save('/auth/api/sign-in/email', { email: account.email, password: account.password });
if (!existsSync('.test-runtime/ui-audit-seeded')) {
  for (let i = 0; i < 3; i++) {
    const m = await save('/consumables/api/materials', {
      mmid: `AUDIT-SYNTHETIC-${i}`,
      description: [
        'Baut hexagonal M16 untuk perawatan equipment',
        'Sarung tangan kerja ukuran L',
        'Pelumas mesin industri',
      ][i],
      commonName: ['Baut M16', 'Sarung tangan', 'Pelumas'][i],
      unit: 'PCS',
      sapUnit: 'PCS',
      category: 'Uji visual',
      decimalAllowed: false,
      critical: i === 1,
    });
    await save('/consumables/api/inventory', { materialId: m.id, rack: `A-${i + 1}` });
    if (i < 2)
      await save('/consumables/api/opening-balances', {
        materialId: m.id,
        quantity: i ? '0' : '120',
        reason: 'Data sintetis audit UI',
        expectedVersion: 1,
      });
  }
  await writeFile('.test-runtime/ui-audit-seeded', 'synthetic');
}
const browser = await chromium.launch();
const paths = [
  '/',
  '/consumables',
  '/consumables/stock',
  '/consumables/consume',
  '/consumables/picklist',
  '/consumables/history',
  '/bag-filter',
  '/auth/login',
];
const folder = `docs/testing/ui-audit-2026-11/${stage}`;
await mkdir(folder, { recursive: true });
for (const theme of ['light', 'dark'] as const) {
  const context = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: true,
    storageState: await client.storageState(),
    reducedMotion: 'reduce',
  });
  await context.addInitScript((t) => localStorage.setItem('plant-ui-theme', t), theme);
  const page = await context.newPage();
  for (const width of [375, 768, 1280, 1536]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(path);
      await page.locator('h1').first().waitFor();
      await page.waitForLoadState('networkidle');
      await page.screenshot({
        path: `${folder}/${path === '/' ? 'portal' : path.slice(1).replaceAll('/', '-')}-${width}-${theme}.png`,
        fullPage: true,
      });
    }
    console.log(`${stage}: ${theme} ${width}px captured`);
  }
  await context.close();
}
await browser.close();
await client.dispose();
