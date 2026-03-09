import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const API_KEY = process.env.FAL_KEY!; // FASHN uses the same key from fal.ai dashboard
const FASHN_API_KEY = process.env.FASHN_API_KEY;
const OUTPUT_DIR = join(import.meta.dirname, '..', 'uploads', 'model-presets');

// Use FASHN_API_KEY if set, otherwise try FAL_KEY
const AUTH_KEY = FASHN_API_KEY || API_KEY;

const MODELS = [
  {
    file: 'male-1.png',
    prompt:
      'Full body shot, young Indian male model, age 25, medium athletic build, clean shaven, standing straight facing camera with hands at sides, wearing a plain white crew neck t-shirt and light blue slim fit jeans, clean white studio background, professional e-commerce fashion photography, soft diffused studio lighting, sharp focus, high resolution, natural skin texture',
  },
  {
    file: 'male-2.png',
    prompt:
      'Full body shot, young Indian male model, age 27, athletic build, short trimmed beard, standing confidently with one hand in pocket, wearing a plain grey polo shirt and dark navy chinos, clean white studio background, professional e-commerce fashion photography, soft diffused studio lighting, sharp focus, high resolution, natural skin texture',
  },
  {
    file: 'male-3.png',
    prompt:
      'Full body shot, young Indian male model, age 24, slim build, clean shaven with side parted hair, standing straight facing camera arms relaxed at sides, wearing a plain light blue oxford button-down shirt with sleeves rolled up and beige chinos, clean white studio background, professional e-commerce fashion photography, soft diffused studio lighting, sharp focus, high resolution, natural skin texture',
  },
  {
    file: 'male-4.png',
    prompt:
      'Full body shot, young Indian male model, age 28, medium build, light stubble, standing with slight angle one hand in pocket, wearing a plain black henley full sleeve shirt and grey slim fit jeans, clean white studio background, professional e-commerce fashion photography, soft diffused studio lighting, sharp focus, high resolution, natural skin texture',
  },
];

async function submitJob(prompt: string): Promise<string> {
  const resp = await fetch('https://api.fashn.ai/v1/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_KEY}`,
    },
    body: JSON.stringify({
      model_name: 'model-create',
      inputs: {
        prompt,
        aspect_ratio: '3:4',
        resolution: '1k',
        num_images: 1,
        output_format: 'png',
      },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Submit failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  if (data.error) throw new Error(`Submit error: ${data.error}`);
  return data.id;
}

async function pollStatus(id: string): Promise<string[]> {
  const maxAttempts = 60; // 60 * 2s = 120s max
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const resp = await fetch(`https://api.fashn.ai/v1/status/${id}`, {
      headers: { Authorization: `Bearer ${AUTH_KEY}` },
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Poll failed (${resp.status}): ${text}`);
    }

    const data = await resp.json();

    if (data.status === 'completed') {
      return data.output as string[];
    }
    if (data.status === 'failed') {
      throw new Error(`Job failed: ${data.error || 'unknown error'}`);
    }

    process.stdout.write('.');
  }

  throw new Error('Timed out waiting for result');
}

async function downloadImage(url: string, filePath: string) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  await writeFile(filePath, buffer);
  return buffer.length;
}

async function main() {
  console.log(`Using API key: ${AUTH_KEY.slice(0, 8)}...`);
  console.log(`Output dir: ${OUTPUT_DIR}\n`);

  for (const model of MODELS) {
    console.log(`Generating ${model.file}...`);
    try {
      const jobId = await submitJob(model.prompt);
      process.stdout.write(`  Job ${jobId.slice(0, 12)}... polling`);

      const outputs = await pollStatus(jobId);
      console.log(' done!');

      const outPath = join(OUTPUT_DIR, model.file);
      const size = await downloadImage(outputs[0], outPath);
      console.log(`  Saved ${model.file} (${(size / 1024).toFixed(0)} KB)\n`);
    } catch (err: any) {
      console.log(`\n  ERROR: ${err.message}\n`);
    }
  }

  console.log('Finished!');
}

main();
