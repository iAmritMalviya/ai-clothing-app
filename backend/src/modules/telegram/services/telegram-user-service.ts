import type { Knex } from 'knex';

/**
 * Find or create a user by their Telegram ID.
 * Uses synthetic phone `tg_{telegramId}` to avoid collision with real phones
 * (real phones get +91 prefix via auth normalization).
 */
export async function findOrCreateByTelegramId(
  db: Knex,
  telegramId: number,
  displayName?: string,
): Promise<{ id: string }> {
  // Check if user already exists
  const existing = await db('users')
    .where({ telegram_id: telegramId })
    .first();

  if (existing) return { id: existing.id };

  // Create new user with synthetic phone
  const phone = `tg_${telegramId}`;
  const [user] = await db('users')
    .insert({
      phone,
      telegram_id: telegramId,
      name: displayName ?? null,
      free_credits_remaining: 5,
    })
    .returning('id');

  return { id: user.id };
}
