import { Bot, InlineKeyboard, webhookCallback } from 'grammy';
import type { Knex } from 'knex';
import type { FastifyInstance } from 'fastify';
import type { StorageProvider } from '../../lib/storage.js';
import { config } from '../../config/env.js';
import { getSession, resetSession } from './session.js';
import { findOrCreateByTelegramId } from './services/telegram-user-service.js';
import { handleCatalogGeneration } from './handlers/catalog-handler.js';
import type { GarmentCategory } from '../../lib/ai-client.js';

const CATEGORY_KEYBOARD = new InlineKeyboard()
  .text('Auto', 'cat:auto')
  .text('Tops', 'cat:tops')
  .text('Bottoms', 'cat:bottoms')
  .text('One-Pieces', 'cat:one-pieces');

function setupHandlers(bot: Bot, db: Knex, storage: StorageProvider): void {

  // /start command
  bot.command('start', async (ctx) => {
    resetSession(ctx.chat.id);
    await ctx.reply(
      'Welcome to ModelWalaBot!\n\n' +
      'Send me a photo of any garment and I\'ll generate professional catalog photos with AI models wearing it.\n\n' +
      'Just send a photo to get started!',
    );
  });

  // /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      'How to use ModelWalaBot:\n\n' +
      '1. Send a garment photo (shirt, t-shirt, pants, etc.)\n' +
      '2. Choose the garment category\n' +
      '3. Wait for your catalog photos!\n\n' +
      'Each generation creates 4 photos in different poses.',
    );
  });

  // Photo handler
  bot.on('message:photo', async (ctx) => {
    const session = getSession(ctx.chat.id);

    if (session.state === 'generating') {
      await ctx.reply('Please wait — a catalog is already being generated. I\'ll let you know when it\'s done.');
      return;
    }

    // Get the largest photo (last in array)
    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];

    // Ensure user exists in DB
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const displayName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');
    const user = await findOrCreateByTelegramId(db, telegramId, displayName);

    // Update session
    session.state = 'awaiting_category';
    session.photoFileId = largestPhoto.file_id;
    session.userId = user.id;

    await ctx.reply('What type of garment is this?', {
      reply_markup: CATEGORY_KEYBOARD,
    });
  });

  // Callback query: category selection → start generation immediately (AI background)
  bot.callbackQuery(/^cat:(.+)$/, async (ctx) => {
    const session = getSession(ctx.chat!.id);

    if (session.state !== 'awaiting_category') {
      await ctx.answerCallbackQuery('Send a garment photo first.');
      return;
    }

    const category = ctx.match[1] as GarmentCategory;
    session.category = category;
    session.backgroundHex = null; // AI background only for now

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `Category: ${category.charAt(0).toUpperCase() + category.slice(1)}\n\nStarting generation...`,
    );

    // Fire off catalog generation without blocking the webhook response
    handleCatalogGeneration(ctx, db, storage).catch((err) => {
      console.error('[bot] Catalog generation error:', err);
    });
  });

  // Catch-all for non-photo messages
  bot.on('message', async (ctx) => {
    const session = getSession(ctx.chat.id);
    if (session.state === 'generating') {
      await ctx.reply('Please wait — your catalog is being generated.');
      return;
    }
    await ctx.reply('Send me a photo of a garment to generate catalog images.');
  });

  // Error handler
  bot.catch((err) => {
    console.error('[bot] Error:', err.error);
  });
}

export async function startBot(
  app: FastifyInstance,
  db: Knex,
  storage: StorageProvider,
): Promise<void> {
  if (!config.telegramBotToken) {
    console.log('[bot] TELEGRAM_BOT_TOKEN not set — skipping bot startup');
    return;
  }

  const bot = new Bot(config.telegramBotToken);
  setupHandlers(bot, db, storage);

  const webhookUrl = config.telegramWebhookUrl;

  if (webhookUrl) {
    // Webhook mode — register Fastify route + set webhook with Telegram
    const handleUpdate = webhookCallback(bot, 'std/http');

    app.post('/telegram/webhook', async (request, reply) => {
      const req = new Request(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request.body),
      });
      const res = await handleUpdate(req);
      reply.status(res.status);
      reply.send(await res.text());
    });

    await bot.api.setWebhook(webhookUrl);
    console.log(`[bot] ModelWalaBot webhook set → ${webhookUrl}`);
  } else {
    // Long polling fallback
    bot.start({
      onStart: () => {
        console.log('[bot] ModelWalaBot started (long polling)');
      },
    });
  }
}
