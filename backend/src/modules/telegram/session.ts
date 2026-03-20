import type { GarmentCategory } from '../../lib/ai-client.js';

export type SessionState =
  | 'idle'
  | 'awaiting_category'
  | 'generating';

// Background preference persists across sessions (not affected by TTL)
const backgroundPrefs = new Map<number, string>();

export function getBackgroundPref(chatId: number): string | undefined {
  return backgroundPrefs.get(chatId);
}

export function setBackgroundPref(chatId: number, backgroundId: string): void {
  backgroundPrefs.set(chatId, backgroundId);
}

export interface BotSession {
  state: SessionState;
  photoFileId?: string;
  category?: GarmentCategory;
  userId?: string;
  createdAt: number;
}

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const sessions = new Map<number, BotSession>();

export function getSession(chatId: number): BotSession {
  let session = sessions.get(chatId);

  // Expire stale sessions
  if (session && Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(chatId);
    session = undefined;
  }

  if (!session) {
    session = { state: 'idle', createdAt: Date.now() };
    sessions.set(chatId, session);
  }
  return session;
}

export function resetSession(chatId: number): void {
  sessions.set(chatId, { state: 'idle', createdAt: Date.now() });
}

// Periodic cleanup every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [chatId, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(chatId);
    }
  }
}, 10 * 60 * 1000);
