import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './packages/consumables-core/src/schema.ts',
  out: './packages/consumables-core/migrations',
  dialect: 'mysql',
  dbCredentials: { url: process.env.CONSUMABLES_MIGRATION_DATABASE_URL || '' },
});
