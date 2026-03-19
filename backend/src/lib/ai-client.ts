import { fal } from '@fal-ai/client';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { GoogleAuth } from 'google-auth-library';
import { config } from '../config/env.js';
import { getMimeType } from './storage.js';

// --- Initialize providers ---

if (config.falApiKey) {
  fal.config({ credentials: config.falApiKey });
}

const gemini = config.geminiApiKey
  ? new GoogleGenAI({ apiKey: config.geminiApiKey })
  : null;

// Production: 'gemini-3.1-flash-image-preview' (~₹12.5/img, clear faces)
// Testing: 'gemini-2.5-flash-image' (~₹3.25/img, lower quality)
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

// Vertex AI auth (lazy — only initialized when needed)
let vertexAuth: GoogleAuth | null = null;
function getVertexAuth(): GoogleAuth {
  if (!vertexAuth) {
    vertexAuth = new GoogleAuth({
      keyFilename: config.googleApplicationCredentials!,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }
  return vertexAuth;
}

// --- Error handlers ---

function handleFalError(err: unknown): never {
  if (err && typeof err === 'object' && 'body' in err) {
    const body = (err as { body?: { detail?: string } }).body;
    if (body?.detail?.includes('Exhausted balance')) {
      throw Object.assign(new Error('AI service billing limit reached (fal.ai). Please try again later.'), { statusCode: 503 });
    }
    if (body?.detail) {
      throw Object.assign(new Error(`AI service error (fal.ai): ${body.detail}`), { statusCode: 502 });
    }
  }
  throw err;
}

function handleGeminiError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
    throw Object.assign(new Error('AI rate limit reached (Gemini). Please try again in a minute.'), { statusCode: 429 });
  }
  if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
    throw Object.assign(new Error('AI API key is invalid or lacks permissions (Gemini).'), { statusCode: 503 });
  }
  throw Object.assign(new Error(`AI service error (Gemini): ${msg.slice(0, 200)}`), { statusCode: 502 });
}

// --- Gemini helpers ---

function bufferToBase64Part(buffer: Buffer, mimeType: string) {
  return {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType,
    },
  };
}

function extractGeminiImage(response: NonNullable<Awaited<ReturnType<NonNullable<typeof gemini>['models']['generateContent']>>>): Buffer {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) {
    throw Object.assign(new Error('No response from Gemini'), { statusCode: 502 });
  }
  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }
  throw Object.assign(new Error('Gemini did not return an image'), { statusCode: 502 });
}

// --- fal.ai helpers ---

function bufferToFile(buffer: Buffer, filename: string, mimeType: string): File {
  return new File(
    [new Uint8Array(buffer)],
    filename,
    { type: mimeType },
  );
}

// ============================================================
// BACKGROUND REMOVAL
// ============================================================

interface RemoveBackgroundResult {
  buffer: Buffer;
  processingTimeMs: number;
}

async function removeBackgroundFal(imageBuffer: Buffer, filename: string): Promise<RemoveBackgroundResult> {
  const start = Date.now();

  try {
    const imageFile = bufferToFile(imageBuffer, filename, getMimeType(filename));
    const imageUrl = await fal.storage.upload(imageFile);

    const result = await fal.subscribe('fal-ai/birefnet/v2', {
      input: { image_url: imageUrl },
    });

    const outputUrl = result.data.image.url;
    const response = await fetch(outputUrl);
    if (!response.ok) throw new Error(`Failed to download: ${response.status}`);

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      processingTimeMs: Date.now() - start,
    };
  } catch (err) {
    handleFalError(err);
  }
}

async function removeBackgroundGemini(imageBuffer: Buffer, filename: string): Promise<RemoveBackgroundResult> {
  if (!gemini) throw new Error('Gemini not configured');
  const start = Date.now();

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [
        bufferToBase64Part(imageBuffer, getMimeType(filename)),
        'Remove the background from this image completely. Return ONLY the subject (clothing/garment) with a fully transparent background. Keep every detail of the subject intact — edges, textures, folds, patterns, and colors must be perfectly preserved. Output as a PNG with transparency.',
      ],
      config: { responseModalities: ['image'] },
    });

    return {
      buffer: extractGeminiImage(response),
      processingTimeMs: Date.now() - start,
    };
  } catch (err) {
    handleGeminiError(err);
  }
}

export async function removeBackground(imageBuffer: Buffer, filename: string): Promise<RemoveBackgroundResult> {
  if (config.aiProviderBgRemoval === 'fal') {
    return removeBackgroundFal(imageBuffer, filename);
  }
  return removeBackgroundGemini(imageBuffer, filename);
}

// ============================================================
// SCENE BACKGROUND GENERATION
// ============================================================

async function generateSceneFal(prompt: string): Promise<Buffer> {
  try {
    const result = await fal.subscribe('fal-ai/flux/schnell', {
      input: {
        prompt,
        image_size: { width: 1024, height: 1024 },
        num_images: 1,
      },
    });

    const imageUrl = (result.data as { images: { url: string }[] }).images[0].url;
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (err) {
    handleFalError(err);
  }
}

async function generateSceneGemini(prompt: string): Promise<Buffer> {
  if (!gemini) throw new Error('Gemini not configured');

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: `Generate a professional product photography background scene: ${prompt}. The image should be 1024x1024, suitable as a background for clothing product photos. No people, no text, just the environment/background.`,
      config: { responseModalities: ['image'] },
    });

    return extractGeminiImage(response);
  } catch (err) {
    handleGeminiError(err);
  }
}

export async function generateSceneBackground(prompt: string): Promise<Buffer> {
  if (config.aiProviderSceneGen === 'fal') {
    return generateSceneFal(prompt);
  }
  return generateSceneGemini(prompt);
}

// ============================================================
// VIRTUAL TRY-ON
// ============================================================

export type GarmentCategory = 'tops' | 'bottoms' | 'one-pieces' | 'auto';

interface TryOnResult {
  buffer: Buffer;
  processingTimeMs: number;
}

async function tryOnFal(
  modelImageBuffer: Buffer,
  modelImageMime: string,
  garmentImageBuffer: Buffer,
  garmentImageMime: string,
  category: GarmentCategory,
): Promise<TryOnResult> {
  const start = Date.now();

  try {
    const modelFile = bufferToFile(modelImageBuffer, 'model.jpg', modelImageMime);
    const garmentFile = bufferToFile(garmentImageBuffer, 'garment.jpg', garmentImageMime);

    const [modelUrl, garmentUrl] = await Promise.all([
      fal.storage.upload(modelFile),
      fal.storage.upload(garmentFile),
    ]);

    const result = await fal.subscribe('fal-ai/fashn/tryon/v1.6', {
      input: {
        model_image: modelUrl,
        garment_image: garmentUrl,
        category,
      },
    });

    const data = result.data as unknown as { images: { url: string }[] };
    const outputUrl = data.images[0].url;
    const response = await fetch(outputUrl);
    if (!response.ok) throw new Error(`Failed to download: ${response.status}`);

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      processingTimeMs: Date.now() - start,
    };
  } catch (err) {
    handleFalError(err);
  }
}

async function tryOnGemini(
  modelImageBuffer: Buffer,
  modelImageMime: string,
  garmentImageBuffer: Buffer,
  garmentImageMime: string,
  category: GarmentCategory,
  posePrompt?: string,
): Promise<TryOnResult> {
  if (!gemini) throw new Error('Gemini not configured');
  const start = Date.now();

  console.log(`[tryOnGemini] provider=gemini model=${GEMINI_IMAGE_MODEL} category=${category} pose=${posePrompt ? 'custom' : 'default'}`);

  // Core principle: never describe the garment in text — the image IS the garment constraint.
  // Say "wearing the garment from the uploaded image" and let Gemini read image 1 directly.
  const poseCore = posePrompt
    ?? 'Studio fashion photoshoot of a male model standing in a relaxed confident pose, hands casually inside trouser pockets, looking directly toward the camera, wearing the garment from the uploaded image. Clean light grey studio background, soft professional lighting, sharp focus, premium fashion catalogue photography.';

  const fullPrompt = `${poseCore}

Image references: the first image is the garment — reproduce it exactly as shown on the model. The second image provides the body pose and model reference. Natural skin tones, realistic fabric texture, high detail, professional fashion photography. No text overlays, no watermarks, no logos, no distorted faces, no extra limbs, no bad anatomy, no oversaturated colors.`;

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            bufferToBase64Part(garmentImageBuffer, garmentImageMime),
            bufferToBase64Part(modelImageBuffer, modelImageMime),
            { text: fullPrompt },
          ],
        },
      ],
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    });

    return {
      buffer: extractGeminiImage(response),
      processingTimeMs: Date.now() - start,
    };
  } catch (err) {
    handleGeminiError(err);
  }
}

async function tryOnNanaBanana(
  modelImageBuffer: Buffer,
  modelImageMime: string,
  garmentImageBuffer: Buffer,
  garmentImageMime: string,
  category: GarmentCategory,
  posePrompt?: string,
): Promise<TryOnResult> {
  const start = Date.now();

  try {
    const modelFile = bufferToFile(modelImageBuffer, 'reference.jpg', modelImageMime);
    const garmentFile = bufferToFile(garmentImageBuffer, 'garment.jpg', garmentImageMime);

    const [garmentUrl, referenceUrl] = await Promise.all([
      fal.storage.upload(garmentFile),
      fal.storage.upload(modelFile),
    ]);

    const poseCore = posePrompt
      ?? 'Studio fashion photoshoot of a male model standing in a relaxed confident pose, hands casually inside trouser pockets, looking directly toward the camera, wearing the garment from the uploaded image. Clean light grey studio background, soft professional lighting, sharp focus, premium fashion catalogue photography.';

    const prompt = `${poseCore}

The first image is the garment — reproduce it exactly as shown on the model. The second image provides the body pose reference. No text overlays, no watermarks, no logos added to the output image.`;

    const result = await fal.subscribe('fal-ai/nano-banana-2/edit', {
      input: {
        prompt,
        image_urls: [garmentUrl, referenceUrl],
        num_images: 1,
        aspect_ratio: '3:4',
        resolution: '1K',
        output_format: 'png',
        safety_tolerance: '4',
        limit_generations: true,
      },
    });

    const data = result.data as unknown as { images: { url: string }[] };
    const outputUrl = data.images[0].url;
    const response = await fetch(outputUrl);
    if (!response.ok) throw new Error(`Failed to download: ${response.status}`);

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      processingTimeMs: Date.now() - start,
    };
  } catch (err) {
    handleFalError(err);
  }
}

async function tryOnVertex(
  modelImageBuffer: Buffer,
  _modelImageMime: string,
  garmentImageBuffer: Buffer,
  _garmentImageMime: string,
  _category: GarmentCategory,
): Promise<TryOnResult> {
  const start = Date.now();
  const project = config.googleCloudProject;
  if (!project) throw new Error('GOOGLE_CLOUD_PROJECT not configured');

  const location = 'us-central1';
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/virtual-try-on-001:predict`;

  console.log(`[tryOnVertex] provider=vertex model=virtual-try-on-001 project=${project}`);

  try {
    const auth = getVertexAuth();
    const client = await auth.getClient();
    const accessToken = (await client.getAccessToken()).token;

    const body = {
      instances: [
        {
          personImage: {
            image: { bytesBase64Encoded: modelImageBuffer.toString('base64') },
          },
          productImages: [
            {
              image: { bytesBase64Encoded: garmentImageBuffer.toString('base64') },
            },
          ],
        },
      ],
      parameters: {
        sampleCount: 1,
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Vertex AI error (${response.status}): ${errText.slice(0, 300)}`);
    }

    const data = await response.json() as {
      predictions: { bytesBase64Encoded: string; mimeType: string }[];
    };

    if (!data.predictions || data.predictions.length === 0) {
      throw new Error('Vertex AI returned no predictions');
    }

    return {
      buffer: Buffer.from(data.predictions[0].bytesBase64Encoded, 'base64'),
      processingTimeMs: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      throw Object.assign(new Error('AI rate limit reached (Vertex AI). Please try again in a minute.'), { statusCode: 429 });
    }
    if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
      throw Object.assign(new Error('Vertex AI permissions error. Check service account roles.'), { statusCode: 503 });
    }
    throw Object.assign(new Error(`AI service error (Vertex AI): ${msg.slice(0, 200)}`), { statusCode: 502 });
  }
}

export async function tryOnGarment(
  modelImageBuffer: Buffer,
  modelImageMime: string,
  garmentImageBuffer: Buffer,
  garmentImageMime: string,
  category: GarmentCategory = 'auto',
  posePrompt?: string,
): Promise<TryOnResult> {
  if (config.aiProviderTryOn === 'vertex') {
    return tryOnVertex(modelImageBuffer, modelImageMime, garmentImageBuffer, garmentImageMime, category);
  }
  if (config.aiProviderTryOn === 'nano-banana') {
    return tryOnNanaBanana(modelImageBuffer, modelImageMime, garmentImageBuffer, garmentImageMime, category, posePrompt);
  }
  if (config.aiProviderTryOn === 'fal') {
    return tryOnFal(modelImageBuffer, modelImageMime, garmentImageBuffer, garmentImageMime, category);
  }
  return tryOnGemini(modelImageBuffer, modelImageMime, garmentImageBuffer, garmentImageMime, category, posePrompt);
}
