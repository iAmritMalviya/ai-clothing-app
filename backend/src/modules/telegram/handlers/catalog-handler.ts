import type { Context } from 'grammy';
import type { Knex } from 'knex';
import type { StorageProvider } from '../../../lib/storage.js';
import { relativePathFromUrl, readLocalFile, getMimeType } from '../../../lib/storage.js';
import { createCatalogProgressive } from '../../tryon/services/tryon-service.js';
import { getSession, resetSession } from '../session.js';
import { isGarmentImage } from '../validators/image-validator.js';
import { InputFile } from 'grammy';
import sharp from 'sharp';

const GENERATION_COOLDOWN_MS = 30_000; // V6: 30 seconds between generations
const MIN_ACCOUNT_AGE_MS = 60_000; // V1: 1 minute minimum account age

export async function handleCatalogGeneration(
  ctx: Context,
  db: Knex,
  storage: StorageProvider,
): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const session = getSession(chatId);
  if (!session.photoFileId || !session.category || !session.userId) {
    await ctx.reply('Something went wrong. Please send a garment photo to start over.');
    resetSession(chatId);
    return;
  }

  // V1: Check account age — prevent rapid multi-account abuse
  const user = await db('users').where({ id: session.userId }).first();
  if (user) {
    const accountAge = Date.now() - new Date(user.created_at).getTime();
    if (accountAge < MIN_ACCOUNT_AGE_MS) {
      await ctx.reply('Your account is being set up. Please try again in a minute.');
      resetSession(chatId);
      return;
    }
  }

  // V6: Rate limit — 30 seconds between generations
  const lastJob = await db('jobs')
    .where({ user_id: session.userId, type: 'tryon' })
    .orderBy('created_at', 'desc')
    .first();
  if (lastJob && Date.now() - new Date(lastJob.created_at).getTime() < GENERATION_COOLDOWN_MS) {
    await ctx.reply('Please wait 30 seconds between generations.');
    resetSession(chatId);
    return;
  }

  // Download the garment photo from Telegram
  let garmentBuffer: Buffer;
  let garmentFilename: string;
  try {
    const file = await ctx.api.getFile(session.photoFileId);
    // M5: Don't log or persist the token-containing URL
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('Failed to download photo from Telegram');
    garmentBuffer = Buffer.from(await response.arrayBuffer());
    garmentFilename = file.file_path ?? 'garment.jpg';
  } catch {
    await ctx.reply('Failed to download your photo. Please try again.');
    resetSession(chatId);
    return;
  }

  // M8: Validate actual image content with sharp (not just MIME header)
  try {
    const metadata = await sharp(garmentBuffer).metadata();
    if (!metadata.format || !['jpeg', 'png', 'webp', 'gif'].includes(metadata.format)) {
      await ctx.reply('This file is not a valid image. Please send a JPEG, PNG, or WebP photo.');
      resetSession(chatId);
      return;
    }
  } catch {
    await ctx.reply('Could not read your image. Please send a valid photo.');
    resetSession(chatId);
    return;
  }

  // M1 + M7: Validate image is actually a garment (not meme, NSFW, screenshot, etc.)
  const mimeType = getMimeType(garmentFilename);
  const isGarment = await isGarmentImage(garmentBuffer, mimeType);
  if (!isGarment) {
    await ctx.reply('This doesn\'t look like a clothing garment. Please send a photo of a shirt, pants, dress, etc.');
    resetSession(chatId);
    return;
  }

  // Check and deduct 1 credit atomically (prevents race condition)
  const credited = await db('users')
    .where({ id: session.userId })
    .where('free_credits_remaining', '>', 0)
    .decrement('free_credits_remaining', 1);

  if (!credited) {
    await ctx.reply('You have used all your free generations. Contact us for more credits.');
    resetSession(chatId);
    return;
  }

  // V3: Track whether AI generation succeeded (separate from delivery)
  let aiSucceeded = false;
  let creditRefunded = false;

  const updatedUser = await db('users').where({ id: session.userId }).first();
  const remaining = updatedUser?.free_credits_remaining ?? 0;
  await ctx.reply(`Generating your catalog... This takes 15-30 seconds.\n(${remaining} free generation${remaining === 1 ? '' : 's'} remaining)`);

  try {
    let sentCount = 0;

    await createCatalogProgressive(
      db,
      storage,
      {
        userId: session.userId,
        garmentBuffer,
        garmentFilename,
        category: session.category,
      },
      async (job, poseLabel, _completed, _total) => {
        aiSucceeded = true;
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
          console.error('[bot] Failed to send image (delivery failure):', err instanceof Error ? err.message : err);
        }
      },
    );

    if (!aiSucceeded) {
      await refundCredit(db, session.userId);
      creditRefunded = true;
      await ctx.reply('Generation failed. Your credit has been refunded. Please try again.');
    } else if (sentCount === 0) {
      await ctx.reply('Your catalog was generated but delivery failed. Please try again.');
    } else {
      await ctx.reply('Done! Your catalog photo is ready.');
    }
  } catch (err) {
    console.error('[bot] Catalog generation failed:', err instanceof Error ? err.message : err);
    if (!aiSucceeded && !creditRefunded) {
      await refundCredit(db, session.userId);
    }
    await ctx.reply('Sorry, something went wrong. Your credit has been refunded. Please try again.');
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
