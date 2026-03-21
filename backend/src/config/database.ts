import type { Knex } from 'knex';

const baseConfig: Knex.Config = {
  client: 'pg',
  migrations: {
    directory: './migrations',
    extension: 'ts',
  },
  pool: {
    min: 2,
    max: 10,
  },
};

export const databaseConfig: Record<string, Knex.Config> = {
  development: {
    ...baseConfig,
    connection: process.env['DATABASE_URL'],
  },
  production: {
    ...baseConfig,
    connection: {
      connectionString: process.env['DATABASE_URL'],
      ssl: { rejectUnauthorized: false },
    },
    pool: {
      min: 1,
      max: 5, // Neon free tier connection limit
    },
  },
  test: {
    ...baseConfig,
    connection: process.env['DATABASE_URL'],
  },
};

export function getKnexConfig(): Knex.Config {
  const env = process.env['NODE_ENV'] ?? 'development';
  return databaseConfig[env] ?? databaseConfig['development']!;
}
