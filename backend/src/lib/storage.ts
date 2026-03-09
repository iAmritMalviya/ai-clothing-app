import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
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

// --- Shared helpers ---

export function relativePathFromUrl(url: string): string {
  const prefix = `${config.publicUrl}/uploads/`;
  return url.replace(prefix, '');
}

export async function readLocalFile(relativePath: string): Promise<Buffer> {
  const fullPath = join(resolve(config.uploadDir), relativePath);
  return readFile(fullPath);
}

export function getMimeType(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] ?? 'image/jpeg';
}
