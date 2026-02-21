import sharp from 'sharp';

interface CompositeResult {
  buffer: Buffer;
  processingTimeMs: number;
}

export async function compositeOnColor(
  transparentBuffer: Buffer,
  hexColor: string,
): Promise<CompositeResult> {
  const start = Date.now();

  const metadata = await sharp(transparentBuffer).metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r, g, b, alpha: 255 },
    },
  })
    .composite([{ input: transparentBuffer, top: 0, left: 0 }])
    .png()
    .toBuffer();

  return { buffer, processingTimeMs: Date.now() - start };
}

export async function compositeOnImage(
  transparentBuffer: Buffer,
  backgroundBuffer: Buffer,
): Promise<CompositeResult> {
  const start = Date.now();

  const metadata = await sharp(transparentBuffer).metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  // Resize background to match foreground (cover + center crop)
  const resizedBg = await sharp(backgroundBuffer)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  const buffer = await sharp(resizedBg)
    .composite([{ input: transparentBuffer, top: 0, left: 0 }])
    .png()
    .toBuffer();

  return { buffer, processingTimeMs: Date.now() - start };
}
