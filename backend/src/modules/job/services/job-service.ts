import type { Knex } from 'knex';
import type { StorageProvider } from '../../../lib/storage.js';
import { removeBackground } from '../../../lib/ai-client.js';
import { compositeOnColor } from '../../background/services/image-compositor.js';
import { extname } from 'node:path';

interface CreateJobInput {
  userId: string;
  imageBuffer: Buffer;
  filename: string;
}

export async function createAndProcessJob(
  db: Knex,
  storage: StorageProvider,
  input: CreateJobInput,
) {
  const { userId, imageBuffer, filename } = input;

  // Save input image
  const ext = extname(filename) || '.jpg';
  const inputPath = await storage.save(imageBuffer, 'inputs', ext);
  const inputUrl = storage.getUrl(inputPath);

  // Create job
  const [job] = await db('jobs')
    .insert({
      user_id: userId,
      type: 'bg_removal',
      status: 'processing',
      input_image_url: inputUrl,
    })
    .returning('*');

  try {
    // Call AI service — returns transparent PNG
    const result = await removeBackground(imageBuffer, filename);

    // Save transparent PNG (reusable for background selection)
    const transparentPath = await storage.save(result.buffer, 'transparent', '.png');
    const transparentUrl = storage.getUrl(transparentPath);

    // Composite onto white as default output
    const whiteComposite = await compositeOnColor(result.buffer, '#FFFFFF');
    const outputPath = await storage.save(whiteComposite.buffer, 'outputs', '.png');
    const outputUrl = storage.getUrl(outputPath);

    // Update job
    const [updatedJob] = await db('jobs')
      .where({ id: job.id })
      .update({
        status: 'completed',
        transparent_image_url: transparentUrl,
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

export async function getJobById(db: Knex, jobId: string, userId: string) {
  return db('jobs').where({ id: jobId, user_id: userId }).first();
}

export async function listJobs(
  db: Knex,
  userId: string,
  page = 1,
  limit = 20,
) {
  const offset = (page - 1) * limit;

  const [jobs, [{ count }]] = await Promise.all([
    db('jobs')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset),
    db('jobs').where({ user_id: userId }).count('* as count'),
  ]);

  return { jobs, total: Number(count) };
}
