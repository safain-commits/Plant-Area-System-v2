import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'mysql',
  schema: './packages/bag-core/src/schema.ts',
  out: './packages/bag-core/migrations',
  dbCredentials: { url: process.env.BAG_DATABASE_URL! },
});
