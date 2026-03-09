import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('jobs', (table) => {
    table.uuid('batch_id').nullable().index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('jobs', (table) => {
    table.dropColumn('batch_id');
  });
}
