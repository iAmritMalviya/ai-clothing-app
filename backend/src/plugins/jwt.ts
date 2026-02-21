import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance } from 'fastify';
import { config } from '../config/env.js';

async function jwtPlugin(fastify: FastifyInstance) {
  await fastify.register(jwt, {
    secret: config.jwtSecret,
    sign: { expiresIn: config.jwtExpiresIn },
  });
}

export default fp(jwtPlugin, {
  name: 'jwt',
});
