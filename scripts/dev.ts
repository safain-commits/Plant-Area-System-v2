// Local-only development runtime. Never uses the frozen .test-runtime deployment.
import { randomBytes } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { access, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const directory = '.deploy/dev';
const project = 'plant-v2-dev';
const origin = 'https://localhost:9443';
const apps = ['auth', 'portal', 'bag-filter', 'consumables'];
const cores = ['auth-core', 'bag-core', 'consumables-core', 'contracts', 'server', 'ui'];
const run = promisify(execFile);
const command = process.argv[2] || 'status';
async function exists(path: string) {
  return access(path).then(
    () => true,
    () => false,
  );
}
async function docker(args: string[]) {
  return run('docker', args, { maxBuffer: 1_000_000, cwd: root });
}
async function localEngine() {
  const endpoint = JSON.parse(
    (await docker(['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}'])).stdout,
  );
  if (typeof endpoint !== 'string' || !/^(npipe:|unix:)/.test(endpoint))
    throw Error('Gunakan Docker context lokal melalui named pipe/unix socket; remote engine ditolak.');
  if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT)
    throw Error('Hapus override DOCKER_HOST/DOCKER_CONTEXT agar target context dapat diperiksa.');
}
function compose(args: string[]) {
  return [
    'compose',
    '--env-file',
    `${directory}/stack.env`,
    '-p',
    project,
    '-f',
    'compose.yaml',
    '-f',
    `${directory}/compose.yaml`,
    ...args,
  ];
}
async function execute(args: string[]) {
  // Logs are intentionally kept to normal process output; no interpolated config/env is printed.
  await new Promise<void>((resolve, reject) => {
    const child = spawn('docker', args, { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', (code) => (code === 0 ? resolve() : reject(Error('Perintah Docker gagal.'))));
  });
}
async function profile() {
  const marker = JSON.parse(await readFile(`${directory}/profile.json`, 'utf8'));
  if (marker.kind !== 'plant-local-development' || marker.project !== project || marker.origin !== origin)
    throw Error('Profil development tidak sesuai; tidak akan menyentuh deployment existing.');
  if (await exists(`${directory}/REAL-DATA-PRESENT.json`))
    throw Error('Development ini ditandai berisi data nyata.');
  const values = Object.fromEntries(
    (await readFile(`${directory}/stack.env`, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const at = line.indexOf('=');
        return [line.slice(0, at), line.slice(at + 1)];
      }),
  );
  if (values.PUBLIC_ORIGIN !== origin || values.RELEASE_TAG !== 'dev' || values.TEST_DATABASE !== '0')
    throw Error('Environment development tidak sesuai profil.');
  for (const key of [
    'MYSQL_ROOT_PASSWORD',
    'AUTH_DB_PASSWORD',
    'BAG_DB_PASSWORD',
    'CONSUMABLES_DB_PASSWORD',
    'AUTH_SECRET',
    'SERVICE_TOKEN',
  ])
    if (!/^[a-f0-9]{64}$/.test(values[key] || '')) throw Error('Credential development tidak valid.');
  return values;
}
async function verifyConfig() {
  await profile();
  const config = JSON.parse((await docker(compose(['config', '--format', 'json']))).stdout);
  if (config.name !== project || config.volumes?.['mysql-data']?.name !== `${project}_mysql-data`)
    throw Error('Namespace/volume development tidak sesuai.');
  for (const [name, service] of Object.entries(config.services) as [
    string,
    {
      ports?: { host_ip?: string; published?: string }[];
      volumes?: { type: string; source: string; target: string }[];
    },
  ][]) {
    for (const port of service.ports || []) {
      if (port.host_ip !== '127.0.0.1' || !['9080', '9443', '14306'].includes(String(port.published)))
        throw Error('Port development tidak terbatas pada loopback yang disetujui.');
    }
    for (const mount of service.volumes || []) {
      if (mount.source.includes('.test-runtime') || mount.source.includes('plant-v2-test'))
        throw Error('Mount sumber migrasi ditolak.');
      if (name === 'mysql' && mount.type === 'volume' && mount.source !== 'mysql-data')
        throw Error('Volume database tidak sesuai.');
    }
  }
}
async function setup() {
  await localEngine();
  if (!(await exists(`${directory}/profile.json`))) {
    if (await exists(directory)) throw Error('Direktori development tanpa profil ditemukan; periksa manual.');
    const existing = (
      await docker([
        'ps',
        '-a',
        '--filter',
        `label=com.docker.compose.project=${project}`,
        '--format',
        '{{.ID}}',
      ])
    ).stdout.trim();
    const volume = (
      await docker(['volume', 'ls', '--filter', `name=^${project}_mysql-data$`, '--format', '{{.Name}}'])
    ).stdout.trim();
    if (existing || volume)
      throw Error('Resource development sudah ada tanpa konfigurasi; tidak akan diambil alih.');
    await mkdir(`${directory}/certs`, { recursive: true, mode: 0o700 });
    const values: Record<string, string> = {
      PUBLIC_ORIGIN: origin,
      RELEASE_TAG: 'dev',
      HTTP_PORT: '9080',
      HTTPS_PORT: '9443',
      TEST_DATABASE: '0',
      DATA_PROFILE: 'development',
      BOOTSTRAP_EMAIL: 'developer@example.test',
      BOOTSTRAP_NAME: 'Developer',
      BOOTSTRAP_PASSWORD: randomBytes(24).toString('hex'),
    };
    for (const key of [
      'MYSQL_ROOT_PASSWORD',
      'AUTH_DB_PASSWORD',
      'BAG_DB_PASSWORD',
      'CONSUMABLES_DB_PASSWORD',
      'AUTH_SECRET',
      'SERVICE_TOKEN',
    ])
      values[key] = randomBytes(32).toString('hex');
    const render = (data: Record<string, string>) =>
      Object.entries(data)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n') + '\n';
    await writeFile(`${directory}/stack.env`, render(values), { flag: 'wx', mode: 0o600 });
    const host = {
      ...values,
      AUTH_INTERNAL_URL: 'http://localhost:3001',
    };
    for (const [key, database, user, password] of [
      ['AUTH', 'plant_auth', 'plant_auth', values.AUTH_DB_PASSWORD],
      ['BAG', 'plant_bag_filter', 'plant_bag', values.BAG_DB_PASSWORD],
      ['CONSUMABLES', 'plant_consumables', 'plant_consumables', values.CONSUMABLES_DB_PASSWORD],
    ]) {
      Object.assign(host, {
        [`${key}_DATABASE_URL`]: `mysql://${user}:${password}@127.0.0.1:14306/${database}`,
        [`${key}_MIGRATION_DATABASE_URL`]: `mysql://root:${values.MYSQL_ROOT_PASSWORD}@127.0.0.1:14306/${database}`,
      });
    }
    await writeFile(`${directory}/host.env`, render(host), { flag: 'wx', mode: 0o600 });
    await writeFile(
      `${directory}/profile.json`,
      JSON.stringify({ kind: 'plant-local-development', project, origin }, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
  }
  await profile();
  // These generated files derive from production routing; only dev-specific behavior differs.
  let template = await readFile('infra/nginx/default.conf.template', 'utf8');
  template = "map $http_upgrade $dev_connection_upgrade { default upgrade; '' ''; }\n" + template;
  template = template
    .replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'unsafe-eval'")
    .replace("connect-src 'self'", "connect-src 'self' wss://localhost:9443")
    .replace(/^.*add_header Strict-Transport-Security.*\r?\n/m, '');
  await writeFile(`${directory}/default.conf.template`, template, { mode: 0o600 });
  const proxy = (await readFile('infra/nginx/proxy.conf', 'utf8'))
    .replace(
      'proxy_set_header Connection "";',
      'proxy_set_header Upgrade $http_upgrade;\nproxy_set_header Connection $dev_connection_upgrade;',
    )
    .replace('proxy_read_timeout 30s;', 'proxy_read_timeout 120s;');
  await writeFile(`${directory}/proxy.conf`, proxy, { mode: 0o600 });
  const common = cores
    .map((core) => `      - ./packages/${core}/src:/workspace/packages/${core}/src:ro`)
    .join('\n');
  const services = apps
    .map(
      (app) => `  ${app}:
    image: plant-tools:dev
    working_dir: /workspace/apps/${app}
    command: [exec, next, dev, --webpack, --hostname, 0.0.0.0, --port, '3000']
    environment:
      NODE_ENV: development
      WATCHPACK_POLLING: 'true'
      NEXT_TELEMETRY_DISABLED: '1'
    healthcheck:
      start_period: 90s
    volumes:
      - ./apps/${app}/app:/workspace/apps/${app}/app:ro
      - ./apps/${app}/public:/workspace/apps/${app}/public:ro
      - ./apps/${app}/next.config.ts:/workspace/apps/${app}/next.config.ts:ro
${common}
`,
    )
    .join('');
  const override = `# Generated by scripts/dev.ts; credential files are preserved on setup rerun.
services:
  mysql:
    ports: !override ['127.0.0.1:14306:3306']
    networks: [private, dev-host]
${services}  nginx:
    ports: !override ['127.0.0.1:9080:80', '127.0.0.1:9443:443']
    volumes:
      - ./.deploy/dev/default.conf.template:/etc/nginx/templates/default.conf.template:ro
      - ./.deploy/dev/proxy.conf:/etc/nginx/plant-proxy.conf:ro
      - ./.deploy/dev/certs:/etc/nginx/certs:ro
networks:
  dev-host: {}
`;
  await writeFile(`${directory}/compose.yaml`, override, { mode: 0o600 });
  await chmod('infra/mysql/init.sh', 0o755);
  await chmod('infra/mysql/backup.sh', 0o755);
  const key = await exists(`${directory}/certs/tls.key`),
    cert = await exists(`${directory}/certs/tls.crt`);
  if (key !== cert) throw Error('Pasangan certificate development tidak lengkap; tidak ditimpa.');
  if (!key)
    await execute([
      'run',
      '--rm',
      '--network',
      'none',
      '--mount',
      `type=bind,source=${resolve(directory, 'certs')},target=/certs`,
      '--entrypoint',
      'openssl',
      'mysql:8.4',
      'req',
      '-x509',
      '-newkey',
      'rsa:3072',
      '-nodes',
      '-days',
      '365',
      '-keyout',
      '/certs/tls.key',
      '-out',
      '/certs/tls.crt',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ]);
  await verifyConfig();
  const loginFile = (await exists(`${directory}/login.env`))
    ? `${directory}/login.env`
    : `${directory}/stack.env`;
  if (!(await exists(`${directory}/DEV-HANDOVER.md`)))
    await writeFile(
      `${directory}/DEV-HANDOVER.md`,
      `# Development lokal\n\nURL: ${origin}\nProject: ${project}\nDatabase: volume ${project}_mysql-data, host port loopback 14306.\nEmail: developer@example.test\nKredensial: ${loginFile} (privat). File login.env menyimpan password development setelah uji awal; stack.env berisi password bootstrap sebelum diganti. Jika Anda mengganti password lagi, gunakan password terakhir Anda.\n\nPerintah: pnpm dev:up / dev:down / dev:status / dev:logs / dev:smoke.\nHot reload: source apps/*/app dan packages/*/src. Perubahan dependency atau migrasi memerlukan dev:up agar image tools dibangun lagi.\nSertifikat localhost self-signed; belum dipasang ke trust OS/browser.\nData development terpisah dari VPS dan arsip sumber. Suite test existing tetap memakai deployment uji khusus, bukan database ini.\n`,
      { mode: 0o600 },
    );
  console.log(
    JSON.stringify({
      event: 'development.prepared',
      origin,
      project,
      credentials: loginFile,
      certificateTrusted: false,
    }),
  );
}
try {
  if (!['setup', 'up', 'down', 'status', 'logs'].includes(command))
    throw Error('Gunakan setup/up/down/status/logs.');
  if (command === 'setup' || command === 'up') await setup();
  else {
    await localEngine();
    await verifyConfig();
  }
  if (command === 'up') {
    await execute(compose(['build', 'migrate']));
    await execute(compose(['up', '-d', '--no-deps', '--wait', '--wait-timeout', '180', 'mysql']));
    await execute(
      compose([
        'up',
        '--no-deps',
        '--no-build',
        '--force-recreate',
        '--exit-code-from',
        'migrate',
        'migrate',
      ]),
    );
    await execute(compose(['--profile', 'setup', 'run', '--rm', '--no-deps', 'bootstrap']));
    for (const app of apps)
      await execute(compose(['up', '-d', '--no-deps', '--no-build', '--wait', '--wait-timeout', '240', app]));
    await execute(compose(['up', '-d', '--no-deps', '--no-build', 'nginx']));
    await execute(compose(['exec', '-T', 'nginx', 'nginx', '-t']));
    console.log(JSON.stringify({ event: 'development.started', origin }));
  } else if (command === 'down') await execute(compose(['down']));
  else if (command === 'status') await execute(compose(['ps', '-a']));
  else if (command === 'logs') await execute(compose(['logs', '--tail=80', ...apps, 'nginx']));
} catch (error) {
  // Never expose child-process diagnostics that could embed an interpolated environment.
  console.error(
    JSON.stringify({
      event: 'development.failed',
      message:
        error instanceof Error && !('cmd' in error)
          ? error.message
          : 'Perintah gagal; periksa status development tanpa mencetak environment.',
    }),
  );
  process.exitCode = 1;
}
