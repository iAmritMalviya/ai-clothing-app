import type { Context } from 'grammy';
import type { Knex } from 'knex';
import type { StorageProvider } from '../../../lib/storage.js';
import { relativePathFromUrl, readLocalFile, getMimeType } from '../../../lib/storage.js';
import { createCatalogProgressive } from '../../tryon/services/tryon-service.js';
import { getSession, resetSession, getBackgroundPref, getCatalogCount } from '../session.js';
import { validateAndClassifyGarment } from '../validators/image-validator.js';
import { InputFile } from 'grammy';
import { msg, getLang } from '../i18n.js';
import sharp from 'sharp';

const GENERATION_COOLDOWN_MS = 30_000;

function logError(stage: string, chatId: number, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(JSON.stringify({
    level: 'error',
    tag: 'bot',
    stage,
    chatId,
    error: message,
    stack: stack?.split('\n').slice(0, 3).join(' | '),
    timestamp: new Date().toISOString(),
  }));
}

export async function handleCatalogGeneration(
  ctx: Context,
  db: Knex,
  storage: StorageProvider,
): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const session = getSession(chatId);
  if (!session.photoFileId || !session.category || !session.userId) {
    console.error(JSON.stringify({ level: 'error', tag: 'bot', stage: 'session_invalid', chatId, session: { hasPhoto: !!session.photoFileId, hasCategory: !!session.category, hasUser: !!session.userId } }));
    await ctx.reply(msg(chatId, 'something_wrong'));
    resetSession(chatId);
    return;
  }

  // V6: Rate limit
  const lastJob = await db('jobs')
    .where({ user_id: session.userId, type: 'tryon' })
    .whereNotNull('completed_at')
    .orderBy('completed_at', 'desc')
    .first();
  if (lastJob && Date.now() - new Date(lastJob.completed_at).getTime() < GENERATION_COOLDOWN_MS) {
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
    if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
    garmentBuffer = Buffer.from(await response.arrayBuffer());
    garmentFilename = file.file_path ?? 'garment.jpg';
    console.log(JSON.stringify({ level: 'info', tag: 'bot', stage: 'download_ok', chatId, fileSize: garmentBuffer.length }));
  } catch (err) {
    logError('download_failed', chatId, err);
    await ctx.reply(msg(chatId, 'download_failed'));
    resetSession(chatId);
    return;
  }

  // M8: Validate image format
  await updateProgress(msg(chatId, 'progress_validate'), 20);
  try {
    const metadata = await sharp(garmentBuffer).metadata();
    if (!metadata.format || !['jpeg', 'png', 'webp', 'gif'].includes(metadata.format)) {
      console.log(JSON.stringify({ level: 'warn', tag: 'bot', stage: 'invalid_format', chatId, format: metadata.format }));
      await ctx.reply(msg(chatId, 'invalid_image'));
      resetSession(chatId);
      return;
    }
  } catch (err) {
    logError('sharp_validation', chatId, err);
    await ctx.reply(msg(chatId, 'invalid_image'));
    resetSession(chatId);
    return;
  }

  // M1: Validate garment + auto-detect category
  const mimeType = getMimeType(garmentFilename);
  const classification = await validateAndClassifyGarment(garmentBuffer, mimeType);
  if (!classification.isGarment) {
    console.log(JSON.stringify({ level: 'info', tag: 'bot', stage: 'not_garment', chatId }));
    await ctx.reply(msg(chatId, 'not_garment'));
    resetSession(chatId);
    return;
  }

  // Check gender
  if (classification.gender === 'female' || classification.gender === 'kids') {
    console.log(JSON.stringify({ level: 'info', tag: 'bot', stage: 'gender_rejected', chatId, gender: classification.gender }));
    const genderMsg = getLang(chatId) === 'hi'
      ? `Abhi sirf male clothing support hai. Female aur kids collection jaldi aa raha hai — stay tuned! 🔜`
      : `Currently only male clothing is supported. Female and kids collection coming soon — stay tuned! 🔜`;
    await ctx.reply(genderMsg);
    resetSession(chatId);
    return;
  }

  session.category = classification.category;
  console.log(JSON.stringify({ level: 'info', tag: 'bot', stage: 'classified', chatId, category: classification.category, gender: classification.gender }));

  await updateProgress(msg(chatId, 'progress_verified'), 40);

  const catalogCount = getCatalogCount(chatId);

  // Check credits
  const userCheck = await db('users').where({ id: session.userId }).first();
  if (!userCheck || userCheck.free_credits_remaining < catalogCount) {
    console.log(JSON.stringify({ level: 'warn', tag: 'bot', stage: 'insufficient_credits', chatId, needed: catalogCount, have: userCheck?.free_credits_remaining ?? 0 }));
    const lang = getLang(chatId);
    const text = lang === 'hi'
      ? `Credits kam hain. ${catalogCount} photos ke liye ${catalogCount} credits chahiye, aapke paas ${userCheck?.free_credits_remaining ?? 0} hai.`
      : `Not enough credits. ${catalogCount} photos need ${catalogCount} credits, you have ${userCheck?.free_credits_remaining ?? 0}.`;
    await ctx.reply(text);
    resetSession(chatId);
    return;
  }

  // Deduct credits
  const credited = await db('users')
    .where({ id: session.userId })
    .where('free_credits_remaining', '>=', catalogCount)
    .decrement('free_credits_remaining', catalogCount);

  if (!credited) {
    await ctx.reply(msg(chatId, 'no_credits'));
    resetSession(chatId);
    return;
  }

  let aiSucceeded = false;
  let creditRefunded = false;
  const creditsDeducted = catalogCount;

  const updatedUser = await db('users').where({ id: session.userId }).first();
  const remaining = updatedUser?.free_credits_remaining ?? 0;

  const lang = getLang(chatId);
  const genMsg = lang === 'hi'
    ? `${catalogCount} photo${catalogCount > 1 ? 's' : ''} ban rahi hai... ${catalogCount > 1 ? '1-2 minute' : '15-30 second'} lagenge.\n(${remaining} credit${remaining === 1 ? '' : 's'} baaki hai)`
    : `Generating ${catalogCount} photo${catalogCount > 1 ? 's' : ''}... ${catalogCount > 1 ? 'This takes 1-2 minutes' : 'This takes 15-30 seconds'}.\n(${remaining} credit${remaining === 1 ? '' : 's'} remaining)`;
  await updateProgress(genMsg, 50);

  console.log(JSON.stringify({ level: 'info', tag: 'bot', stage: 'generation_start', chatId, count: catalogCount, category: session.category, creditsDeducted }));

  try {
    let sentCount = 0;

    const genStart = Date.now();
    progressTimer = setInterval(() => {
      const elapsed = Date.now() - genStart;
      const percent = Math.min(90, 50 + Math.round((elapsed / 25000) * 40));
      updateProgress(msg(chatId, 'progress_generating'), percent).catch(() => {});
    }, 5000);

    const genResult = await createCatalogProgressive(
      db,
      storage,
      {
        userId: session.userId,
        garmentBuffer,
        garmentFilename,
        category: session.category,
        backgroundId: getBackgroundPref(chatId) ?? undefined,
        count: catalogCount,
      },
      async (job, poseLabel, _completed, _total) => {
        aiSucceeded = true;
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
          console.log(JSON.stringify({ level: 'info', tag: 'bot', stage: 'image_sent', chatId, pose: poseLabel, timeMs: Date.now() - genStart }));
        } catch (err) {
          logError('delivery_failed', chatId, err);
        }
      },
    );

    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }

    console.log(JSON.stringify({ level: 'info', tag: 'bot', stage: 'generation_done', chatId, completed: genResult.completedCount, failed: genResult.failedCount, sent: sentCount, timeMs: Date.now() - genStart }));

    // Refund for partial failures
    if (genResult.failedCount > 0 && genResult.completedCount > 0) {
      await refundCredit(db, session.userId, genResult.failedCount);
      const partialMsg = getLang(chatId) === 'hi'
        ? `(${genResult.failedCount} photo fail, ${genResult.failedCount} credit wapas)`
        : `(${genResult.failedCount} failed, ${genResult.failedCount} credit${genResult.failedCount > 1 ? 's' : ''} refunded)`;
      await ctx.reply(partialMsg);
    }

    if (!aiSucceeded) {
      await refundCredit(db, session.userId, creditsDeducted);
      creditRefunded = true;
      await updateProgress(msg(chatId, 'generation_failed'), 0);
      await ctx.reply(msg(chatId, 'generation_failed'));
    } else if (sentCount === 0) {
      await refundCredit(db, session.userId, creditsDeducted);
      await updateProgress(msg(chatId, 'delivery_failed'), 0);
      await ctx.reply(msg(chatId, 'delivery_failed'));
    } else {
      const doneMsg = getLang(chatId) === 'hi'
        ? `✅ ${sentCount} catalog photo${sentCount > 1 ? 's' : ''} taiyaar hai!`
        : `✅ ${sentCount} catalog photo${sentCount > 1 ? 's' : ''} ready!`;
      await ctx.reply(doneMsg);
    }
  } catch (err) {
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    logError('generation_crash', chatId, err);
    if (!aiSucceeded && !creditRefunded) {
      await refundCredit(db, session.userId, creditsDeducted);
    }
    await ctx.reply(msg(chatId, 'error'));
  } finally {
    resetSession(chatId);
  }
}

async function refundCredit(db: Knex, userId: string, amount = 1): Promise<void> {
  try {
    await db('users').where({ id: userId }).increment('free_credits_remaining', amount);
    console.log(JSON.stringify({ level: 'info', tag: 'bot', stage: 'credit_refunded', userId, amount }));
  } catch (refundErr) {
    console.error(JSON.stringify({ level: 'error', tag: 'bot', stage: 'CRITICAL_refund_failed', userId, amount, error: refundErr instanceof Error ? refundErr.message : String(refundErr) }));
  }
}
