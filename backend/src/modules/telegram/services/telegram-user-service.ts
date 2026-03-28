import type { Knex } from 'knex';

/**
 * Find or create a user by their Telegram ID.
 * Uses INSERT ON CONFLICT (upsert) to prevent race conditions
 * when two messages arrive simultaneously from a new user.
 * Synthetic phone `tg_{telegramId}` avoids collision with real phones.
 */
export async function findOrCreateByTelegramId(
  db: Knex,
  telegramId: number,
  displayName?: string,
): Promise<{ id: string }> {
  const phone = `tg_${telegramId}`;

  const [user] = await db('users')
    .insert({
      phone,
      telegram_id: telegramId,
      name: displayName ?? null,
      free_credits_remaining: 2,
    })
    .onConflict('telegram_id')
    .merge({ name: db.raw('COALESCE(EXCLUDED.name, users.name)') })
    .returning('id');

  if (!user?.id) {
    throw new Error(`Failed to create/fetch user for telegram_id: ${telegramId}`);
  }

  return { id: user.id };
}
