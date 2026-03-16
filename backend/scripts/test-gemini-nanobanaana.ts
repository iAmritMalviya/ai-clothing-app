import { GoogleGenAI } from '@google/genai';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const GEMINI_KEY = process.env.GEMINI_API_KEY!;
const genai = new GoogleGenAI({ apiKey: GEMINI_KEY });

const GARMENT_PATH = join(import.meta.dirname, '..', 'uploads', 'inputs', 'cce225ae-0797-4248-a3f9-21f8286c6da2.jpeg');
const REFERENCE_PATH = join(import.meta.dirname, '..', 'uploads', 'model-presets', 'male-1.png');
const OUTPUT_PATH = join(import.meta.dirname, '..', 'uploads', 'outputs', 'gemini-nanobanaana-test.png');

async function test() {
  console.log('Reading images...');
  const [garmentBuffer, referenceBuffer] = await Promise.all([
    readFile(GARMENT_PATH),
    readFile(REFERENCE_PATH),
  ]);

  console.log(`Garment: ${(garmentBuffer.length / 1024).toFixed(0)} KB`);
  console.log(`Reference: ${(referenceBuffer.length / 1024).toFixed(0)} KB`);
  console.log('\nCalling gemini-3.1-flash-image-preview...');

  const start = Date.now();

  const response = await genai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: garmentBuffer.toString('base64'),
              mimeType: 'image/jpeg',
            },
          },
          {
            inlineData: {
              data: referenceBuffer.toString('base64'),
              mimeType: 'image/png',
            },
          },
          {
            text: `Professional e-commerce catalog photo. Create a photorealistic image of a young Indian male model wearing the garment from the first image. Requirements:
- Model: realistic young Indian man (25-30 years), AI-generated face, clean studio look
- Garment: reproduce EXACTLY — same color, pattern, texture, logo, design, fit from the first image
- Pose and setting: use the second image as reference for body pose and studio background
- Background: clean white studio background, soft even lighting
- Output: professional Myntra/Ajio style catalog photo, full body from head to mid-thigh, sharp focus`,
          },
        ],
      },
    ],
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  });

  const elapsed = Date.now() - start;
  console.log(`\nResponse in ${elapsed}ms`);

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  console.log(`Parts returned: ${parts.length}`);

  for (const part of parts) {
    if (part.text) {
      console.log('Text:', part.text.slice(0, 100));
    }
    if (part.inlineData?.data) {
      const buffer = Buffer.from(part.inlineData.data, 'base64');
      await writeFile(OUTPUT_PATH, buffer);
      console.log(`\nImage saved: ${OUTPUT_PATH} (${(buffer.length / 1024).toFixed(0)} KB)`);
    }
  }
}

test().catch((err) => {
  console.error('\nERROR:', err.message ?? err);
  if (err.message?.includes('429') || err.message?.includes('quota')) {
    console.error('→ Rate limited / quota exceeded');
  }
  process.exit(1);
});
