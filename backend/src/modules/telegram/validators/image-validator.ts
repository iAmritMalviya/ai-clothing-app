import { GoogleGenAI } from '@google/genai';
import { config } from '../../../config/env.js';
import type { GarmentCategory } from '../../../lib/ai-client.js';

const CLASSIFY_PROMPT = `Look at this image. Is it a photo of a clothing garment?

If YES, classify it into one of these categories:
- TOPS (shirt, t-shirt, polo, jacket, hoodie, kurta, blouse, crop top)
- BOTTOMS (jeans, pants, trousers, shorts, skirt, leggings)
- ONE-PIECES (dress, jumpsuit, saree, suit set, co-ord set)

Reply with exactly one word: TOPS, BOTTOMS, ONE-PIECES, or NO.`;

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({ apiKey: config.geminiApiKey! });
  }
  return _ai;
}

interface ValidationResult {
  isGarment: boolean;
  category: GarmentCategory;
}

export async function validateAndClassifyGarment(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<ValidationResult> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: imageBuffer.toString('base64'), mimeType } },
          { text: CLASSIFY_PROMPT },
        ],
      }],
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    const answer = (part && 'text' in part ? (part.text ?? '') : '').trim().toUpperCase();

    if (answer.startsWith('NO')) {
      return { isGarment: false, category: 'auto' };
    }

    if (answer.includes('TOPS')) return { isGarment: true, category: 'tops' };
    if (answer.includes('BOTTOMS')) return { isGarment: true, category: 'bottoms' };
    if (answer.includes('ONE')) return { isGarment: true, category: 'one-pieces' };

    // If answer is unclear but not NO, treat as garment with auto category
    return { isGarment: true, category: 'auto' };
  } catch (err) {
    console.error('[validator] Classification failed, defaulting to auto:', err instanceof Error ? err.message : err);
    return { isGarment: true, category: 'auto' };
  }
}

// Backward compat
export async function isGarmentImage(imageBuffer: Buffer, mimeType: string): Promise<boolean> {
  const result = await validateAndClassifyGarment(imageBuffer, mimeType);
  return result.isGarment;
}
