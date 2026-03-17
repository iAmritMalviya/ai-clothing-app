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
  generateCatalogSchema,
  getBatchSchema,
  listModelPresetsSchema,
  uploadUserModelSchema,
  listUserModelsSchema,
  deleteUserModelSchema,
  generateTryOnSchema,
} from '../schemas/tryon-schemas.js';

export async function tryonRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authGuard);

  app.post('/catalog', { schema: generateCatalogSchema }, handleGenerateCatalog);
  app.get('/batch/:batchId', { schema: getBatchSchema }, handleGetBatch);
  app.get('/models', { schema: listModelPresetsSchema }, handleListModelPresets);
  app.post('/models/upload', { schema: uploadUserModelSchema }, handleUploadUserModel);
  app.get('/models/mine', { schema: listUserModelsSchema }, handleListUserModels);
  app.delete('/models/mine/:id', { schema: deleteUserModelSchema }, handleDeleteUserModel);
  app.post('/generate', { schema: generateTryOnSchema }, handleGenerateTryOn);
}
