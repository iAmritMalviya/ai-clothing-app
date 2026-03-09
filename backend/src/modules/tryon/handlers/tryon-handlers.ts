import type { FastifyRequest, FastifyReply } from 'fastify';
import { createStorage } from '../../../lib/storage.js';
import { validateImageFile } from '../../../lib/image-validation.js';
import {
  listModelPresets,
  uploadUserModel,
  listUserModels,
  deleteUserModel,
  createTryOn,
  createCatalog,
  getJobsByBatch,
} from '../services/tryon-service.js';

const storage = createStorage();

export async function handleListModelPresets(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const models = await listModelPresets(request.server.knex);
  return reply.send({ models });
}

export async function handleUploadUserModel(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const file = await request.file();
  if (!file) {
    return reply.badRequest('No file uploaded');
  }

  const validation = validateImageFile(file.mimetype, file.filename);
  if (!validation.valid) {
    return reply.badRequest(validation.error);
  }

  const imageBuffer = await file.toBuffer();
  const model = await uploadUserModel(
    request.server.knex,
    storage,
    request.user.userId,
    imageBuffer,
    file.filename,
  );

  return reply.send(model);
}

export async function handleListUserModels(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const models = await listUserModels(
    request.server.knex,
    request.user.userId,
  );
  return reply.send({ models });
}

export async function handleDeleteUserModel(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const deleted = await deleteUserModel(
    request.server.knex,
    storage,
    request.user.userId,
    request.params.id,
  );
  if (!deleted) {
    return reply.notFound('Model not found');
  }
  return reply.send({ success: true });
}

export async function handleGenerateTryOn(
  request: FastifyRequest<{
    Body: {
      job_id: string;
      model_type: 'preset' | 'custom';
      model_value: string;
      category?: 'tops' | 'bottoms' | 'one-pieces' | 'auto';
    };
  }>,
  reply: FastifyReply,
) {
  const { job_id, model_type, model_value, category } = request.body;

  const job = await createTryOn(
    request.server.knex,
    storage,
    {
      userId: request.user.userId,
      jobId: job_id,
      modelType: model_type,
      modelValue: model_value,
      category: category ?? 'auto',
    },
  );

  return reply.send(job);
}

export async function handleGenerateCatalog(
  request: FastifyRequest<{
    Querystring: { category?: 'tops' | 'bottoms' | 'one-pieces' | 'auto' };
  }>,
  reply: FastifyReply,
) {
  const file = await request.file();
  if (!file) {
    return reply.badRequest('No file uploaded');
  }

  const validation = validateImageFile(file.mimetype, file.filename);
  if (!validation.valid) {
    return reply.badRequest(validation.error);
  }

  const imageBuffer = await file.toBuffer();
  const category = request.query.category ?? 'auto';

  const result = await createCatalog(
    request.server.knex,
    storage,
    {
      userId: request.user.userId,
      garmentBuffer: imageBuffer,
      garmentFilename: file.filename,
      category,
    },
  );

  return reply.send(result);
}

export async function handleGetBatch(
  request: FastifyRequest<{ Params: { batchId: string } }>,
  reply: FastifyReply,
) {
  const jobs = await getJobsByBatch(
    request.server.knex,
    request.params.batchId,
    request.user.userId,
  );
  if (jobs.length === 0) {
    return reply.notFound('Batch not found');
  }
  return reply.send({ batch_id: request.params.batchId, jobs });
}
