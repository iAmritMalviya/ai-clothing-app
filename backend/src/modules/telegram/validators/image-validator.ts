import { GoogleGenAI } from '@google/genai';
import { config } from '../../../config/env.js';
import type { GarmentCategory } from '../../../lib/ai-client.js';

const CLASSIFY_PROMPT = `Look at this image. Is it a photo of a clothing garment?

If YES, answer two things:
1. Category: TOPS, BOTTOMS, or ONE-PIECES
2. Gender: MALE, FEMALE, or KIDS

Rules:
- TOPS = shirt, t-shirt, polo, jacket, hoodie, kurta
- BOTTOMS = jeans, pants, trousers, shorts
- ONE-PIECES = dress, jumpsuit, saree, suit set
- MALE = men's clothing (broader cuts, masculine style)
- FEMALE = women's clothing (blouse, crop top, lehenga, saree, feminine cuts)
- KIDS = children's clothing (small sizes, cartoon prints)

Reply in this exact format: CATEGORY GENDER
Examples: TOPS MALE, BOTTOMS FEMALE, ONE-PIECES KIDS
If not a garment, reply: NO`;

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({ apiKey: config.geminiApiKey! });
  }
  return _ai;
}

export type GarmentGender = 'male' | 'female' | 'kids' | 'unknown';

export interface ValidationResult {
  isGarment: boolean;
  category: GarmentCategory;
  gender: GarmentGender;
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
      return { isGarment: false, category: 'auto', gender: 'unknown' };
    }

    // Parse category
    let category: GarmentCategory = 'auto';
    if (answer.includes('TOPS')) category = 'tops';
    else if (answer.includes('BOTTOMS')) category = 'bottoms';
    else if (answer.includes('ONE')) category = 'one-pieces';

    // Parse gender
    let gender: GarmentGender = 'unknown';
    if (answer.includes('FEMALE')) gender = 'female';
    else if (answer.includes('KIDS')) gender = 'kids';
    else if (answer.includes('MALE')) gender = 'male';

    return { isGarment: true, category, gender };
  } catch (err) {
    console.error('[validator] Classification failed, defaulting to auto:', err instanceof Error ? err.message : err);
    return { isGarment: true, category: 'auto', gender: 'unknown' };
  }
}
