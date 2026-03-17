import type { Knex } from 'knex';
import type { StorageProvider } from '../../../lib/storage.js';
import { relativePathFromUrl, readLocalFile } from '../../../lib/storage.js';
import { generateSceneBackground } from '../../../lib/ai-client.js';
import { compositeOnColor, compositeOnImage } from './image-compositor.js';

type BackgroundType = 'solid_color' | 'preset_scene' | 'custom_upload';

interface ApplyBackgroundInput {
  userId: string;
  jobId: string;
  backgroundType: BackgroundType;
  backgroundValue: string;
}

// --- Preset Queries ---

export async function listPresets(db: Knex, category?: string) {
  const query = db('background_presets')
    .where({ is_active: true })
    .orderBy('sort_order', 'asc');
  if (category) {
    query.where({ category });
  }
  return query;
}

// --- User Background CRUD ---

export async function uploadUserBackground(
  db: Knex,
  storage: StorageProvider,
  userId: string,
  imageBuffer: Buffer,
  originalFilename: string,
) {
  const ext = originalFilename.slice(originalFilename.lastIndexOf('.')) || '.jpg';
  const relativePath = await storage.save(imageBuffer, 'user-backgrounds', ext);
  const imageUrl = storage.getUrl(relativePath);

  const [bg] = await db('user_backgrounds')
    .insert({ user_id: userId, image_url: imageUrl, original_filename: originalFilename })
    .returning('*');

  return bg;
}

export async function listUserBackgrounds(db: Knex, userId: string) {
  return db('user_backgrounds')
    .where({ user_id: userId })
    .orderBy('created_at', 'desc');
}

export async function deleteUserBackground(
  db: Knex,
  storage: StorageProvider,
  userId: string,
  backgroundId: string,
): Promise<boolean> {
  const bg = await db('user_backgrounds')
    .where({ id: backgroundId, user_id: userId })
    .first();
  if (!bg) return false;

  await storage.remove(relativePathFromUrl(bg.image_url));
  await db('user_backgrounds').where({ id: backgroundId }).del();
  return true;
}

// --- Apply Background ---

export async function applyBackground(
  db: Knex,
  storage: StorageProvider,
  input: ApplyBackgroundInput,
) {
  const { userId, jobId, backgroundType, backgroundValue } = input;

  // Validate inputs before touching credits
  if (backgroundType === 'solid_color' && !/^#[0-9A-Fa-f]{6}$/.test(backgroundValue)) {
    throw Object.assign(new Error('Invalid hex color'), { statusCode: 400 });
  }
  if (!['solid_color', 'preset_scene', 'custom_upload'].includes(backgroundType)) {
    throw Object.assign(new Error('Invalid background_type'), { statusCode: 400 });
  }

  // Atomically claim 1 credit — prevents race condition with concurrent requests
  const credited = await db('users')
    .where({ id: userId })
    .where('free_credits_remaining', '>', 0)
    .decrement('free_credits_remaining', 1);
  if (!credited) {
    throw Object.assign(new Error('No credits remaining'), { statusCode: 403 });
  }

  // Fetch source job
  const sourceJob = await db('jobs')
    .where({ id: jobId, user_id: userId, type: 'bg_removal', status: 'completed' })
    .first();
  if (!sourceJob || !sourceJob.transparent_image_url) {
    throw Object.assign(new Error('Source job not found or not completed'), { statusCode: 404 });
  }

  // Read transparent PNG
  const transparentBuffer = await readLocalFile(
    relativePathFromUrl(sourceJob.transparent_image_url),
  );

  // Create apply_bg job
  const [job] = await db('jobs')
    .insert({
      user_id: userId,
      type: 'apply_bg',
      status: 'processing',
      source_job_id: jobId,
      background_type: backgroundType,
      background_value: backgroundValue,
      input_image_url: sourceJob.transparent_image_url,
    })
    .returning('*');

  try {
    let result: { buffer: Buffer; processingTimeMs: number };

    if (backgroundType === 'solid_color') {
      result = await compositeOnColor(transparentBuffer, backgroundValue);

    } else if (backgroundType === 'preset_scene') {
      const preset = await db('background_presets')
        .where({ id: backgroundValue, is_active: true })
        .first();
      if (!preset) {
        throw Object.assign(new Error('Preset not found'), { statusCode: 404 });
      }

      if (preset.type === 'solid_color') {
        result = await compositeOnColor(transparentBuffer, preset.value);
      } else {
        // AI scene — use cached image or generate
        let bgBuffer: Buffer;
        if (preset.preview_image_url) {
          bgBuffer = await readLocalFile(relativePathFromUrl(preset.preview_image_url));
        } else {
          bgBuffer = await generateSceneBackground(preset.value);
          const bgPath = await storage.save(bgBuffer, 'bg-previews', '.png');
          const bgUrl = storage.getUrl(bgPath);
          await db('background_presets')
            .where({ id: preset.id })
            .update({ preview_image_url: bgUrl });
        }
        result = await compositeOnImage(transparentBuffer, bgBuffer);
      }

    } else if (backgroundType === 'custom_upload') {
      const userBg = await db('user_backgrounds')
        .where({ id: backgroundValue, user_id: userId })
        .first();
      if (!userBg) {
        throw Object.assign(new Error('Background not found'), { statusCode: 404 });
      }
      const bgBuffer = await readLocalFile(relativePathFromUrl(userBg.image_url));
      result = await compositeOnImage(transparentBuffer, bgBuffer);

    } else {
      // Should never reach here — validated above
      throw Object.assign(new Error('Invalid background_type'), { statusCode: 400 });
    }

    // Save output
    const outputPath = await storage.save(result.buffer, 'outputs', '.png');
    const outputUrl = storage.getUrl(outputPath);

    // Update job
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
    // Refund the credit since processing failed
    try {
      await db('users').where({ id: userId }).increment('free_credits_remaining', 1);
    } catch (refundErr) {
      console.error('[background] CRITICAL: credit refund failed for user', userId, refundErr);
    }
    await db('jobs')
      .where({ id: job.id })
      .update({ status: 'failed' });
    throw err;
  }
}
