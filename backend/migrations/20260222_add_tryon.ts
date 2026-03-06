import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add model_image_url to jobs table
  await knex.schema.alterTable('jobs', (table) => {
    table.text('model_image_url');
  });

  // Pre-built model presets (diverse male/female models)
  await knex.schema.createTable('model_presets', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable();
    table.string('gender', 20).notNullable(); // 'female' | 'male'
    table.text('image_url').notNullable();
    table.integer('sort_order').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // User-uploaded custom model photos
  await knex.schema.createTable('user_models', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.text('image_url').notNullable();
    table.string('original_filename', 255);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('user_id');
  });

  // Seed 4 model presets (placeholder URLs — replace with real model photos before testing)
  await knex('model_presets').insert([
    { name: 'Female Model 1', gender: 'female', image_url: '/uploads/model-presets/female-1.png', sort_order: 1 },
    { name: 'Female Model 2', gender: 'female', image_url: '/uploads/model-presets/female-2.png', sort_order: 2 },
    { name: 'Male Model 1', gender: 'male', image_url: '/uploads/model-presets/male-1.png', sort_order: 3 },
    { name: 'Male Model 2', gender: 'male', image_url: '/uploads/model-presets/male-2.png', sort_order: 4 },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_models');
  await knex.schema.dropTableIfExists('model_presets');

  await knex.schema.alterTable('jobs', (table) => {
    table.dropColumn('model_image_url');
  });
}
