import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  boolean,
  int,
  primaryKey,
  index,
} from 'drizzle-orm/mysql-core';
export const dataMigrations = mysqlTable('data_migrations', {
  id: varchar('id', { length: 100 }).primaryKey(),
  completedAt: timestamp('completed_at', { fsp: 3 }).notNull(),
});

export const user = mysqlTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 254 }).notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { fsp: 3 }).notNull(),
  updatedAt: timestamp('updated_at', { fsp: 3 }).notNull(),
  position: varchar('position', { length: 100 }).notNull().default(''),
  active: boolean('active').notNull().default(true),
  portalAdmin: boolean('portal_admin').notNull().default(false),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
});
export const session = mysqlTable(
  'sessions',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => user.id),
    expiresAt: timestamp('expires_at', { fsp: 3 }).notNull(),
    createdAt: timestamp('created_at', { fsp: 3 }).notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);
export const account = mysqlTable(
  'accounts',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    accountId: varchar('account_id', { length: 255 }).notNull(),
    providerId: varchar('provider_id', { length: 255 }).notNull(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => user.id),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { fsp: 3 }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { fsp: 3 }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { fsp: 3 }).notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).notNull(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
);
export const verification = mysqlTable('verifications', {
  id: varchar('id', { length: 36 }).primaryKey(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { fsp: 3 }).notNull(),
  createdAt: timestamp('created_at', { fsp: 3 }).notNull(),
  updatedAt: timestamp('updated_at', { fsp: 3 }).notNull(),
});
export const applications = mysqlTable('applications', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  status: varchar('status', { length: 16 }).notNull(),
  path: varchar('path', { length: 100 }),
});
export const grants = mysqlTable(
  'app_grants',
  {
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => user.id),
    appId: varchar('app_id', { length: 64 })
      .notNull()
      .references(() => applications.id),
    role: varchar('role', { length: 16 }).notNull(),
    equipment: text('equipment').notNull(),
    scope: text('scope'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.appId] })],
);
export const audit = mysqlTable(
  'auth_audit',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    actorId: varchar('actor_id', { length: 36 }).notNull(),
    actorName: varchar('actor_name', { length: 100 }).notNull(),
    action: varchar('action', { length: 64 }).notNull(),
    targetId: varchar('target_id', { length: 100 }).notNull(),
    details: text('details').notNull(),
    createdAt: timestamp('created_at', { fsp: 3 }).notNull(),
  },
  (t) => [index('auth_audit_time_idx').on(t.createdAt, t.id)],
);
export const loginAttempts = mysqlTable('login_attempts', {
  key: varchar('attempt_key', { length: 64 }).primaryKey(),
  attempts: int('attempts').notNull(),
  resetAt: timestamp('reset_at', { fsp: 3 }).notNull(),
});
