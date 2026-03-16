import dotenv from 'dotenv';

dotenv.config();

type AiProvider = 'fal' | 'gemini' | 'nano-banana';

interface Config {
  port: number;
  host: string;
  nodeEnv: 'development' | 'production' | 'test';
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  // AI keys (both optional — only needed for the providers you use)
  falApiKey: string | undefined;
  geminiApiKey: string | undefined;
  // Per-operation provider selection
  aiProviderBgRemoval: AiProvider;
  aiProviderTryOn: AiProvider;
  aiProviderSceneGen: AiProvider;
  telegramBotToken: string | undefined;
  telegramWebhookUrl: string | undefined;
  uploadDir: string;
  maxFileSize: number;
  publicUrl: string;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function parseProvider(envValue: string | undefined, fallback: AiProvider): AiProvider {
  if (envValue === 'fal' || envValue === 'gemini' || envValue === 'nano-banana') return envValue;
  return fallback;
}

export const config: Config = {
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  host: process.env['HOST'] ?? '0.0.0.0',
  nodeEnv: (process.env['NODE_ENV'] as Config['nodeEnv']) ?? 'development',
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
  falApiKey: process.env['FAL_KEY'],
  geminiApiKey: process.env['GEMINI_API_KEY'],
  telegramBotToken: process.env['TELEGRAM_BOT_TOKEN'],
  telegramWebhookUrl: process.env['TELEGRAM_WEBHOOK_URL'],
  aiProviderBgRemoval: parseProvider(process.env['AI_PROVIDER_BG_REMOVAL'], 'fal'),
  aiProviderTryOn: parseProvider(process.env['AI_PROVIDER_TRYON'], 'fal'),
  aiProviderSceneGen: parseProvider(process.env['AI_PROVIDER_SCENE_GEN'], 'gemini'),
  uploadDir: process.env['UPLOAD_DIR'] ?? './uploads',
  maxFileSize: parseInt(process.env['MAX_FILE_SIZE'] ?? String(10 * 1024 * 1024), 10),
  publicUrl: process.env['PUBLIC_URL'] ?? 'http://localhost:3001',
};

// Validate that required API keys are set for the configured providers
const providers = new Set([config.aiProviderBgRemoval, config.aiProviderTryOn, config.aiProviderSceneGen]);
if ((providers.has('fal') || providers.has('nano-banana')) && !config.falApiKey) {
  throw new Error('FAL_KEY is required when using fal.ai or nano-banana as an AI provider');
}
if (providers.has('gemini') && !config.geminiApiKey) {
  throw new Error('GEMINI_API_KEY is required when using Gemini as an AI provider');
}
