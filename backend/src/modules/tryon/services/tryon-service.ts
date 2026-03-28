import type { Knex } from 'knex';
import type { StorageProvider } from '../../../lib/storage.js';
import { relativePathFromUrl, readLocalFile, getMimeType } from '../../../lib/storage.js';
import { tryOnGarment } from '../../../lib/ai-client.js';
import type { GarmentCategory } from '../../../lib/ai-client.js';
import { poseTemplates } from '../../../lib/pose-templates.js';
import { DEFAULT_BACKGROUND, ALL_BACKGROUNDS, getBackgroundPromptByIndex } from '../../../lib/background-prompts.js';
import type { BackgroundPresetGroup } from '../../../lib/background-prompts.js';

function resolveBackground(backgroundId?: string): BackgroundPresetGroup {
  if (!backgroundId) return DEFAULT_BACKGROUND;
  return ALL_BACKGROUNDS.find(b => b.id === backgroundId) ?? DEFAULT_BACKGROUND;
}
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

// Inject background prompt into pose template's {{BACKGROUND}} placeholder
function injectBackground(posePrompt: string, bgGroup: BackgroundPresetGroup, index: number): string {
  const bgPrompt = getBackgroundPromptByIndex(bgGroup, index);
  return posePrompt.replace('{{BACKGROUND}}', bgPrompt);
}

// Downscale image to max 512px on longest side to reduce AI token costs
async function downscaleForAI(buffer: Buffer, maxSize = 512): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  const { width, height, format } = metadata;
  if (!width || !height || (width <= maxSize && height <= maxSize)) return buffer;
  const img = sharp(buffer).resize({ width: maxSize, height: maxSize, fit: 'inside' });
  // Preserve original format (jpeg stays jpeg, png stays png)
  if (format === 'jpeg') return img.jpeg({ quality: 85 }).toBuffer();
  return img.png().toBuffer();
}

interface CreateTryOnInput {
  userId: string;
  jobId: string;
  modelType: 'preset' | 'custom';
  modelValue: string;
  category: GarmentCategory;
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

async function readModelImage(url: string): Promise<Buffer> {
  if (url.startsWith('http')) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch model image: ${resp.status}`);
    return Buffer.from(await resp.arrayBuffer());
  }
  // Handle both "/uploads/..." relative paths and full publicUrl paths
  const cleanPath = url.replace(/^\/uploads\//, '');
  return readLocalFile(cleanPath);
}

// --- Catalog Generation (batch try-on against all presets) ---

interface CreateCatalogInput {
  userId: string;
  garmentBuffer: Buffer;
  garmentFilename: string;
  category: GarmentCategory;
  backgroundId?: string;
  count?: number; // 1-4 images, default 1
}

export async function createCatalog(
  db: Knex,
  storage: StorageProvider,
  input: CreateCatalogInput,
) {
  const { userId, garmentBuffer, garmentFilename, category, backgroundId } = input;
  const batchId = randomUUID();
  const background = resolveBackground(backgroundId);

  // Save garment image
  const ext = garmentFilename.slice(garmentFilename.lastIndexOf('.')) || '.jpg';
  const garmentPath = await storage.save(garmentBuffer, 'inputs', ext);
  const garmentUrl = storage.getUrl(garmentPath);
  const garmentMime = getMimeType(garmentFilename);

  // Fetch first active model preset only (1 image per catalog to optimize costs)
  const presets = await db('model_presets')
    .where({ is_active: true })
    .orderBy('sort_order', 'asc')
    .limit(1);

  if (presets.length === 0) {
    throw Object.assign(new Error('No model presets available'), { statusCode: 500 });
  }

  // Downscale images to 512px to reduce AI token costs
  const [modelBuffer, scaledGarment] = await Promise.all([
    readModelImage(presets[0].image_url).then(buf => downscaleForAI(buf)),
    downscaleForAI(garmentBuffer),
  ]);

  // Create job
  const [job] = await db('jobs')
    .insert({
      user_id: userId,
      type: 'tryon',
      status: 'processing',
      batch_id: batchId,
      input_image_url: garmentUrl,
      model_image_url: presets[0].image_url,
    })
    .returning('*');

  const templates = poseTemplates[category] ?? poseTemplates.auto;
  const template = templates[0];
  const fullPrompt = injectBackground(template.prompt, background, 0);

  try {
    const modelMime = getMimeType(presets[0].image_url);
    const result = await tryOnGarment(
      modelBuffer,
      modelMime,
      scaledGarment,
      garmentMime,
      category,
      fullPrompt,
    );

    const outputPath = await storage.save(result.buffer, 'outputs', '.png');
    const outputUrl = storage.getUrl(outputPath);

    const [updated] = await db('jobs')
      .where({ id: job.id })
      .update({
        status: 'completed',
        output_image_url: outputUrl,
        processing_time_ms: result.processingTimeMs,
        completed_at: db.fn.now(),
      })
      .returning('*');

    return { batch_id: batchId, jobs: [updated] };
  } catch {
    await db('jobs').where({ id: job.id }).update({ status: 'failed' });
    return { batch_id: batchId, jobs: [{ ...job, status: 'failed' }] };
  }
}

// --- Progressive Catalog Generation (for Telegram bot) ---

export async function createCatalogProgressive(
  db: Knex,
  storage: StorageProvider,
  input: CreateCatalogInput,
  onJobComplete: (
    job: Record<string, unknown>,
    poseLabel: string,
    completed: number,
    total: number,
  ) => Promise<void>,
): Promise<{ batch_id: string; completedCount: number; failedCount: number }> {
  const { userId, garmentBuffer, garmentFilename, category, backgroundId, count = 1 } = input;
  const batchId = randomUUID();
  const background = resolveBackground(backgroundId);
  const total = Math.min(count, 4);

  // Save garment image
  const ext = garmentFilename.slice(garmentFilename.lastIndexOf('.')) || '.jpg';
  const garmentPath = await storage.save(garmentBuffer, 'inputs', ext);
  const garmentUrl = storage.getUrl(garmentPath);
  const garmentMime = getMimeType(garmentFilename);

  // Fetch first active model preset
  const presets = await db('model_presets')
    .where({ is_active: true })
    .orderBy('sort_order', 'asc')
    .limit(1);

  if (presets.length === 0) {
    throw Object.assign(new Error('No model presets available'), { statusCode: 500 });
  }

  // Downscale images to 512px to reduce AI token costs
  const [modelBuffer, scaledGarment] = await Promise.all([
    readModelImage(presets[0].image_url).then(buf => downscaleForAI(buf)),
    downscaleForAI(garmentBuffer),
  ]);

  const templates = poseTemplates[category] ?? poseTemplates.auto;
  const modelMime = getMimeType(presets[0].image_url);
  let completedCount = 0;
  let failedCount = 0;

  // Generate images sequentially (each with a different pose)
  for (let i = 0; i < total; i++) {
    const template = templates[i % templates.length];
    const fullPrompt = injectBackground(template.prompt, background, i);

    const [job] = await db('jobs')
      .insert({
        user_id: userId,
        type: 'tryon',
        status: 'processing',
        batch_id: batchId,
        input_image_url: garmentUrl,
        model_image_url: presets[0].image_url,
      })
      .returning('*');

    try {
      const result = await tryOnGarment(
        modelBuffer,
        modelMime,
        scaledGarment,
        garmentMime,
        category,
        fullPrompt,
      );

      const outputPath = await storage.save(result.buffer, 'outputs', '.png');
      const outputUrl = storage.getUrl(outputPath);

      const [updated] = await db('jobs')
        .where({ id: job.id })
        .update({
          status: 'completed',
          output_image_url: outputUrl,
          processing_time_ms: result.processingTimeMs,
          completed_at: db.fn.now(),
        })
        .returning('*');

      completedCount++;
      await onJobComplete(updated, template.label, completedCount, total);
    } catch (err) {
      console.error(`[catalog-progressive] Job ${job.id} failed:`, err instanceof Error ? err.message : err);
      await db('jobs').where({ id: job.id }).update({ status: 'failed' });
      failedCount++;
    }
  }

  return { batch_id: batchId, completedCount, failedCount };
}

export async function getJobsByBatch(db: Knex, batchId: string, userId: string) {
  return db('jobs')
    .where({ batch_id: batchId, user_id: userId })
    .orderBy('created_at', 'asc');
}

export async function createTryOn(
  db: Knex,
  storage: StorageProvider,
  input: CreateTryOnInput,
) {
  const { userId, jobId, modelType, modelValue, category } = input;

  // Fetch source job and resolve model in parallel
  const [sourceJob, modelImageUrl] = await Promise.all([
    db('jobs')
      .where({ id: jobId, user_id: userId, type: 'bg_removal', status: 'completed' })
      .first(),
    (async () => {
      if (modelType === 'preset') {
        const preset = await db('model_presets')
          .where({ id: modelValue, is_active: true })
          .first();
        if (!preset) {
          throw Object.assign(new Error('Model preset not found'), { statusCode: 404 });
        }
        return preset.image_url as string;
      }
      const userModel = await db('user_models')
        .where({ id: modelValue, user_id: userId })
        .first();
      if (!userModel) {
        throw Object.assign(new Error('User model not found'), { statusCode: 404 });
      }
      return userModel.image_url as string;
    })(),
  ]);

  if (!sourceJob) {
    throw Object.assign(new Error('Source job not found or not completed'), { statusCode: 404 });
  }

  // Read garment and model images in parallel
  const garmentRelPath = relativePathFromUrl(sourceJob.input_image_url);
  const [garmentBuffer, modelBuffer] = await Promise.all([
    readLocalFile(garmentRelPath),
    readModelImage(modelImageUrl),
  ]);

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
    const garmentMime = getMimeType(garmentRelPath);
    const modelMime = getMimeType(modelImageUrl);

    // Use the first template for this category — standard catalogue pose
    const posePrompt = (poseTemplates[category] ?? poseTemplates.auto)[0].prompt;

    const result = await tryOnGarment(
      modelBuffer,
      modelMime,
      garmentBuffer,
      garmentMime,
      category,
      posePrompt,
    );

    // Save output
    const outputPath = await storage.save(result.buffer, 'outputs', '.png');
    const outputUrl = storage.getUrl(outputPath);

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
