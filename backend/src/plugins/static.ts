import fp from 'fastify-plugin';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { config } from '../config/env.js';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

async function staticPlugin(fastify: FastifyInstance) {
  const uploadPath = resolve(config.uploadDir);

  await mkdir(uploadPath, { recursive: true });

  await fastify.register(fastifyStatic, {
    root: uploadPath,
    prefix: '/uploads/',
  });
}

export default fp(staticPlugin, {
  name: 'static',
});
