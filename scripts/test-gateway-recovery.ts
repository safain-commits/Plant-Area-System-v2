import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { request, type APIRequestContext } from '@playwright/test';
import { eq } from 'drizzle-orm';
import {
  authSchema,
  changePassword,
  closeAuthDb,
  createUser,
  getAuthDb,
  setAppGrant,
  setGrant,
} from '@plant/auth-core';
import type { Identity } from '@plant/contracts';

if (process.env.TEST_DATABASE !== '1' || process.env.PUBLIC_ORIGIN !== 'https://localhost:8443')
  throw Error('Only the isolated test deployment may be used.');

const run = promisify(execFile);
const docker = async (args: string[]) => (await run('docker', args, { maxBuffer: 2_000_000 })).stdout.trim();
const compose = [
  'compose',
  '--env-file',
  '.test-runtime/stack.env',
  '-p',
  'plant-v2-test',
  '-f',
  'compose.yaml',
  '-f',
  '.test-runtime/compose.yaml',
];
const inspect = (name: string, format: string) => docker(['inspect', '--format', format, name]);
const names = ['plant-v2-test-bag-filter-1', 'plant-v2-test-consumables-1'];
const actor: Identity = {
  id: randomUUID(),
  name: 'Gateway recovery test',
  email: `gateway-${randomUUID()}@example.test`,
  position: '',
  portalAdmin: true,
  mustChangePassword: false,
  grants: [],
};

async function verifyRoutes(client: APIRequestContext) {
  for (const [path, property] of [
    ['/bag-filter/api/dashboard', 'perEquipment'],
    ['/consumables/api/dashboard', 'operational'],
  ]) {
    const r = await client.get(path, { maxRedirects: 0 });
    assert.equal(r.status(), 200, `${path} status`);
    assert.match(r.headers()['content-type'] ?? '', /application\/json/, `${path} must return JSON`);
    assert.ok(property in (await r.json()), `${path} must reach its own application`);
  }
  for (const [path, prefix] of [
    ['/', '/_next/'],
    ['/bag-filter', '/bag-filter/_next/'],
    ['/consumables', '/consumables/_next/'],
    ['/consumables/stock', '/consumables/_next/'],
  ]) {
    const r = await client.get(path, { maxRedirects: 0 });
    assert.equal(r.status(), 200, `${path} status`);
    const html = await r.text();
    assert.ok(html.includes(prefix), `${path} must render assets from its own zone`);
    const assets = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
    for (const extension of ['.css', '.js']) {
      const asset = assets.find((a) => a.startsWith(prefix + 'static/') && a.endsWith(extension));
      assert.ok(asset, `${path} must include a ${extension} asset`);
      const response = await client.get(asset);
      assert.equal(response.status(), 200, `${path} asset must load`);
      assert.doesNotMatch(response.headers()['content-type'] ?? '', /text\/html/);
    }
  }
}

let userId: string | undefined,
  stopped = false;
const sentinels: string[] = [];
const client = await request.newContext({ baseURL: process.env.PUBLIC_ORIGIN, ignoreHTTPSErrors: true });
try {
  const temporary = randomUUID(),
    password = randomUUID() + randomUUID();
  userId = (await createUser(actor, { ...actor, password: temporary })).id;
  await setGrant(actor, userId, { appId: 'bag-filter', role: 'admin', equipment: ['L61-BF1'] });
  await setAppGrant(actor, userId, 'consumables', { appId: 'consumables', role: 'admin', locationIds: [] });
  await changePassword({ ...actor, id: userId }, temporary, password);
  const login = await client.post('/auth/api/sign-in/email', {
    headers: { origin: process.env.PUBLIC_ORIGIN! },
    data: { email: actor.email, password },
  });
  assert.equal(login.status(), 200, 'Temporary application admin can sign in');
  await verifyRoutes(client);

  const gatewayStart = await inspect('plant-v2-test-nginx-1', '{{.State.StartedAt}}');
  const configuration = JSON.parse(await docker([...compose, 'config', '--format', 'json']));
  const declaredSubnets: string[] = (configuration.networks.private.ipam?.config ?? []).map(
    (c: { subnet: string }) => c.subnet,
  );
  assert.ok(
    declaredSubnets.length,
    'Run scripts/prepare-test.ts to configure an explicit test subnet before the IP recovery test.',
  );
  const previous: { name: string; network: string; ip: string; image: string }[] = [];
  for (const name of names) {
    const networks = JSON.parse(await inspect(name, '{{json .NetworkSettings.Networks}}'));
    const network = Object.keys(networks).find((n) => n.endsWith('_private'));
    assert.ok(network, 'Application must be on the isolated private network');
    const ipam: { Subnet: string }[] = JSON.parse(
      await docker(['network', 'inspect', '--format', '{{json .IPAM.Config}}', network]),
    );
    assert.ok(
      ipam.some((c) => declaredSubnets.includes(c.Subnet)),
      'Recreate the isolated test network with its configured subnet; preserve the MySQL volume.',
    );
    previous.push({
      name,
      network,
      ip: networks[network].IPAddress,
      image: await inspect(name, '{{.Config.Image}}'),
    });
  }
  stopped = true;
  // Remove only these stateless test containers so their network endpoints and
  // IP reservations are released consistently across Docker Engine versions.
  await docker([...compose, 'rm', '-s', '-f', 'bag-filter', 'consumables']);
  // Occupy both previous addresses with a different HTML service. Static DNS
  // resolution would now reproduce the reported JSON parse error / wrong page.
  for (const [i, p] of previous.entries()) {
    const sentinel = `plant-v2-test-route-sentinel-${i}`;
    sentinels.push(sentinel);
    await docker([
      'run',
      '--rm',
      '-d',
      '--name',
      sentinel,
      '--network',
      p.network,
      '--ip',
      p.ip,
      '--entrypoint',
      'node',
      p.image,
      '-e',
      "require('node:http').createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html'});r.end('<!DOCTYPE html><title>Wrong application sentinel</title>')}).listen(3000,'0.0.0.0')",
    ]);
  }
  await docker([
    ...compose,
    'up',
    '-d',
    '--no-deps',
    '--wait',
    '--wait-timeout',
    '90',
    'bag-filter',
    'consumables',
  ]);
  for (const p of previous) {
    const networks = JSON.parse(await inspect(p.name, '{{json .NetworkSettings.Networks}}'));
    assert.notEqual(
      networks[p.network].IPAddress,
      p.ip,
      'The regression must actually change each application IP',
    );
  }
  let verified = false;
  for (let i = 0; i < 20; i++) {
    try {
      await verifyRoutes(client);
      verified = true;
      break;
    } catch (e) {
      if (i === 19) throw e;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  assert.ok(verified);
  assert.equal(
    await inspect('plant-v2-test-nginx-1', '{{.State.StartedAt}}'),
    gatewayStart,
    'Routing must recover without restarting the gateway',
  );
  console.log(
    JSON.stringify({
      event: 'test.gateway_ip_recovery',
      result: 'passed',
      applications: 2,
      checks: ['authenticated dashboards', 'SSO pages', 'CSS/JS assets', 'no gateway restart'],
    }),
  );
} finally {
  try {
    for (const name of sentinels) await docker(['rm', '-f', name]).catch(() => {});
    if (stopped) await docker([...compose, 'up', '-d', '--no-deps', '--wait', 'bag-filter', 'consumables']);
  } finally {
    try {
      if (userId)
        await getAuthDb().transaction(async (tx) => {
          await tx.delete(authSchema.session).where(eq(authSchema.session.userId, userId!));
          await tx.delete(authSchema.grants).where(eq(authSchema.grants.userId, userId!));
          await tx.delete(authSchema.account).where(eq(authSchema.account.userId, userId!));
          await tx.delete(authSchema.user).where(eq(authSchema.user.id, userId!));
          await tx.delete(authSchema.audit).where(eq(authSchema.audit.actorId, actor.id));
          await tx.delete(authSchema.audit).where(eq(authSchema.audit.actorId, userId!));
        });
    } finally {
      await client.dispose();
      await closeAuthDb();
    }
  }
}
