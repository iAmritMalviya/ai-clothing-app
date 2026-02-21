import type { FastifyInstance } from 'fastify';
import { authGuard } from '../../../middleware/auth-guard.js';
import { handleGetMe, handleUpdateMe } from '../handlers/user-handlers.js';
import { getMeSchema, updateMeSchema } from '../schemas/user-schemas.js';

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authGuard);

  app.get('/me', { schema: getMeSchema }, handleGetMe);
  app.patch('/me', { schema: updateMeSchema }, handleUpdateMe);
}
