import mysql from 'mysql2/promise';
if (process.env.TEST_DATABASE !== '1') throw Error('Only the isolated test deployment may be reset.');
for (const [key, tables] of [
  ['BAG_MIGRATION_DATABASE_URL', ['bag_audit', 'installations', 'replacement_batches']],
  [
    'AUTH_MIGRATION_DATABASE_URL',
    ['auth_audit', 'app_grants', 'sessions', 'accounts', 'verifications', 'login_attempts', 'users'],
  ],
] as const) {
  const url = process.env[key];
  if (!url?.includes('127.0.0.1:13306/plant_')) throw Error('Refusing a non-test database.');
  const db = await mysql.createConnection(url);
  try {
    for (const table of tables) await db.query(`DELETE FROM \`${table}\``);
  } finally {
    await db.end();
  }
}
console.log('Isolated test transactions and accounts cleared; catalog and coordinates retained.');
