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

    // Cleanup stale processing jobs from previous crashes (prevent credit loss)
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
    const staleCount = await db('jobs')
      .where('status', 'processing')
      .where('created_at', '<', staleThreshold)
      .update({ status: 'failed' });
    if (staleCount > 0) {
      console.log(`[cleanup] Marked ${staleCount} stale processing jobs as failed`);
    }

    await startBot(app, db, storage);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Received signal, shutting down');
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
