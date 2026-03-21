import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import databasePlugin from './plugins/database.js';
import jwtPlugin from './plugins/jwt.js';
import multipartPlugin from './plugins/multipart.js';
import staticPlugin from './plugins/static.js';
import { authRoutes } from './modules/auth/routes/auth-routes.js';
import { userRoutes } from './modules/user/routes/user-routes.js';
import { jobRoutes } from './modules/job/routes/job-routes.js';
import { backgroundRoutes } from './modules/background/routes/background-routes.js';
import { tryonRoutes } from './modules/tryon/routes/tryon-routes.js';
import './types/index.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: 'info',
      transport:
        process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty' }
          : undefined,
    },
    disableRequestLogging: true,
  });

  // Request logger middleware — logs every route hit via Pino (Fastify's built-in logger)
  app.addHook('onRequest', async (request) => {
    const ip = request.headers['x-forwarded-for'] ?? request.ip;
    request.log.info({ method: request.method, url: request.url, ip }, 'incoming request');
  });

  // Plugins
  await app.register(cors);
  await app.register(sensible);
  await app.register(databasePlugin);
  await app.register(jwtPlugin);
  await app.register(multipartPlugin);
  await app.register(staticPlugin);

  // Routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(userRoutes, { prefix: '/api/user' });
  await app.register(jobRoutes, { prefix: '/api/jobs' });
  await app.register(backgroundRoutes, { prefix: '/api/backgrounds' });
  await app.register(tryonRoutes, { prefix: '/api/tryon' });

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return app;
}
