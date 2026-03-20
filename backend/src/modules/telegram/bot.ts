import { Bot, InlineKeyboard, webhookCallback } from 'grammy';
import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import type { FastifyInstance } from 'fastify';
import type { StorageProvider } from '../../lib/storage.js';
import { config } from '../../config/env.js';
import { getSession, resetSession, getBackgroundPref, setBackgroundPref } from './session.js';
import { findOrCreateByTelegramId } from './services/telegram-user-service.js';
import { handleCatalogGeneration } from './handlers/catalog-handler.js';
import { ALL_BACKGROUNDS } from '../../lib/background-prompts.js';
import { msg, setLang, getLang } from './i18n.js';

import type { Context } from 'grammy';

// Your Telegram ID — receives approval requests
const ADMIN_CHAT_ID = 679598242;

// Check if user is approved
async function checkApproval(db: Knex, userId: string): Promise<boolean> {
  const user = await db('users').where({ id: userId }).first();
  return user?.is_approved === true;
}

// Shared logic for handling any image input
async function handleImageInput(
  ctx: Context,
  fileId: string,
  db: Knex,
  storage: StorageProvider,
  bot: Bot,
): Promise<void> {
  if (!ctx.chat || !ctx.from) return;
  const chatId = ctx.chat.id;
  const session = getSession(chatId);

  if (session.state === 'generating') {
    await ctx.reply(msg(chatId, 'wait_generating'));
    return;
  }

  const displayName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');
  const user = await findOrCreateByTelegramId(db, ctx.from.id, displayName);

  // Check if user is approved
  const approved = await checkApproval(db, user.id);
  if (!approved) {
    const lang = getLang(chatId);
    const waitMsg = lang === 'hi'
      ? 'Aapka account abhi approve nahi hua hai. Admin ko request bhej di gayi hai. Thoda wait karo.'
      : 'Your account is pending approval. A request has been sent to the admin. Please wait.';
    await ctx.reply(waitMsg);

    // Notify admin
    const approveKeyboard = new InlineKeyboard()
      .text('Approve', `approve:${ctx.from.id}`)
      .text('Reject', `reject:${ctx.from.id}`);

    await bot.api.sendMessage(
      ADMIN_CHAT_ID,
      `New user wants access:\n\nName: ${displayName}\nTelegram: @${ctx.from.username ?? 'N/A'}\nID: ${ctx.from.id}`,
      { reply_markup: approveKeyboard },
    );
    return;
  }

  session.state = 'generating';
  session.photoFileId = fileId;
  session.userId = user.id;
  session.category = 'auto';

  handleCatalogGeneration(ctx, db, storage).catch((err) => {
    console.error('[bot] Catalog generation error:', err);
  });
}

function setupHandlers(bot: Bot, db: Knex, storage: StorageProvider): void {

  // /start
  bot.command('start', async (ctx) => {
    resetSession(ctx.chat.id);
    await ctx.reply(msg(ctx.chat.id, 'welcome'));
  });

  // /help
  bot.command('help', async (ctx) => {
    await ctx.reply(msg(ctx.chat.id, 'help'));
  });

  // /credits — show credit usage
  bot.command('credits', async (ctx) => {
    if (!ctx.from) return;
    const user = await db('users').where({ telegram_id: ctx.from.id }).first();
    if (!user) {
      await ctx.reply(msg(ctx.chat.id, 'send_photo'));
      return;
    }

    const remaining = user.free_credits_remaining ?? 0;
    const totalJobs = await db('jobs')
      .where({ user_id: user.id, type: 'tryon', status: 'completed' })
      .count('id as count')
      .first();
    const used = Number(totalJobs?.count ?? 0);

    const lang = getLang(ctx.chat.id);
    const text = lang === 'hi'
      ? `📊 Credit Status\n\n✅ Used: ${used} generation${used === 1 ? '' : 's'}\n💳 Remaining: ${remaining} credit${remaining === 1 ? '' : 's'}\n\nAur credits chahiye? Contact @moonknightt`
      : `📊 Credit Status\n\n✅ Used: ${used} generation${used === 1 ? '' : 's'}\n💳 Remaining: ${remaining} credit${remaining === 1 ? '' : 's'}\n\nNeed more credits? Contact @moonknightt`;

    await ctx.reply(text);
  });

  // /language — switch between English and Hinglish
  bot.command('language', async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text('English', 'lang:en')
      .text('Hinglish', 'lang:hi');

    await ctx.reply(msg(ctx.chat.id, 'language_choose'), { reply_markup: keyboard });
  });

  bot.callbackQuery(/^lang:(.+)$/, async (ctx) => {
    const lang = ctx.match[1] as 'en' | 'hi';
    setLang(ctx.chat!.id, lang);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(msg(ctx.chat!.id, 'language_switched'));
  });

  // /setbackground — show background options
  bot.command('setbackground', async (ctx) => {
    const chatId = ctx.chat.id;
    const keyboard = new InlineKeyboard();
    ALL_BACKGROUNDS.forEach((bg, i) => {
      keyboard.text(bg.label, `bg:${bg.id}`);
      if (i % 2 === 1) keyboard.row();
    });

    const current = getBackgroundPref(chatId);
    const currentLabel = current
      ? ALL_BACKGROUNDS.find(b => b.id === current)?.label ?? 'Studio White'
      : 'Studio White';

    const msgFn = getLang(chatId) === 'hi'
      ? `Abhi ka background: ${currentLabel}\n\nNaya background chuno:`
      : `Current background: ${currentLabel}\n\nChoose a new background:`;

    await ctx.reply(msgFn, { reply_markup: keyboard });
  });

  // Background selection callback
  bot.callbackQuery(/^bg:(.+)$/, async (ctx) => {
    const bgId = ctx.match[1];
    const bg = ALL_BACKGROUNDS.find(b => b.id === bgId);
    if (!bg) {
      await ctx.answerCallbackQuery('Background not found.');
      return;
    }

    const chatId = ctx.chat!.id;
    setBackgroundPref(chatId, bgId);
    await ctx.answerCallbackQuery(`Background: ${bg.label}`);

    const reply = getLang(chatId) === 'hi'
      ? `Background set ho gaya: ${bg.label}\n\nAb garment ki photo bhejo!`
      : `Background set to: ${bg.label}\n\nNow send a garment photo to generate!`;
    await ctx.editMessageText(reply);
  });

  // Admin: approve/reject user
  bot.callbackQuery(/^approve:(\d+)$/, async (ctx) => {
    const telegramId = parseInt(ctx.match[1]);
    await db('users').where({ telegram_id: telegramId }).update({ is_approved: true });
    await ctx.answerCallbackQuery('User approved!');
    await ctx.editMessageText(ctx.msg?.text + '\n\n✅ APPROVED');

    // Notify the user
    try {
      await bot.api.sendMessage(telegramId, getLang(telegramId) === 'hi'
        ? 'Aapka account approve ho gaya hai! Ab garment ki photo bhejo.'
        : 'Your account has been approved! Send a garment photo to get started.');
    } catch { /* user may have blocked bot */ }
  });

  bot.callbackQuery(/^reject:(\d+)$/, async (ctx) => {
    const telegramId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery('User rejected.');
    await ctx.editMessageText(ctx.msg?.text + '\n\n❌ REJECTED');
  });

  // Photo handler
  bot.on('message:photo', async (ctx) => {
    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];
    await handleImageInput(ctx, largestPhoto.file_id, db, storage, bot);
  });

  // Sticker/WebP handler
  bot.on('message:sticker', async (ctx) => {
    const sticker = ctx.message.sticker;
    if (sticker.is_animated || sticker.is_video) {
      await ctx.reply(msg(ctx.chat.id, 'not_animated'));
      return;
    }
    await handleImageInput(ctx, sticker.file_id, db, storage, bot);
  });

  // Document handler
  bot.on('message:document', async (ctx) => {
    const doc = ctx.message.document;
    const mime = doc.mime_type ?? '';
    if (!mime.startsWith('image/')) {
      await ctx.reply(msg(ctx.chat.id, 'not_image'));
      return;
    }
    await handleImageInput(ctx, doc.file_id, db, storage, bot);
  });

  // Catch-all
  bot.on('message', async (ctx) => {
    const session = getSession(ctx.chat.id);
    if (session.state === 'generating') {
      await ctx.reply(msg(ctx.chat.id, 'wait_generating'));
      return;
    }
    await ctx.reply(msg(ctx.chat.id, 'send_photo'));
  });

  // Error handler
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

  // Register commands in Telegram's menu
  await bot.api.setMyCommands([
    { command: 'start', description: 'Start the bot' },
    { command: 'credits', description: 'Check your credits' },
    { command: 'setbackground', description: 'Choose background style' },
    { command: 'language', description: 'Switch language' },
    { command: 'help', description: 'How to use' },
  ]);

  const webhookUrl = config.telegramWebhookUrl;

  if (webhookUrl) {
    const webhookSecret = randomUUID();
    const handleUpdate = webhookCallback(bot, 'std/http');

    app.post('/telegram/webhook', async (request, reply) => {
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

    await bot.api.setWebhook(webhookUrl, {
      secret_token: webhookSecret,
      drop_pending_updates: true,
    });
    console.log(`[bot] ModelWalaBot webhook set → ${webhookUrl}`);
  } else {
    bot.start({
      onStart: () => {
        console.log('[bot] ModelWalaBot started (long polling)');
      },
    });
  }
}
