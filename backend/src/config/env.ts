import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  host: string;
  nodeEnv: 'development' | 'production' | 'test';
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  falApiKey: string;
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

export const config: Config = {
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  host: process.env['HOST'] ?? '0.0.0.0',
  nodeEnv: (process.env['NODE_ENV'] as Config['nodeEnv']) ?? 'development',
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
  falApiKey: requireEnv('FAL_KEY'),
  uploadDir: process.env['UPLOAD_DIR'] ?? './uploads',
  maxFileSize: parseInt(process.env['MAX_FILE_SIZE'] ?? String(10 * 1024 * 1024), 10),
  publicUrl: process.env['PUBLIC_URL'] ?? 'http://localhost:3001',
};
