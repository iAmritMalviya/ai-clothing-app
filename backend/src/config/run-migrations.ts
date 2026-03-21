import knex from 'knex';
import { getKnexConfig } from './database.js';

async function run() {
  const db = knex({
    ...getKnexConfig(),
    migrations: {
      directory: './dist/migrations',
      extension: 'js',
    },
  });

  console.log('Running migrations...');
  const [batch, log] = await db.migrate.latest();
  if (log.length === 0) {
    console.log('Already up to date');
  } else {
    console.log(`Batch ${batch}: ${log.length} migrations\n${log.join('\n')}`);
  }

  await db.destroy();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
