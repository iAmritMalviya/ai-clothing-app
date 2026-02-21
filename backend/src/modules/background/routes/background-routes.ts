import type { FastifyInstance } from 'fastify';
import { authGuard } from '../../../middleware/auth-guard.js';
import {
  handleListPresets,
  handleUploadBackground,
  handleListMyBackgrounds,
  handleDeleteMyBackground,
  handleApplyBackground,
} from '../handlers/background-handlers.js';
import {
  listPresetsSchema,
  uploadBackgroundSchema,
  listMyBackgroundsSchema,
  deleteMyBackgroundSchema,
  applyBackgroundSchema,
} from '../schemas/background-schemas.js';

export async function backgroundRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authGuard);

  app.get('/presets', { schema: listPresetsSchema }, handleListPresets);
  app.post('/upload', { schema: uploadBackgroundSchema }, handleUploadBackground);
  app.get('/mine', { schema: listMyBackgroundsSchema }, handleListMyBackgrounds);
  app.delete('/mine/:id', { schema: deleteMyBackgroundSchema }, handleDeleteMyBackground);
  app.post('/apply', { schema: applyBackgroundSchema }, handleApplyBackground);
}
