import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Column may already exist (added via psql) — use raw to handle gracefully
  await knex.raw(`
    DO $$ BEGIN
      ALTER TABLE users ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT false;
    EXCEPTION
      WHEN duplicate_column THEN NULL;
    END $$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('is_approved');
  });
}
