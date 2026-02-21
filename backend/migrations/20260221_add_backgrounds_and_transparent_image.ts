import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add new columns to jobs table
  await knex.schema.alterTable('jobs', (table) => {
    table.text('transparent_image_url');
    table.uuid('source_job_id').references('id').inTable('jobs').onDelete('SET NULL');
    table.string('background_type', 20);
    table.text('background_value');
  });

  // Backfill: existing completed bg_removal jobs already have a transparent PNG as output
  await knex('jobs')
    .where({ type: 'bg_removal', status: 'completed' })
    .update({ transparent_image_url: knex.ref('output_image_url') });

  // System-level background presets
  await knex.schema.createTable('background_presets', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable();
    table.string('type', 20).notNullable(); // 'solid_color' | 'ai_scene'
    table.text('value').notNullable(); // hex color or fal.ai prompt
    table.text('preview_image_url');
    table.string('category', 50).notNullable(); // 'color' | 'studio' | 'lifestyle' | 'outdoor'
    table.integer('sort_order').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // User-uploaded custom backgrounds
  await knex.schema.createTable('user_backgrounds', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.text('image_url').notNullable();
    table.string('original_filename', 255);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('user_id');
  });

  // Seed preset backgrounds
  await knex('background_presets').insert([
    // Solid colors
    { name: 'White', type: 'solid_color', value: '#FFFFFF', category: 'color', sort_order: 1 },
    { name: 'Black', type: 'solid_color', value: '#000000', category: 'color', sort_order: 2 },
    { name: 'Light Grey', type: 'solid_color', value: '#E5E5E5', category: 'color', sort_order: 3 },
    { name: 'Dark Grey', type: 'solid_color', value: '#4A4A4A', category: 'color', sort_order: 4 },
    { name: 'Beige', type: 'solid_color', value: '#F5F0E8', category: 'color', sort_order: 5 },
    { name: 'Cream', type: 'solid_color', value: '#FFFDD0', category: 'color', sort_order: 6 },
    { name: 'Soft Pink', type: 'solid_color', value: '#F8E8E8', category: 'color', sort_order: 7 },
    { name: 'Light Blue', type: 'solid_color', value: '#E8F0F8', category: 'color', sort_order: 8 },
    { name: 'Sage Green', type: 'solid_color', value: '#E8F0E8', category: 'color', sort_order: 9 },
    { name: 'Lavender', type: 'solid_color', value: '#E8E0F0', category: 'color', sort_order: 10 },

    // AI-generated scenes
    { name: 'Photo Studio', type: 'ai_scene', value: 'professional photography studio background, soft gradient lighting, clean minimal backdrop, product photography', category: 'studio', sort_order: 11 },
    { name: 'White Marble', type: 'ai_scene', value: 'elegant white marble floor and wall background, luxury product photography, soft natural lighting', category: 'studio', sort_order: 12 },
    { name: 'Wooden Table', type: 'ai_scene', value: 'rustic wooden table surface, warm natural lighting, lifestyle product photography background', category: 'lifestyle', sort_order: 13 },
    { name: 'Concrete Wall', type: 'ai_scene', value: 'modern concrete wall background, urban minimalist, soft directional lighting, product photography', category: 'studio', sort_order: 14 },
    { name: 'Garden Outdoor', type: 'ai_scene', value: 'beautiful garden outdoor background, soft bokeh greenery, natural daylight, lifestyle photography', category: 'outdoor', sort_order: 15 },
    { name: 'Beach Sunset', type: 'ai_scene', value: 'beach sunset background, golden hour lighting, soft waves, lifestyle product photography', category: 'outdoor', sort_order: 16 },
    { name: 'City Street', type: 'ai_scene', value: 'urban city street background, shallow depth of field, modern architecture, lifestyle photography', category: 'outdoor', sort_order: 17 },
    { name: 'Fabric Drape', type: 'ai_scene', value: 'soft draped fabric background, elegant textile, fashion photography backdrop, even lighting', category: 'lifestyle', sort_order: 18 },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_backgrounds');
  await knex.schema.dropTableIfExists('background_presets');

  await knex.schema.alterTable('jobs', (table) => {
    table.dropColumn('background_value');
    table.dropColumn('background_type');
    table.dropColumn('source_job_id');
    table.dropColumn('transparent_image_url');
  });
}
