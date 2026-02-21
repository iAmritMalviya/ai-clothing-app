import type { FastifyRequest, FastifyReply } from 'fastify';
import { createStorage } from '../../../lib/storage.js';
import { validateImageFile } from '../../../lib/image-validation.js';
import {
  listPresets,
  uploadUserBackground,
  listUserBackgrounds,
  deleteUserBackground,
  applyBackground,
} from '../services/background-service.js';

const storage = createStorage();

export async function handleListPresets(
  request: FastifyRequest<{ Querystring: { category?: string } }>,
  reply: FastifyReply,
) {
  const presets = await listPresets(request.server.knex, request.query.category);
  return reply.send({ presets });
}

export async function handleUploadBackground(
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
  const bg = await uploadUserBackground(
    request.server.knex,
    storage,
    request.user.userId,
    imageBuffer,
    file.filename,
  );

  return reply.send(bg);
}

export async function handleListMyBackgrounds(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const backgrounds = await listUserBackgrounds(
    request.server.knex,
    request.user.userId,
  );
  return reply.send({ backgrounds });
}

export async function handleDeleteMyBackground(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const deleted = await deleteUserBackground(
    request.server.knex,
    storage,
    request.user.userId,
    request.params.id,
  );
  if (!deleted) {
    return reply.notFound('Background not found');
  }
  return reply.send({ success: true });
}

export async function handleApplyBackground(
  request: FastifyRequest<{
    Body: {
      job_id: string;
      background_type: 'solid_color' | 'preset_scene' | 'custom_upload';
      background_value: string;
    };
  }>,
  reply: FastifyReply,
) {
  const { job_id, background_type, background_value } = request.body;

  const job = await applyBackground(
    request.server.knex,
    storage,
    {
      userId: request.user.userId,
      jobId: job_id,
      backgroundType: background_type,
      backgroundValue: background_value,
    },
  );

  return reply.send(job);
}
