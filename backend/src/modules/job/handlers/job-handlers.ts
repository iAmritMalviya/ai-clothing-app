import type { FastifyRequest, FastifyReply } from 'fastify';
import { createStorage } from '../../../lib/storage.js';
import { validateImageFile } from '../../../lib/image-validation.js';
import { createAndProcessJob, getJobById, listJobs } from '../services/job-service.js';

const storage = createStorage();

export async function handleRemoveBg(
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

  const job = await createAndProcessJob(
    request.server.knex,
    storage,
    {
      userId: request.user.userId,
      imageBuffer,
      filename: file.filename,
    },
  );

  return reply.send(job);
}

export async function handleGetJob(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const job = await getJobById(
    request.server.knex,
    request.params.id,
    request.user.userId,
  );
  if (!job) {
    return reply.notFound('Job not found');
  }
  return reply.send(job);
}

export async function handleListJobs(
  request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>,
  reply: FastifyReply,
) {
  const { page, limit } = request.query;
  const result = await listJobs(
    request.server.knex,
    request.user.userId,
    page,
    limit,
  );
  return reply.send(result);
}
