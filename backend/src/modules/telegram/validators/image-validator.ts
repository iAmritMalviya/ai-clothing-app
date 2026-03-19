import { GoogleGenAI } from '@google/genai';
import { config } from '../../../config/env.js';

const VALIDATION_PROMPT = `Look at this image. Is it a photo of a clothing garment (shirt, t-shirt, pants, dress, jacket, kurta, saree, etc.)?
Reply with exactly one word: YES or NO.`;

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({ apiKey: config.geminiApiKey! });
  }
  return _ai;
}

export async function isGarmentImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<boolean> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash', // cheapest text model for validation
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: imageBuffer.toString('base64'), mimeType } },
          { text: VALIDATION_PROMPT },
        ],
      }],
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    const answer = (part && 'text' in part ? (part.text ?? '') : '').trim().toUpperCase();
    return answer.startsWith('YES');
  } catch (err) {
    // If validation fails, allow the image through (don't block on validation errors)
    console.error('[validator] Garment check failed, allowing through:', err instanceof Error ? err.message : err);
    return true;
  }
}
