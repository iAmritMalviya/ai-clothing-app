import { GoogleGenAI } from '@google/genai';
import { fal } from '@fal-ai/client';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const GEMINI_KEY = process.env.GEMINI_API_KEY!;
const FAL_KEY = process.env.FAL_KEY!;
const OUTPUT_DIR = join(import.meta.dirname, '..', 'uploads', 'model-presets');

const PROMPTS = [
  {
    file: 'male-1.png',
    prompt:
      'Professional e-commerce catalog photo of a young Indian man, age 25, medium build, clean shaven, standing straight facing the camera, hands at sides, wearing a plain white crew neck t-shirt and light blue jeans, clean white studio background, soft studio lighting, high resolution fashion photography, full body shot from head to mid-thigh, natural skin texture, no filters',
  },
  {
    file: 'male-2.png',
    prompt:
      'Professional e-commerce catalog photo of a young Indian man, age 27, athletic build, short beard, standing straight facing the camera, one hand in pocket, wearing a plain grey polo shirt and dark navy chinos, clean white studio background, soft studio lighting, high resolution fashion photography, full body shot from head to mid-thigh, natural skin texture, no filters',
  },
  {
    file: 'male-3.png',
    prompt:
      'Professional e-commerce catalog photo of a young Indian man, age 24, slim build, clean shaven, standing straight facing the camera, arms relaxed at sides, wearing a plain light blue button-down shirt with sleeves rolled up and beige trousers, clean white studio background, soft studio lighting, high resolution fashion photography, full body shot from head to mid-thigh, natural skin texture, no filters',
  },
  {
    file: 'male-4.png',
    prompt:
      'Professional e-commerce catalog photo of a young Indian man, age 28, medium build, trimmed stubble, standing straight with slight angle, one hand in pocket, wearing a plain black henley shirt and grey jeans, clean white studio background, soft studio lighting, high resolution fashion photography, full body shot from head to mid-thigh, natural skin texture, no filters',
  },
];

async function generateWithGemini(): Promise<boolean> {
  console.log('Trying Gemini...');
  const genai = new GoogleGenAI({ apiKey: GEMINI_KEY });

  for (const { file, prompt } of PROMPTS) {
    console.log(`  Generating ${file}...`);
    try {
      const response = await genai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.find(
        (p: any) => p.inlineData,
      );
      if (!part?.inlineData?.data) {
        console.log(`  WARNING: No image returned for ${file}, skipping`);
        continue;
      }

      const buffer = Buffer.from(part.inlineData.data, 'base64');
      const outPath = join(OUTPUT_DIR, file);
      await writeFile(outPath, buffer);
      console.log(`  Saved ${file} (${(buffer.length / 1024).toFixed(0)} KB)`);
    } catch (err: any) {
      if (err?.status === 429 || err?.message?.includes('429')) {
        console.log('  Rate limited (429). Gemini quota exhausted.');
        return false;
      }
      console.log(`  Error for ${file}: ${err.message}`);
      return false;
    }
  }

  return true;
}

async function generateWithFalPro(): Promise<boolean> {
  console.log('Trying fal.ai flux-dev (higher quality)...');
  fal.config({ credentials: FAL_KEY });

  for (const { file, prompt } of PROMPTS) {
    console.log(`  Generating ${file}...`);
    try {
      const result = await fal.subscribe('fal-ai/flux/dev', {
        input: {
          prompt,
          image_size: { width: 768, height: 1024 },
          num_inference_steps: 28,
          guidance_scale: 3.5,
        },
      });

      const imageUrl = (result as any).data?.images?.[0]?.url;
      if (!imageUrl) {
        console.log(`  No image URL for ${file}`);
        continue;
      }

      const resp = await fetch(imageUrl);
      const buffer = Buffer.from(await resp.arrayBuffer());
      const outPath = join(OUTPUT_DIR, file);
      await writeFile(outPath, buffer);
      console.log(`  Saved ${file} (${(buffer.length / 1024).toFixed(0)} KB)`);
    } catch (err: any) {
      console.log(`  Error for ${file}: ${err.message}`);
      return false;
    }
  }

  return true;
}

async function main() {
  const geminiOk = await generateWithGemini();
  if (geminiOk) {
    console.log('\nDone — all 4 models generated with Gemini.');
    return;
  }

  console.log('\nFalling back to fal.ai flux-dev...\n');
  const falOk = await generateWithFalPro();
  if (falOk) {
    console.log('\nDone — all 4 models generated with fal.ai flux-dev.');
  } else {
    console.log('\nBoth providers failed.');
  }
}

main();
