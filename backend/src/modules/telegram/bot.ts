import { Bot, webhookCallback } from 'grammy';
import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import type { FastifyInstance } from 'fastify';
import type { StorageProvider } from '../../lib/storage.js';
import { config } from '../../config/env.js';
import { getSession, resetSession } from './session.js';
import { findOrCreateByTelegramId } from './services/telegram-user-service.js';
import { handleCatalogGeneration } from './handlers/catalog-handler.js';

import type { Context } from 'grammy';

// Shared logic for handling any image input — goes straight to generation (auto category)
async function handleImageInput(
  ctx: Context,
  fileId: string,
  db: Knex,
  storage: StorageProvider,
): Promise<void> {
  if (!ctx.chat || !ctx.from) return;
  const session = getSession(ctx.chat.id);

  if (session.state === 'generating') {
    await ctx.reply('Please wait — a catalog is already being generated.');
    return;
  }

  const displayName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');
  const user = await findOrCreateByTelegramId(db, ctx.from.id, displayName);

  // Set session and go straight to generation — no category keyboard
  session.state = 'generating';
  session.photoFileId = fileId;
  session.userId = user.id;
  session.category = 'auto';

  // Fire off generation immediately
  handleCatalogGeneration(ctx, db, storage).catch((err) => {
    console.error('[bot] Catalog generation error:', err);
  });
}

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
      '1. Send a garment photo (JPEG, PNG, or WebP)\n' +
      '2. Wait ~15-30 seconds for your catalog photo!\n\n' +
      'You get 2 free generations to try it out.',
    );
  });

  // Photo handler
  bot.on('message:photo', async (ctx) => {
    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];
    await handleImageInput(ctx, largestPhoto.file_id, db, storage);
  });

  // Sticker/WebP handler
  bot.on('message:sticker', async (ctx) => {
    const sticker = ctx.message.sticker;
    if (sticker.is_animated || sticker.is_video) {
      await ctx.reply('Please send a photo of a garment (not an animated sticker).');
      return;
    }
    await handleImageInput(ctx, sticker.file_id, db, storage);
  });

  // Document handler (image sent as file)
  bot.on('message:document', async (ctx) => {
    const doc = ctx.message.document;
    const mime = doc.mime_type ?? '';
    if (!mime.startsWith('image/')) {
      await ctx.reply('Please send an image file (JPEG, PNG, or WebP).');
      return;
    }
    await handleImageInput(ctx, doc.file_id, db, storage);
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

  // Error handler — log message only, not full context (M5: avoid token leakage)
  bot.catch((err) => {
    console.error('[bot] Error:', err.error instanceof Error ? err.error.message : err.error);
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
    // M2: Generate a secret token for webhook authentication
    const webhookSecret = randomUUID();
    const handleUpdate = webhookCallback(bot, 'std/http');

    app.post('/telegram/webhook', async (request, reply) => {
      // M2: Verify Telegram's secret token header
      const secretHeader = request.headers['x-telegram-bot-api-secret-token'];
      if (secretHeader !== webhookSecret) {
        reply.status(403).send('Forbidden');
        return;
      }

      const req = new Request('http://localhost/telegram/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request.body),
      });
      const res = await handleUpdate(req);
      reply.status(res.status);
      reply.send(await res.text());
    });

    // Register webhook with secret token
    await bot.api.setWebhook(webhookUrl, {
      secret_token: webhookSecret,
      drop_pending_updates: true,
    });
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
