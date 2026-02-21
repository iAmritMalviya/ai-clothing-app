import type { Knex } from 'knex';

export async function getUserById(db: Knex, userId: string) {
  return db('users').where({ id: userId }).first();
}

export async function updateUser(
  db: Knex,
  userId: string,
  updates: { name?: string; shop_name?: string },
) {
  const [updated] = await db('users')
    .where({ id: userId })
    .update({ ...updates, updated_at: db.fn.now() })
    .returning('*');
  return updated;
}
