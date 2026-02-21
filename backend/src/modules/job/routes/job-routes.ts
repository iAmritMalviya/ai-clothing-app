import type { FastifyInstance } from 'fastify';
import { authGuard } from '../../../middleware/auth-guard.js';
import { handleRemoveBg, handleGetJob, handleListJobs } from '../handlers/job-handlers.js';
import { removeBgSchema, getJobSchema, listJobsSchema } from '../schemas/job-schemas.js';

export async function jobRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authGuard);

  app.post('/remove-bg', { schema: removeBgSchema }, handleRemoveBg);
  app.get('/:id', { schema: getJobSchema }, handleGetJob);
  app.get('/', { schema: listJobsSchema }, handleListJobs);
}
