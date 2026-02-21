import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config/env.js';

export interface StorageProvider {
  save(buffer: Buffer, subfolder: string, extension: string): Promise<string>;
  getUrl(relativePath: string): string;
  remove(relativePath: string): Promise<void>;
}

function createLocalStorage(): StorageProvider {
  const uploadDir = resolve(config.uploadDir);

  return {
    async save(buffer, subfolder, extension) {
      const filename = `${randomUUID()}${extension}`;
      const relativePath = join(subfolder, filename);
      const fullPath = join(uploadDir, relativePath);

      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, buffer);

      return relativePath;
    },

    getUrl(relativePath) {
      return `${config.publicUrl}/uploads/${relativePath}`;
    },

    async remove(relativePath) {
      const fullPath = join(uploadDir, relativePath);
      await unlink(fullPath).catch(() => {});
    },
  };
}

export function createStorage(): StorageProvider {
  return createLocalStorage();
}
