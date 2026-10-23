import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { getAuthDb, closeAuthDb, authSchema } from '@plant/auth-core';
import { equipmentCodes } from '@plant/contracts';
const { user, account, grants, audit } = authSchema;
try {
  const email = process.env.BOOTSTRAP_EMAIL?.trim().toLowerCase(),
    password = process.env.BOOTSTRAP_PASSWORD,
    name = process.env.BOOTSTRAP_NAME || 'Admin Portal';
  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !password ||
    password.length < 12 ||
    password.length > 128 ||
    name.length > 100
  )
    throw new Error('Konfigurasi akun bootstrap tidak valid.');
  const db = getAuthDb(),
    hash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM applications WHERE id='bag-filter' FOR UPDATE`);
    const [existing] = await tx.select().from(user).where(eq(user.email, email));
    if (existing) {
      if (!existing.portalAdmin) throw Error('Email bootstrap telah dipakai akun non-admin.');
      console.log('Akun bootstrap sudah ada; password dan akses tidak diubah.');
      return;
    }
    const [count] = await tx.select({ total: sql<number>`COUNT(*)` }).from(user);
    if (Number(count.total) !== 0)
      throw Error('Bootstrap hanya boleh membuat akun pada database pengguna kosong.');
    const id = randomUUID(),
      now = new Date();
    await tx.insert(user).values({
      id,
      email,
      name,
      emailVerified: true,
      position: 'Admin portal',
      active: true,
      portalAdmin: true,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(account).values({
      id: randomUUID(),
      accountId: id,
      providerId: 'credential',
      userId: id,
      password: hash,
      createdAt: now,
      updatedAt: now,
    });
    await tx
      .insert(grants)
      .values({ userId: id, appId: 'bag-filter', role: 'admin', equipment: JSON.stringify(equipmentCodes) });
    await tx
      .insert(grants)
      .values({
        userId: id,
        appId: 'consumables',
        role: 'admin',
        equipment: '[]',
        scope: JSON.stringify({ locationIds: [] }),
      });
    await tx.insert(audit).values({
      id: randomUUID(),
      actorId: id,
      actorName: name,
      action: 'bootstrap.created',
      targetId: id,
      details: '{}',
      createdAt: now,
    });
    console.log('Admin bootstrap dibuat. Password wajib diganti setelah login pertama.');
  });
} finally {
  await closeAuthDb();
}
