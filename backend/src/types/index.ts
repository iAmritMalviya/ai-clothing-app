import type { Knex } from 'knex';

declare module 'fastify' {
  interface FastifyInstance {
    knex: Knex;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string };
    user: { userId: string };
  }
}
