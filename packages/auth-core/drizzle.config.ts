import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'mysql',
  schema: './packages/auth-core/src/schema.ts',
  out: './packages/auth-core/migrations',
  dbCredentials: { url: process.env.AUTH_DATABASE_URL! },
});
