import { config } from './config/env.js';
import { buildApp } from './app.js';
import { startBot } from './modules/telegram/bot.js';
import { createStorage } from './lib/storage.js';
import knex from 'knex';
import { getKnexConfig } from './config/database.js';

async function start() {
  const app = await buildApp();

  // Set up Telegram bot (registers webhook route before listen)
  if (config.telegramBotToken) {
    const db = knex(getKnexConfig());
    const storage = createStorage();
    await startBot(app, db, storage);
  }

  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
