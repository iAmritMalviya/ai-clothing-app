import { fal } from '@fal-ai/client';
import { config } from '../config/env.js';

fal.config({ credentials: config.falApiKey });

interface RemoveBackgroundResult {
  buffer: Buffer;
  processingTimeMs: number;
}

export async function removeBackground(
  imageBuffer: Buffer,
  filename: string,
): Promise<RemoveBackgroundResult> {
  const start = Date.now();

  // Upload image to fal.ai storage
  const imageFile = new File(
    [imageBuffer.buffer.slice(imageBuffer.byteOffset, imageBuffer.byteOffset + imageBuffer.byteLength) as ArrayBuffer],
    filename,
    { type: getMimeType(filename) },
  );
  const imageUrl = await fal.storage.upload(imageFile);

  // Run BiRefNet v2 background removal
  const result = await fal.subscribe('fal-ai/birefnet/v2', {
    input: { image_url: imageUrl },
  });

  const processingTimeMs = Date.now() - start;

  // Download the result image
  const outputUrl = result.data.image.url;
  const response = await fetch(outputUrl);
  if (!response.ok) {
    throw new Error(`Failed to download processed image: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    processingTimeMs,
  };
}

export async function generateSceneBackground(prompt: string): Promise<Buffer> {
  const result = await fal.subscribe('fal-ai/flux/schnell', {
    input: {
      prompt,
      image_size: { width: 1024, height: 1024 },
      num_images: 1,
    },
  });

  const imageUrl = (result.data as { images: { url: string }[] }).images[0].url;
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download generated scene: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function getMimeType(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] ?? 'image/jpeg';
}
