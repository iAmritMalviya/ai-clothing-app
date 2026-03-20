import type { Context } from 'grammy';
import type { Knex } from 'knex';
import type { StorageProvider } from '../../../lib/storage.js';
import { relativePathFromUrl, readLocalFile, getMimeType } from '../../../lib/storage.js';
import { createCatalogProgressive } from '../../tryon/services/tryon-service.js';
import { getSession, resetSession, getBackgroundPref } from '../session.js';
import { validateAndClassifyGarment } from '../validators/image-validator.js';
import { InputFile } from 'grammy';
import { msg, getLang } from '../i18n.js';
import sharp from 'sharp';

const GENERATION_COOLDOWN_MS = 30_000;
const MIN_ACCOUNT_AGE_MS = 60_000;

export async function handleCatalogGeneration(
  ctx: Context,
  db: Knex,
  storage: StorageProvider,
): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const session = getSession(chatId);
  if (!session.photoFileId || !session.category || !session.userId) {
    await ctx.reply(msg(chatId, 'something_wrong'));
    resetSession(chatId);
    return;
  }

  // V1: Check account age
  const user = await db('users').where({ id: session.userId }).first();
  if (user) {
    const accountAge = Date.now() - new Date(user.created_at).getTime();
    if (accountAge < MIN_ACCOUNT_AGE_MS) {
      await ctx.reply(msg(chatId, 'account_setup'));
      resetSession(chatId);
      return;
    }
  }

  // V6: Rate limit
  const lastJob = await db('jobs')
    .where({ user_id: session.userId, type: 'tryon' })
    .orderBy('created_at', 'desc')
    .first();
  if (lastJob && Date.now() - new Date(lastJob.created_at).getTime() < GENERATION_COOLDOWN_MS) {
    await ctx.reply(msg(chatId, 'cooldown'));
    resetSession(chatId);
    return;
  }

  // Download garment photo
  let garmentBuffer: Buffer;
  let garmentFilename: string;

  // Send status message with progress bar
  const statusMsg = await ctx.reply(`⏳ ${msg(chatId, 'progress_download')}\n█░░░░░░░░░ 10%`);
  const msgId = statusMsg.message_id;

  async function updateProgress(stage: string, percent: number) {
    const filled = Math.round(percent / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    try {
      await ctx.api.editMessageText(chatId!, msgId, `⏳ ${stage}\n${bar} ${percent}%`);
    } catch { /* ignore edit failures */ }
  }

  let progressTimer: ReturnType<typeof setInterval> | null = null;

  try {
    const file = await ctx.api.getFile(session.photoFileId);
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('Download failed');
    garmentBuffer = Buffer.from(await response.arrayBuffer());
    garmentFilename = file.file_path ?? 'garment.jpg';
  } catch {
    await ctx.reply(msg(chatId, 'download_failed'));
    resetSession(chatId);
    return;
  }

  // M8: Validate image format
  await updateProgress(msg(chatId, 'progress_validate'), 20);
  try {
    const metadata = await sharp(garmentBuffer).metadata();
    if (!metadata.format || !['jpeg', 'png', 'webp', 'gif'].includes(metadata.format)) {
      await ctx.reply(msg(chatId, 'invalid_image'));
      resetSession(chatId);
      return;
    }
  } catch {
    await ctx.reply(msg(chatId, 'invalid_image'));
    resetSession(chatId);
    return;
  }

  // M1: Validate garment + auto-detect category (tops/bottoms/one-pieces)
  const mimeType = getMimeType(garmentFilename);
  const classification = await validateAndClassifyGarment(garmentBuffer, mimeType);
  if (!classification.isGarment) {
    await ctx.reply(msg(chatId, 'not_garment'));
    resetSession(chatId);
    return;
  }

  // Override session category with detected category
  session.category = classification.category;
  console.log(`[bot] Garment detected as: ${classification.category}`);

  await updateProgress(msg(chatId, 'progress_verified'), 40);

  // Deduct credit
  const credited = await db('users')
    .where({ id: session.userId })
    .where('free_credits_remaining', '>', 0)
    .decrement('free_credits_remaining', 1);

  if (!credited) {
    await ctx.reply(msg(chatId, 'no_credits'));
    resetSession(chatId);
    return;
  }

  let aiSucceeded = false;
  let creditRefunded = false;

  const updatedUser = await db('users').where({ id: session.userId }).first();
  const remaining = updatedUser?.free_credits_remaining ?? 0;

  const genMsg = getLang(chatId) === 'hi'
    ? `Aapki catalog ban rahi hai... 15-30 second lagenge.\n(${remaining} free generation${remaining === 1 ? '' : 's'} baaki hai)`
    : `Generating your catalog... This takes 15-30 seconds.\n(${remaining} free generation${remaining === 1 ? '' : 's'} remaining)`;
  await updateProgress(genMsg, 50);

  try {
    let sentCount = 0;

    // Progress timer during AI generation
    const genStart = Date.now();
    progressTimer = setInterval(async () => {
      const elapsed = Date.now() - genStart;
      const percent = Math.min(90, 50 + Math.round((elapsed / 25000) * 40));
      await updateProgress(msg(chatId, 'progress_generating'), percent);
    }, 5000);

    await createCatalogProgressive(
      db,
      storage,
      {
        userId: session.userId,
        garmentBuffer,
        garmentFilename,
        category: session.category,
        backgroundId: getBackgroundPref(chatId) ?? undefined,
      },
      async (job, poseLabel, _completed, _total) => {
        aiSucceeded = true;
        // Stop timer and show 100% before sending image
        if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
        await updateProgress(msg(chatId, 'progress_done'), 100);
        try {
          const outputUrl = job['output_image_url'] as string | undefined;
          if (!outputUrl) return;

          const relativePath = relativePathFromUrl(outputUrl);
          const imageBuffer = await readLocalFile(relativePath);

          await ctx.replyWithPhoto(new InputFile(imageBuffer, `${poseLabel}.png`), {
            caption: poseLabel,
          });
          sentCount++;
        } catch (err) {
          console.error('[bot] Delivery failure:', err instanceof Error ? err.message : err);
        }
      },
    );

    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }

    if (!aiSucceeded) {
      await refundCredit(db, session.userId);
      creditRefunded = true;
      await updateProgress(msg(chatId, 'generation_failed'), 0);
      await ctx.reply(msg(chatId, 'generation_failed'));
    } else if (sentCount === 0) {
      await updateProgress(msg(chatId, 'delivery_failed'), 0);
      await ctx.reply(msg(chatId, 'delivery_failed'));
    } else {
      await ctx.reply(msg(chatId, 'done'));
    }
  } catch (err) {
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    console.error('[bot] Catalog generation failed:', err instanceof Error ? err.message : err);
    if (!aiSucceeded && !creditRefunded) {
      await refundCredit(db, session.userId);
    }
    await ctx.reply(msg(chatId, 'error'));
  } finally {
    resetSession(chatId);
  }
}

async function refundCredit(db: Knex, userId: string): Promise<void> {
  try {
    await db('users').where({ id: userId }).increment('free_credits_remaining', 1);
  } catch (refundErr) {
    console.error('[bot] CRITICAL: credit refund failed for user', userId, refundErr);
  }
}
