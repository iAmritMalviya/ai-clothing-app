import type { Knex } from 'knex';
import type { StorageProvider } from '../../../lib/storage.js';
import { relativePathFromUrl, readLocalFile, getMimeType } from '../../../lib/storage.js';
import { tryOnGarment } from '../../../lib/ai-client.js';
import type { GarmentCategory } from '../../../lib/ai-client.js';
import { poseTemplates } from '../../../lib/pose-templates.js';
import { randomUUID } from 'node:crypto';

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
}

export async function createCatalog(
  db: Knex,
  storage: StorageProvider,
  input: CreateCatalogInput,
) {
  const { userId, garmentBuffer, garmentFilename, category } = input;
  const batchId = randomUUID();

  // Save garment image
  const ext = garmentFilename.slice(garmentFilename.lastIndexOf('.')) || '.jpg';
  const garmentPath = await storage.save(garmentBuffer, 'inputs', ext);
  const garmentUrl = storage.getUrl(garmentPath);
  const garmentMime = getMimeType(garmentFilename);

  // Fetch all active model presets
  const presets = await db('model_presets')
    .where({ is_active: true })
    .orderBy('sort_order', 'asc');

  if (presets.length === 0) {
    throw Object.assign(new Error('No model presets available'), { statusCode: 500 });
  }

  // Read all model images in parallel
  const modelBuffers = await Promise.all(
    presets.map(async (preset: { image_url: string }) => readModelImage(preset.image_url)),
  );

  // Create all jobs upfront
  const jobInserts = presets.map((preset: { image_url: string }) => ({
    user_id: userId,
    type: 'tryon',
    status: 'processing',
    batch_id: batchId,
    input_image_url: garmentUrl,
    model_image_url: preset.image_url,
  }));

  const jobs = await db('jobs').insert(jobInserts).returning('*');

  // Select pose templates based on garment category so each shot highlights the garment correctly.
  // tops → torso-focused, bottoms/one-pieces → full body, auto → mixed.
  const templates = poseTemplates[category] ?? poseTemplates.auto;

  // Run all try-ons in parallel
  const results = await Promise.allSettled(
    presets.map(async (preset: { image_url: string }, i: number) => {
      const job = jobs[i];
      try {
        const modelMime = getMimeType(preset.image_url);
        const template = templates[i % templates.length];
        const result = await tryOnGarment(
          modelBuffers[i],
          modelMime,
          garmentBuffer,
          garmentMime,
          category,
          template.prompt,
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

        return updated;
      } catch {
        await db('jobs').where({ id: job.id }).update({ status: 'failed' });
        return { ...job, status: 'failed' };
      }
    }),
  );

  const completedJobs = results.map((r) =>
    r.status === 'fulfilled' ? r.value : null,
  ).filter(Boolean);

  return { batch_id: batchId, jobs: completedJobs };
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
  const { userId, garmentBuffer, garmentFilename, category } = input;
  const batchId = randomUUID();

  // Save garment image
  const ext = garmentFilename.slice(garmentFilename.lastIndexOf('.')) || '.jpg';
  const garmentPath = await storage.save(garmentBuffer, 'inputs', ext);
  const garmentUrl = storage.getUrl(garmentPath);
  const garmentMime = getMimeType(garmentFilename);

  // Fetch all active model presets
  const presets = await db('model_presets')
    .where({ is_active: true })
    .orderBy('sort_order', 'asc');

  if (presets.length === 0) {
    throw Object.assign(new Error('No model presets available'), { statusCode: 500 });
  }

  // Read all model images in parallel
  const modelBuffers = await Promise.all(
    presets.map(async (preset: { image_url: string }) => readModelImage(preset.image_url)),
  );

  // Create all jobs upfront
  const jobInserts = presets.map((preset: { image_url: string }) => ({
    user_id: userId,
    type: 'tryon',
    status: 'processing',
    batch_id: batchId,
    input_image_url: garmentUrl,
    model_image_url: preset.image_url,
  }));

  const jobs = await db('jobs').insert(jobInserts).returning('*');
  const templates = poseTemplates[category] ?? poseTemplates.auto;
  const total = presets.length;
  let completedCount = 0;
  let failedCount = 0;

  // Run all try-ons in parallel — each track calls onJobComplete when done
  await Promise.allSettled(
    presets.map(async (preset: { image_url: string }, i: number) => {
      const job = jobs[i];
      try {
        const modelMime = getMimeType(preset.image_url);
        const template = templates[i % templates.length];
        const result = await tryOnGarment(
          modelBuffers[i],
          modelMime,
          garmentBuffer,
          garmentMime,
          category,
          template.prompt,
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
        await onJobComplete(updated, template.label, completedCount + failedCount, total);
      } catch (err) {
        console.error(`[catalog-progressive] Job ${job.id} failed:`, err instanceof Error ? err.message : err);
        await db('jobs').where({ id: job.id }).update({ status: 'failed' });
        failedCount++;
      }
    }),
  );

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
