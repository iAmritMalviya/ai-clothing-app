import fp from 'fastify-plugin';
import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { config } from '../config/env.js';

async function multipartPlugin(fastify: FastifyInstance) {
  await fastify.register(multipart, {
    limits: {
      fileSize: config.maxFileSize,
      files: 1,
    },
  });
}

export default fp(multipartPlugin, {
  name: 'multipart',
});
