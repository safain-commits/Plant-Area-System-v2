// Creates an isolated, disposable test deployment. Never use its credentials in production.
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
const directory = '.test-runtime';
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
  'services:\n  mysql:\n    ports: ["127.0.0.1:13306:3306"]\n    networks: [private, test-host]\nnetworks:\n  test-host: {}\n',
);
