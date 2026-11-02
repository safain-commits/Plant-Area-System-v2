// Isolated smoke verification for the local plant-v2-dev runtime only.
// Never connects to VPS production or the frozen plant-v2-test archive.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium, request as playwrightRequest } from '@playwright/test';
import mysql from 'mysql2/promise';
import { equipmentCodes } from '@plant/contracts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const directory = '.deploy/dev';
const verificationDir = `${directory}/verification`;
const project = 'plant-v2-dev';
const origin = 'https://localhost:9443';
const httpOrigin = 'http://127.0.0.1:9080';
const run = promisify(execFile);

async function exists(path: string) {
  return access(path).then(
    () => true,
    () => false,
  );
}

function parseEnv(content: string): Record<string, string> {
  return Object.fromEntries(
    content
      .trim()
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const at = line.indexOf('=');
        return [line.slice(0, at), line.slice(at + 1)];
      }),
  );
}

async function docker(args: string[]) {
  return (await run('docker', args, { maxBuffer: 2_000_000, cwd: root })).stdout.trim();
}

async function verifyIsolatedRuntime() {
  if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT)
    throw new Error('Hapus override DOCKER_HOST/DOCKER_CONTEXT sebelum smoke test development.');
  const endpoint = JSON.parse(
    await docker(['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}']),
  );
  assert.ok(
    typeof endpoint === 'string' && /^(npipe:|unix:)/.test(endpoint),
    'Docker context harus menuju engine lokal perangkat.',
  );

  if (await exists(`${directory}/REAL-DATA-PRESENT.json`))
    throw new Error('Direktori development ditandai berisi data nyata; smoke test dibatalkan.');
  if (!(await exists(`${directory}/profile.json`)))
    throw new Error('Profil .deploy/dev/profile.json belum ada. Jalankan pnpm dev:setup dan pnpm dev:up.');

  const marker = JSON.parse(await readFile(`${directory}/profile.json`, 'utf8'));
  assert.equal(marker.kind, 'plant-local-development');
  assert.equal(marker.project, project);
  assert.equal(marker.origin, origin);

  const stackEnv = parseEnv(await readFile(`${directory}/stack.env`, 'utf8'));
  const hostEnv = parseEnv(await readFile(`${directory}/host.env`, 'utf8'));
  assert.equal(stackEnv.PUBLIC_ORIGIN, origin);
  assert.equal(stackEnv.RELEASE_TAG, 'dev');
  assert.equal(stackEnv.TEST_DATABASE, '0');
  assert.equal(hostEnv.PUBLIC_ORIGIN, origin);
  assert.equal(hostEnv.TEST_DATABASE, '0');
  assert.equal(hostEnv.DATA_PROFILE, 'development');

  for (const key of [
    'AUTH_DATABASE_URL',
    'BAG_DATABASE_URL',
    'CONSUMABLES_DATABASE_URL',
    'AUTH_MIGRATION_DATABASE_URL',
    'BAG_MIGRATION_DATABASE_URL',
    'CONSUMABLES_MIGRATION_DATABASE_URL',
  ]) {
    const value = hostEnv[key] || '';
    assert.ok(value.includes('@127.0.0.1:14306/plant_'), `${key} harus menuju 127.0.0.1:14306`);
    assert.ok(
      !value.includes('13306') && !value.includes('8443'),
      `${key} tidak boleh menuju port test lama`,
    );
  }

  const composeArgs = [
    'compose',
    '--env-file',
    `${directory}/stack.env`,
    '-p',
    project,
    '-f',
    'compose.yaml',
    '-f',
    `${directory}/compose.yaml`,
  ];
  await docker([...composeArgs, 'config', '--quiet']);
  const merged = JSON.parse(await docker([...composeArgs, 'config', '--format', 'json']));
  assert.equal(merged.name, project);
  assert.equal(merged.volumes?.['mysql-data']?.name, `${project}_mysql-data`);

  for (const [, service] of Object.entries(merged.services) as [
    string,
    { ports?: { host_ip?: string; published?: string }[] },
  ][]) {
    for (const port of service.ports || []) {
      assert.equal(port.host_ip, '127.0.0.1');
      assert.ok(['9080', '9443', '14306'].includes(String(port.published)));
    }
  }

  const expectedContainers = [
    ['plant-v2-dev-mysql-1', true],
    ['plant-v2-dev-auth-1', true],
    ['plant-v2-dev-portal-1', true],
    ['plant-v2-dev-bag-filter-1', true],
    ['plant-v2-dev-consumables-1', true],
    ['plant-v2-dev-nginx-1', false],
  ] as const;

  for (const [containerName, hasHealth] of expectedContainers) {
    const info = JSON.parse(
      await docker([
        'inspect',
        '--format',
        '{{json .Config.Labels}}\t{{.State.Status}}\t{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}\t{{json .HostConfig.PortBindings}}',
        containerName,
      ]).then((line) => {
        const [labels, status, health, ports] = line.split('\t');
        return JSON.stringify({
          labels: JSON.parse(labels),
          status,
          health,
          ports: JSON.parse(ports),
        });
      }),
    );
    assert.equal(info.labels['com.docker.compose.project'], project, `${containerName} project label`);
    assert.equal(info.status, 'running', `${containerName} must be running`);
    if (hasHealth) assert.equal(info.health, 'healthy', `${containerName} must be healthy`);
    for (const bindings of Object.values(info.ports || {}) as { HostIp: string; HostPort: string }[][]) {
      for (const b of bindings || []) {
        assert.equal(b.HostIp, '127.0.0.1', `${containerName} port ${b.HostPort} must bind 127.0.0.1`);
      }
    }
  }

  for (const [service, path] of [
    ['portal', '/health/ready'],
    ['auth', '/auth/health/ready'],
    ['bag-filter', '/bag-filter/health/ready'],
    ['consumables', '/consumables/health/ready'],
  ] as const) {
    await docker([
      'exec',
      `plant-v2-dev-${service}-1`,
      'node',
      '-e',
      `fetch('http://127.0.0.1:3000${path}').then(r=>{if(r.status!==200)process.exit(1)}).catch(()=>process.exit(1))`,
    ]);
  }

  for (const hmrPath of [
    '/_next/hmr',
    '/auth/_next/hmr',
    '/bag-filter/_next/hmr',
    '/consumables/_next/hmr',
  ]) {
    await new Promise<void>((resolveUpgrade, rejectUpgrade) => {
      const req = https.request(
        `${origin}${hmrPath}`,
        {
          rejectUnauthorized: false,
          headers: {
            Connection: 'Upgrade',
            Upgrade: 'websocket',
            Origin: origin,
            'Sec-WebSocket-Version': '13',
            'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
          },
        },
        (res) => {
          res.resume();
          rejectUpgrade(new Error(`Expected 101 WebSocket upgrade for ${hmrPath}, got ${res.statusCode}`));
        },
      );
      req.once('upgrade', (res, socket) => {
        socket.destroy();
        if (res.statusCode === 101) resolveUpgrade();
        else rejectUpgrade(new Error(`Unexpected upgrade status for ${hmrPath}: ${res.statusCode}`));
      });
      req.once('error', rejectUpgrade);
      req.end();
    });
  }

  return { stackEnv, hostEnv };
}

await mkdir(verificationDir, { recursive: true, mode: 0o700 });
const { stackEnv, hostEnv } = await verifyIsolatedRuntime();

const db = await mysql.createConnection({
  uri: hostEnv.BAG_MIGRATION_DATABASE_URL,
  timezone: 'Z',
});

try {
  const [eqRows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT code FROM plant_bag_filter.equipment ORDER BY FIELD(code,"561-BF1","562-BF1","421-BF1","422-BF1","L61-BF1","L62-BF1")',
  );
  assert.deepEqual(
    eqRows.map((r) => r.code),
    [...equipmentCodes],
    'Keenam equipment harus tersedia di plant_bag_filter',
  );
  const [coordRows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM plant_bag_filter.coordinates',
  );
  assert.equal(Number(coordRows[0].total), 18784, 'Harus ada 18.784 koordinat di plant_bag_filter');

  const [appRows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, status FROM plant_auth.applications ORDER BY id',
  );
  assert.equal(appRows.length, 5, 'Katalog aplikasi harus berisi 5 entri');

  const api = await playwrightRequest.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  try {
    assert.equal((await api.get('/gateway-health')).status(), 204);
    const httpRedirect = await api.get(`${httpOrigin}/bag-filter`, { maxRedirects: 0 });
    assert.equal(httpRedirect.status(), 308);
    assert.equal(httpRedirect.headers().location, `${origin}/bag-filter`);

    for (const faviconPath of ['/favicon.svg', '/bag-filter/favicon.svg', '/consumables/favicon.svg']) {
      const fav = await api.get(faviconPath, { maxRedirects: 0 });
      assert.equal(fav.status(), 200, `${faviconPath} status`);
      assert.match(fav.headers()['content-type'] || '', /image\/svg\+xml/);
    }

    for (const closed of [
      '/auth/internal/session',
      '/auth/internal/verify',
      '/consumables/internal/locations',
      '/_verify_portal',
      '/_verify_bag',
      '/_verify_consumables',
      '/health/ready',
      '/auth/health/ready',
      '/bag-filter/health/ready',
      '/consumables/health/ready',
    ]) {
      assert.equal((await api.get(closed, { maxRedirects: 0 })).status(), 404, `${closed} must be 404`);
    }

    const unauthPage = await api.get('/bag-filter/equipment/561-bf1?tab=history', { maxRedirects: 0 });
    assert.equal(unauthPage.status(), 303);
    assert.match(unauthPage.headers().location || '', /^\/auth\/login\?returnTo=/);

    for (const protectedApi of ['/bag-filter/api/equipment', '/consumables/api/inventory']) {
      const res = await api.get(protectedApi, {
        headers: {
          'x-user-role': 'admin',
          'x-user-id': 'forged',
          'x-plant-service-token': 'forged',
        },
      });
      assert.equal(res.status(), 401);
      assert.match(res.headers()['content-type'] || '', /application\/json/);
    }

    const evilOrigin = await api.post('/auth/api/sign-in/email', {
      headers: { origin: 'https://evil.test' },
      data: { email: stackEnv.BOOTSTRAP_EMAIL, password: 'invalid-password-12345' },
    });
    assert.equal(evilOrigin.status(), 403);
  } finally {
    await api.dispose();
  }

  const [users] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, email, must_change_password, position FROM plant_auth.users WHERE email = ?',
    [stackEnv.BOOTSTRAP_EMAIL],
  );
  assert.equal(users.length, 1, 'Akun bootstrap development harus ada');
  const originalPosition = String(users[0].position || 'Admin portal');
  const mustChangeInitially = Boolean(users[0].must_change_password);

  let activePassword = '';
  if (!mustChangeInitially && (await exists(`${directory}/login.env`))) {
    const loginEnv = parseEnv(await readFile(`${directory}/login.env`, 'utf8'));
    activePassword = loginEnv.DEV_PASSWORD || loginEnv.BOOTSTRAP_PASSWORD || '';
  }

  const browser = await chromium
    .launch({ headless: true })
    .catch(() => chromium.launch({ channel: 'chrome', headless: true }));
  try {
    const context = await browser.newContext({
      baseURL: origin,
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 960 },
    });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await page.waitForURL(/\/auth\/login/);
    await page.getByLabel('Email', { exact: true }).waitFor({ state: 'visible' });
    await page.screenshot({
      path: `${verificationDir}/01-login-desktop.png`,
      fullPage: true,
      caret: 'initial',
    });

    let passwordChangeVerified = false;
    if (mustChangeInitially) {
      const nextPassword = `Dev-${randomBytes(18).toString('hex')}`;
      await page.getByLabel('Email', { exact: true }).fill(stackEnv.BOOTSTRAP_EMAIL);
      await page.getByLabel('Password', { exact: true }).fill(stackEnv.BOOTSTRAP_PASSWORD);
      await page.getByRole('button', { name: /Masuk/ }).click();
      await page.waitForURL(/\/auth\/change-password/);
      await page.getByLabel('Password sementara', { exact: true }).waitFor({ state: 'visible' });
      await page.screenshot({
        path: `${verificationDir}/02-change-password.png`,
        fullPage: true,
        caret: 'initial',
      });

      await page.getByLabel('Password sementara', { exact: true }).fill(stackEnv.BOOTSTRAP_PASSWORD);
      await page.locator('input[name="newPassword"]').fill(nextPassword);
      await page.getByLabel('Ulangi password baru').fill(nextPassword);
      await page.getByRole('button', { name: 'Ganti password', exact: true }).click();
      await page.waitForURL(/\/auth\/login/);

      await writeFile(
        `${directory}/login.env`,
        `DEV_EMAIL=${stackEnv.BOOTSTRAP_EMAIL}\nDEV_PASSWORD=${nextPassword}\n`,
        { mode: 0o600 },
      );
      activePassword = nextPassword;
      passwordChangeVerified = true;
    }

    assert.ok(
      activePassword.length >= 12,
      'Password development aktif harus tersedia di .deploy/dev/login.env',
    );

    await page.getByLabel('Email', { exact: true }).fill(stackEnv.BOOTSTRAP_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(activePassword);
    await page.getByRole('button', { name: /Masuk/ }).click();
    await page.waitForURL((u) => u.pathname === '/');
    await page.getByRole('heading', { name: /Selamat datang/ }).waitFor({ state: 'visible' });
    await page.getByText('18.784').first().waitFor({ state: 'visible' });
    await page.screenshot({
      path: `${verificationDir}/03-portal-light.png`,
      fullPage: true,
      caret: 'initial',
    });

    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name.includes('session_token'));
    assert.ok(sessionCookie, 'Cookie sesi harus terpasang setelah login');
    assert.equal(sessionCookie.httpOnly, true);
    assert.equal(sessionCookie.secure, true);
    assert.equal(sessionCookie.sameSite, 'Lax');
    assert.equal(sessionCookie.path, '/');

    // Verify CSS and JS static assets for each application zone
    for (const [zonePath, prefix] of [
      ['/', '/_next/static/'],
      ['/bag-filter', '/bag-filter/_next/static/'],
      ['/consumables', '/consumables/_next/static/'],
    ] as const) {
      const res = await page.request.get(zonePath);
      assert.equal(res.status(), 200, `${zonePath} HTML status`);
      const html = await res.text();
      const urls = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
      for (const ext of ['.css', '.js']) {
        const asset = urls.find((u) => u.startsWith(prefix) && (u.endsWith(ext) || u.includes(`${ext}?`)));
        assert.ok(asset, `${zonePath} harus memuat aset ${ext} dari ${prefix}`);
        const assetRes = await page.request.get(asset);
        assert.equal(assetRes.status(), 200, `${asset} harus 200`);
        assert.doesNotMatch(assetRes.headers()['content-type'] || '', /text\/html/);
      }
    }

    // Theme switch on Portal (Light -> Dark -> Light)
    await page.getByRole('button', { name: 'Tema', exact: true }).click();
    await page.getByRole('button', { name: 'Gelap', exact: true }).click();
    await page.waitForFunction(
      () => document.documentElement.getAttribute('data-theme-preference') === 'dark',
    );
    await page.waitForTimeout(450);
    await page.screenshot({
      path: `${verificationDir}/04-portal-dark.png`,
      fullPage: true,
      caret: 'initial',
    });

    await page.getByRole('button', { name: 'Tema', exact: true }).click();
    await page.getByRole('button', { name: 'Terang', exact: true }).click();
    await page.waitForFunction(
      () => document.documentElement.getAttribute('data-theme-preference') === 'light',
    );
    await page.waitForTimeout(450);

    // Profile update & reload check
    await page.goto('/profile');
    await page.getByRole('heading', { name: 'Profil & keamanan', exact: true }).waitFor({ state: 'visible' });
    const profileRes = await page.request.post('/api/profile', {
      headers: { origin },
      data: { name: stackEnv.BOOTSTRAP_NAME || 'Developer', position: 'Developer MacBook' },
    });
    assert.equal(profileRes.status(), 200);
    await page.reload();
    assert.equal(await page.getByLabel('Jabatan').inputValue(), 'Developer MacBook');
    const meRes = await page.request.get('/auth/manage/me');
    assert.equal(meRes.status(), 200);
    await page.request.post('/api/profile', {
      headers: { origin },
      data: { name: stackEnv.BOOTSTRAP_NAME || 'Developer', position: originalPosition },
    });

    // Admin access & grants check
    await page.goto('/admin');
    await page
      .getByRole('heading', { name: 'Pengguna & hak akses', exact: true })
      .waitFor({ state: 'visible' });
    const adminUsersRes = await page.request.get('/api/admin/users');
    assert.equal(adminUsersRes.status(), 200);
    const adminAppsRes = await page.request.get('/api/admin/applications');
    assert.equal(adminAppsRes.status(), 200);
    const adminLocationsRes = await page.request.get('/api/admin/applications/consumables/locations');
    assert.equal(adminLocationsRes.status(), 200);

    // SSO to Bag Filter & check all 6 equipment maps
    await page.goto('/bag-filter');
    await page.getByRole('heading', { name: 'Bag Filter', exact: true }).waitFor({ state: 'visible' });
    await page.getByText('18.784').first().waitFor({ state: 'visible' });
    await page.screenshot({
      path: `${verificationDir}/05-bag-filter-dashboard.png`,
      fullPage: true,
      caret: 'initial',
    });

    const eqApi = await page.request.get('/bag-filter/api/equipment');
    assert.equal(eqApi.status(), 200);
    assert.deepEqual(
      (await eqApi.json()).equipment.map((e: { code: string }) => e.code),
      [...equipmentCodes],
    );
    const bagDashApi = await page.request.get('/bag-filter/api/dashboard');
    assert.equal(bagDashApi.status(), 200);
    assert.equal((await bagDashApi.json()).total, 18784);

    for (const code of equipmentCodes) {
      const slug = code.toLowerCase();
      await page.goto(`/bag-filter/equipment/${slug}`);
      const firstComp = code === '421-BF1' || code === '422-BF1' ? '1A' : '1';
      await page.getByRole('group', { name: `Detail kompartemen ${firstComp}`, exact: true }).waitFor({
        state: 'visible',
      });
      if (code === '561-BF1') {
        await page.reload();
        await page.getByRole('group', { name: `Detail kompartemen ${firstComp}`, exact: true }).waitFor({
          state: 'visible',
        });
        await page.locator('[data-sheet-trigger]:visible').click();
        await page.getByRole('combobox', { name: 'Brand/Pabrikan', exact: true }).click();
        const options = await page.getByRole('option').allTextContents();
        assert.deepEqual(options, ['Intensiv filter (Original)', 'Filtras', 'Cipta Medya', 'Other']);
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Tutup Pencatatan penggantian', exact: true }).click();
        await page.screenshot({
          path: `${verificationDir}/06-bag-map-561-bf1.png`,
          fullPage: true,
          caret: 'initial',
        });
      }
    }

    await page.goto('/bag-filter/audit');
    await page.getByRole('heading', { name: 'Jejak pencatatan', exact: true }).waitFor({ state: 'visible' });

    // SSO to Consumable Room & synthetic fixture round-trip (cleaned up afterwards)
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const locRes = await page.request.post('/consumables/api/locations', {
      headers: { origin },
      data: { name: `Smoke Rack ${suffix}` },
    });
    assert.equal(locRes.status(), 201);
    const syntheticLocationId = String((await locRes.json()).id);

    const matRes = await page.request.post('/consumables/api/materials', {
      headers: { origin },
      data: {
        mmid: `SMK-${suffix}`,
        description: 'Material uji smoke development',
        commonName: 'Smoke Filter Seal',
        unit: 'EA',
        category: 'SmokeTest',
        mrpType: 'PD',
        critical: false,
        packSize: '10',
      },
    });
    assert.equal(matRes.status(), 201);
    const syntheticMaterialId = String((await matRes.json()).id);

    const invRes = await page.request.post('/consumables/api/inventory', {
      headers: { origin },
      data: { materialId: syntheticMaterialId, locationId: syntheticLocationId, rack: 'R-01' },
    });
    assert.equal(invRes.status(), 201);

    const openRes = await page.request.post('/consumables/api/opening-balances', {
      headers: { origin, 'Idempotency-Key': `smoke-open-${randomUUID()}` },
      data: {
        materialId: syntheticMaterialId,
        locationId: syntheticLocationId,
        quantity: '15',
        reason: 'Saldo awal smoke test development',
        expectedVersion: 1,
      },
    });
    assert.equal(openRes.status(), 201);

    await page.goto('/consumables');
    await page.getByRole('heading', { name: 'Consumable Room' }).waitFor({ state: 'visible' });
    await page.getByText(`SMK-${suffix}`).first().waitFor({ state: 'visible' });
    await page.screenshot({
      path: `${verificationDir}/07-consumables-dashboard.png`,
      fullPage: true,
      caret: 'initial',
    });

    await page.goto('/consumables/stock');
    await page.getByText(`SMK-${suffix}`).first().waitFor({ state: 'visible' });
    await page.reload();
    await page.getByText(`SMK-${suffix}`).first().waitFor({ state: 'visible' });

    for (const section of ['receive', 'issue', 'materials', 'locations', 'audit']) {
      const r = await page.goto(`/consumables/${section}`);
      assert.equal(r?.status(), 200, `/consumables/${section} status`);
    }

    for (const apiPath of [
      '/consumables/api/dashboard',
      '/consumables/api/locations',
      '/consumables/api/materials',
      '/consumables/api/inventory',
      '/consumables/api/movements',
      '/consumables/api/reconciliation',
    ]) {
      const r = await page.request.get(apiPath);
      assert.equal(r.status(), 200, `${apiPath} status`);
      assert.match(r.headers()['content-type'] || '', /application\/json/);
    }

    // Mobile viewport check (390x844) across Portal, Bag Filter, and Consumables
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [mobilePath, readyText, shotName] of [
      ['/', '18.784', '08-mobile-portal.png'],
      ['/bag-filter/equipment/561-bf1', 'Detail Comp. 1', '09-mobile-bag-561.png'],
      ['/consumables', `SMK-${suffix}`, '10-mobile-consumables.png'],
    ] as const) {
      await page.goto(mobilePath);
      await page.getByText(readyText).first().waitFor({ state: 'visible' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert.equal(overflow, false, `Tidak boleh ada horizontal overflow pada mobile ${mobilePath}`);
      await page.screenshot({ path: `${verificationDir}/${shotName}`, fullPage: true, caret: 'initial' });
    }

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Keluar' }).first().click();
    await page.waitForURL(/\/auth\/login/);

    assert.equal((await page.request.get('/bag-filter/api/equipment')).status(), 401);
    assert.equal((await page.request.get('/consumables/api/inventory')).status(), 401);
    assert.deepEqual(pageErrors, [], 'Tidak boleh ada uncaught pageerror di browser');

    await context.close();
    console.log(
      JSON.stringify({
        event: 'development.smoke.passed',
        origin,
        project,
        passwordChangeVerified,
        equipmentVerified: equipmentCodes.length,
        coordinatesVerified: 18784,
        screenshotsDir: verificationDir,
      }),
    );
  } finally {
    await browser.close();
  }
} finally {
  await db.query("DELETE FROM plant_consumables.stock_idempotency WHERE request_key LIKE 'smoke-open-%'");
  await db.query("DELETE FROM plant_consumables.stock_movements WHERE mmid LIKE 'SMK-%'");
  await db.query(
    "DELETE i FROM plant_consumables.inventory i INNER JOIN plant_consumables.materials m ON m.id = i.material_id WHERE m.mmid LIKE 'SMK-%'",
  );
  await db.query("DELETE FROM plant_consumables.materials WHERE mmid LIKE 'SMK-%'");
  await db.query("DELETE FROM plant_consumables.locations WHERE name LIKE 'Smoke Rack %'");
  await db.query(
    "DELETE FROM plant_consumables.consumables_audit WHERE details LIKE '%SMK-%' OR details LIKE '%Smoke Rack%'",
  );
  await db.end();
}
