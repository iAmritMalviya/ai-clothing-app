import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('phone', 15).unique().notNullable();
    table.string('name', 100);
    table.string('shop_name', 200);
    table.integer('free_credits_remaining').defaultTo(5);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('type', 50).defaultTo('bg_removal');
    table.string('status', 20).defaultTo('pending');
    table.text('input_image_url').notNullable();
    table.text('output_image_url');
    table.integer('processing_time_ms');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('completed_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('jobs');
  await knex.schema.dropTableIfExists('users');
}
