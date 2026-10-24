// Creates an isolated, disposable test deployment. Never use its credentials in production.
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
const directory = '.test-runtime';
if (existsSync(`${directory}/REAL-DATA-PRESENT.json`))
  throw Error('This preview contains real data. Prepare tests in a separate checkout and Docker project.');
await mkdir(directory, { recursive: true });
try {
  await access(`${directory}/stack.env`);
  console.log('Test environment already exists.');
} catch {
  const root = randomBytes(24).toString('hex'),
    auth = randomBytes(24).toString('hex'),
    bag = randomBytes(24).toString('hex');
  const shared = {
    PUBLIC_ORIGIN: 'https://localhost:8443',
    SERVICE_TOKEN: randomBytes(32).toString('hex'),
    AUTH_SECRET: randomBytes(32).toString('hex'),
    BOOTSTRAP_EMAIL: 'pilot@example.test',
    BOOTSTRAP_NAME: 'Pilot Admin',
    BOOTSTRAP_PASSWORD: randomBytes(18).toString('hex'),
    MYSQL_ROOT_PASSWORD: root,
    AUTH_DB_PASSWORD: auth,
    BAG_DB_PASSWORD: bag,
    HTTP_PORT: '8080',
    HTTPS_PORT: '8443',
    RELEASE_TAG: 'test',
  };
  const render = (values: Record<string, string>) =>
    Object.entries(values)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n';
  await writeFile(`${directory}/stack.env`, render(shared));
  await writeFile(
    `${directory}/host.env`,
    render({
      ...shared,
      TEST_DATABASE: '1',
      AUTH_INTERNAL_URL: 'http://localhost:3001',
      AUTH_DATABASE_URL: `mysql://plant_auth:${auth}@127.0.0.1:13306/plant_auth`,
      BAG_DATABASE_URL: `mysql://plant_bag:${bag}@127.0.0.1:13306/plant_bag_filter`,
      AUTH_MIGRATION_DATABASE_URL: `mysql://root:${root}@127.0.0.1:13306/plant_auth`,
      BAG_MIGRATION_DATABASE_URL: `mysql://root:${root}@127.0.0.1:13306/plant_bag_filter`,
    }),
  );
  console.log('Created ignored test environment files; credentials were not printed.');
}
await writeFile(
  `${directory}/compose.yaml`,
  // The gateway recovery test occupies old application IPs with sentinel containers.
  // Docker requires an explicitly configured subnet for `docker run --ip`.
  'services:\n  mysql:\n    ports: ["127.0.0.1:13306:3306"]\n    networks: [private, test-host]\nnetworks:\n  private:\n    ipam:\n      config:\n        - subnet: ${PLANT_TEST_SUBNET:-172.30.250.0/24}\n  test-host: {}\n',
);
// Extend an existing isolated deployment without changing its users, volumes, or secrets.
const stackPath = `${directory}/stack.env`,
  hostPath = `${directory}/host.env`;
let stack = await readFile(stackPath, 'utf8'),
  host = await readFile(hostPath, 'utf8');
const secret = /^CONSUMABLES_DB_PASSWORD=(.+)$/m.exec(stack)?.[1] || randomBytes(24).toString('hex');
const rootPassword = /^MYSQL_ROOT_PASSWORD=(.+)$/m.exec(stack)![1];
if (!/^CONSUMABLES_DB_PASSWORD=/m.test(stack)) {
  stack += `CONSUMABLES_DB_PASSWORD=${secret}\n`;
  await writeFile(stackPath, stack);
}
const extra: Record<string, string> = {
  CONSUMABLES_DB_PASSWORD: secret,
  CONSUMABLES_INTERNAL_URL: 'http://localhost:3003',
  CONSUMABLES_DATABASE_URL: `mysql://plant_consumables:${secret}@127.0.0.1:13306/plant_consumables`,
  CONSUMABLES_MIGRATION_DATABASE_URL: `mysql://root:${rootPassword}@127.0.0.1:13306/plant_consumables`,
};
for (const [k, v] of Object.entries(extra)) if (!new RegExp(`^${k}=`, 'm').test(host)) host += `${k}=${v}\n`;
await writeFile(hostPath, host);
