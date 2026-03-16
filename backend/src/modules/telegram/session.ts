import type { GarmentCategory } from '../../lib/ai-client.js';

export type SessionState =
  | 'idle'
  | 'awaiting_category'
  | 'generating';

export interface BotSession {
  state: SessionState;
  photoFileId?: string;
  category?: GarmentCategory;
  userId?: string;
}

const sessions = new Map<number, BotSession>();

export function getSession(chatId: number): BotSession {
  let session = sessions.get(chatId);
  if (!session) {
    session = { state: 'idle' };
    sessions.set(chatId, session);
  }
  return session;
}

export function resetSession(chatId: number): void {
  sessions.set(chatId, { state: 'idle' });
}
