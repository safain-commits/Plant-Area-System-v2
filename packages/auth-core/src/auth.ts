import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getAuthAdapterDb } from './database';
import * as schema from './schema';
let auth: ReturnType<typeof buildAuth> | undefined;
export function publicOrigin() {
  const origin = process.env.PUBLIC_ORIGIN;
  if (!origin || new URL(origin).origin !== origin)
    throw new Error('PUBLIC_ORIGIN harus berupa origin tanpa path.');
  const local =
    process.env.ALLOW_INSECURE_LOCAL_HTTP === 'true' &&
    process.env.NODE_ENV !== 'production' &&
    new URL(origin).hostname === 'localhost';
  if (!origin.startsWith('https://') && !local) throw new Error('HTTPS diwajibkan.');
  return origin;
}
function buildAuth() {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32)
    throw new Error('AUTH_SECRET minimal 32 karakter.');
  return betterAuth({
    appName: 'Plant Area System',
    secret: process.env.AUTH_SECRET,
    baseURL: publicOrigin(),
    basePath: '/auth/api',
    database: drizzleAdapter(getAuthAdapterDb(), { provider: 'mysql', schema, transaction: true }),
    trustedOrigins: [publicOrigin()],
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128 },
    session: { expiresIn: 8 * 60 * 60, disableSessionRefresh: true, cookieCache: { enabled: false } },
    user: {
      additionalFields: {
        position: { type: 'string', required: false, defaultValue: '', input: false },
        active: { type: 'boolean', defaultValue: true, input: false },
        portalAdmin: { type: 'boolean', defaultValue: false, input: false },
        mustChangePassword: { type: 'boolean', defaultValue: true, input: false },
      },
    },
    advanced: {
      useSecureCookies: publicOrigin().startsWith('https://'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
    },
    rateLimit: { enabled: false }, // The gateway uses a transactional account/IP limiter in this service.
    telemetry: { enabled: false },
    logger: {
      log: (level) => {
        console.error(JSON.stringify({ level, event: 'auth.library' }));
      },
    },
  });
}
export function getAuth() {
  return (auth ??= buildAuth());
}
