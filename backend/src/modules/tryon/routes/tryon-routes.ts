import type { FastifyInstance } from 'fastify';
import { authGuard } from '../../../middleware/auth-guard.js';
import {
  handleListModelPresets,
  handleUploadUserModel,
  handleListUserModels,
  handleDeleteUserModel,
  handleGenerateTryOn,
  handleGenerateCatalog,
  handleGetBatch,
} from '../handlers/tryon-handlers.js';
import {
  listModelPresetsSchema,
  uploadUserModelSchema,
  listUserModelsSchema,
  deleteUserModelSchema,
  generateTryOnSchema,
} from '../schemas/tryon-schemas.js';

export async function tryonRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authGuard);

  app.post('/catalog', handleGenerateCatalog);
  app.get('/batch/:batchId', handleGetBatch);
  app.get('/models', { schema: listModelPresetsSchema }, handleListModelPresets);
  app.post('/models/upload', { schema: uploadUserModelSchema }, handleUploadUserModel);
  app.get('/models/mine', { schema: listUserModelsSchema }, handleListUserModels);
  app.delete('/models/mine/:id', { schema: deleteUserModelSchema }, handleDeleteUserModel);
  app.post('/generate', { schema: generateTryOnSchema }, handleGenerateTryOn);
}
