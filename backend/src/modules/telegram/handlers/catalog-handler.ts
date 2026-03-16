import type { Context } from 'grammy';
import type { Knex } from 'knex';
import type { StorageProvider } from '../../../lib/storage.js';
import { relativePathFromUrl, readLocalFile } from '../../../lib/storage.js';
import { createCatalogProgressive } from '../../tryon/services/tryon-service.js';
import { getSession, resetSession } from '../session.js';
import { InputFile } from 'grammy';

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

  session.state = 'generating';

  await ctx.reply('Generating your catalog... This takes 20-60 seconds.');

  try {
    // Download the garment photo from Telegram
    const file = await ctx.api.getFile(session.photoFileId);
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('Failed to download photo from Telegram');
    const garmentBuffer = Buffer.from(await response.arrayBuffer());
    const garmentFilename = file.file_path ?? 'garment.jpg';

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
      async (job, poseLabel, completed, total) => {
        try {
          const outputUrl = job['output_image_url'] as string | undefined;
          if (!outputUrl) return;

          const relativePath = relativePathFromUrl(outputUrl);
          const imageBuffer = await readLocalFile(relativePath);

          await ctx.replyWithPhoto(new InputFile(imageBuffer, `${poseLabel}.png`), {
            caption: `${poseLabel} (${completed}/${total})`,
          });
          sentCount++;
        } catch (err) {
          console.error(`[bot] Failed to send image for pose "${poseLabel}":`, err);
        }
      },
    );

    const total = sentCount + (4 - sentCount); // presets count is typically 4
    if (sentCount === 0) {
      await ctx.reply('Generation failed. Please try again later.');
    } else if (sentCount < total) {
      await ctx.reply(`Done! ${sentCount} photos generated. ${total - sentCount} failed.`);
    } else {
      await ctx.reply(`Done! ${sentCount}/${sentCount} photos generated.`);
    }
  } catch (err) {
    console.error('[bot] Catalog generation failed:', err);
    await ctx.reply('Sorry, something went wrong during generation. Please try again.');
  } finally {
    resetSession(chatId);
  }
}
