import fp from 'fastify-plugin';
import knex, { type Knex } from 'knex';
import type { FastifyInstance } from 'fastify';
import { getKnexConfig } from '../config/database.js';

async function databasePlugin(fastify: FastifyInstance) {
  const db: Knex = knex(getKnexConfig());

  // Verify the connection works
  await db.raw('SELECT 1');
  fastify.log.info('Database connected');

  fastify.decorate('knex', db);

  fastify.addHook('onClose', async () => {
    await db.destroy();
    fastify.log.info('Database connection closed');
  });
}

export default fp(databasePlugin, {
  name: 'database',
});
