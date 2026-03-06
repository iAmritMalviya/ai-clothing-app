import type { Knex } from 'knex';
import type { StorageProvider } from '../../../lib/storage.js';
import { tryOnGarment } from '../../../lib/ai-client.js';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { config } from '../../../config/env.js';

type GarmentCategory = 'tops' | 'bottoms' | 'one-pieces' | 'auto';

interface CreateTryOnInput {
  userId: string;
  jobId: string;
  modelType: 'preset' | 'custom';
  modelValue: string;
  category: GarmentCategory;
}

// --- Helpers ---

function relativePathFromUrl(url: string): string {
  const prefix = `${config.publicUrl}/uploads/`;
  return url.replace(prefix, '');
}

async function readLocalFile(relativePath: string): Promise<Buffer> {
  const fullPath = join(resolve(config.uploadDir), relativePath);
  return readFile(fullPath);
}

function getMimeType(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] ?? 'image/jpeg';
}

// --- Model Preset Queries ---

export async function listModelPresets(db: Knex) {
  return db('model_presets')
    .where({ is_active: true })
    .orderBy('sort_order', 'asc');
}

// --- User Model CRUD ---

export async function uploadUserModel(
  db: Knex,
  storage: StorageProvider,
  userId: string,
  imageBuffer: Buffer,
  originalFilename: string,
) {
  const ext = originalFilename.slice(originalFilename.lastIndexOf('.')) || '.jpg';
  const relativePath = await storage.save(imageBuffer, 'user-models', ext);
  const imageUrl = storage.getUrl(relativePath);

  const [model] = await db('user_models')
    .insert({ user_id: userId, image_url: imageUrl, original_filename: originalFilename })
    .returning('*');

  return model;
}

export async function listUserModels(db: Knex, userId: string) {
  return db('user_models')
    .where({ user_id: userId })
    .orderBy('created_at', 'desc');
}

export async function deleteUserModel(
  db: Knex,
  storage: StorageProvider,
  userId: string,
  modelId: string,
): Promise<boolean> {
  const model = await db('user_models')
    .where({ id: modelId, user_id: userId })
    .first();
  if (!model) return false;

  await storage.remove(relativePathFromUrl(model.image_url));
  await db('user_models').where({ id: modelId }).del();
  return true;
}

// --- Try-On Generation ---

export async function createTryOn(
  db: Knex,
  storage: StorageProvider,
  input: CreateTryOnInput,
) {
  const { userId, jobId, modelType, modelValue, category } = input;

  // Fetch source bg_removal job (need the input clothing image)
  const sourceJob = await db('jobs')
    .where({ id: jobId, user_id: userId, type: 'bg_removal', status: 'completed' })
    .first();
  if (!sourceJob) {
    throw Object.assign(new Error('Source job not found or not completed'), { statusCode: 404 });
  }

  // Resolve model image URL
  let modelImageUrl: string;
  if (modelType === 'preset') {
    const preset = await db('model_presets')
      .where({ id: modelValue, is_active: true })
      .first();
    if (!preset) {
      throw Object.assign(new Error('Model preset not found'), { statusCode: 404 });
    }
    modelImageUrl = preset.image_url;
  } else {
    const userModel = await db('user_models')
      .where({ id: modelValue, user_id: userId })
      .first();
    if (!userModel) {
      throw Object.assign(new Error('User model not found'), { statusCode: 404 });
    }
    modelImageUrl = userModel.image_url;
  }

  // Read the original input image (clothing photo) for garment
  const garmentRelPath = relativePathFromUrl(sourceJob.input_image_url);
  const garmentBuffer = await readLocalFile(garmentRelPath);

  // Read the model image
  let modelBuffer: Buffer;
  if (modelImageUrl.startsWith('http')) {
    const resp = await fetch(modelImageUrl);
    if (!resp.ok) throw new Error(`Failed to fetch model image: ${resp.status}`);
    modelBuffer = Buffer.from(await resp.arrayBuffer());
  } else {
    const cleanPath = modelImageUrl.replace(/^\/uploads\//, '');
    modelBuffer = await readLocalFile(cleanPath);
  }

  // Create tryon job
  const [job] = await db('jobs')
    .insert({
      user_id: userId,
      type: 'tryon',
      status: 'processing',
      source_job_id: jobId,
      input_image_url: sourceJob.input_image_url,
      model_image_url: modelImageUrl,
    })
    .returning('*');

  try {
    // Call Gemini try-on (pass buffers + mime types directly)
    const garmentMime = getMimeType(garmentRelPath);
    const modelMime = getMimeType(modelImageUrl);

    const result = await tryOnGarment(
      modelBuffer,
      modelMime,
      garmentBuffer,
      garmentMime,
      category,
    );

    // Save output
    const outputPath = await storage.save(result.buffer, 'outputs', '.png');
    const outputUrl = storage.getUrl(outputPath);

    // Update job to completed
    const [updatedJob] = await db('jobs')
      .where({ id: job.id })
      .update({
        status: 'completed',
        output_image_url: outputUrl,
        processing_time_ms: result.processingTimeMs,
        completed_at: db.fn.now(),
      })
      .returning('*');

    return updatedJob;
  } catch (err) {
    await db('jobs')
      .where({ id: job.id })
      .update({ status: 'failed' });
    throw err;
  }
}
