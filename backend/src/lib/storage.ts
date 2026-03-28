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
      const fullPath = resolve(join(uploadDir, relativePath));
      if (!fullPath.startsWith(uploadDir)) return;
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
  if (url.startsWith(prefix)) {
    return url.slice(prefix.length);
  }
  // Handle relative /uploads/ paths
  if (url.startsWith('/uploads/')) {
    return url.slice('/uploads/'.length);
  }
  return url;
}

export async function readLocalFile(relativePath: string): Promise<Buffer> {
  const uploadDir = resolve(config.uploadDir);
  const fullPath = resolve(join(uploadDir, relativePath));
  // Prevent path traversal — resolved path must stay within uploads dir
  if (!fullPath.startsWith(uploadDir)) {
    throw new Error('Invalid file path');
  }
  return readFile(fullPath);
}

export function getMimeType(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return 'image/jpeg';
  const ext = filename.slice(dotIndex).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] ?? 'image/jpeg';
}
