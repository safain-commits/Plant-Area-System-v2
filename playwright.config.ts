import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
if (existsSync('.test-runtime/REAL-DATA-PRESENT.json'))
  throw Error('This preview contains real data. Browser tests require a separate test deployment.');
if (existsSync('.test-runtime/host.env')) process.loadEnvFile('.test-runtime/host.env');
if (process.env.TEST_DATABASE !== '1') throw Error('Browser tests require the isolated test deployment.');
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PUBLIC_ORIGIN,
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
