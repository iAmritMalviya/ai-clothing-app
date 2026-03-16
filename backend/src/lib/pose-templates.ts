import type { GarmentCategory } from './ai-client.js';

/**
 * Category-aware pose templates for e-commerce catalog generation.
 *
 * Rules:
 * - NEVER describe the garment in text — always use "wearing the garment from the uploaded image"
 * - tops → torso-focused shots (garment must be clearly visible)
 * - bottoms → full body shots (full leg visibility required)
 * - one-pieces → full body shots
 * - auto → general mixed set
 *
 * Each template has a label (shown in UI) and a prompt (sent to Gemini).
 * "The same male fashion model" trick: Gemini reads the reference image (passed as image 2)
 * and interprets this as a constraint to match that model's appearance.
 */

export interface PoseTemplate {
  label: string;
  prompt: string;
}

export const poseTemplates: Record<GarmentCategory, PoseTemplate[]> = {
  tops: [
    {
      label: 'Front View',
      prompt: 'Professional fashion catalogue photo of the same male fashion model, standing confidently, hands casually in pockets, torso clearly visible, wearing the garment from the uploaded image. Clean light grey studio background, soft professional lighting, sharp focus, ultra realistic fabric texture, premium e-commerce fashion photography.',
    },
    {
      label: 'Side Turn',
      prompt: 'Studio fashion photoshoot of the same male fashion model, standing in a relaxed pose with body slightly turned sideways, head facing directly toward the camera, hands relaxed at sides, wearing the garment from the uploaded image. Neutral studio background, soft diffused lighting, torso fully visible, high-end clothing catalogue photography.',
    },
    {
      label: 'Editorial',
      prompt: 'High-end fashion editorial photo of the same male fashion model, standing with relaxed posture, one shoulder slightly forward, gaze directed confidently off-camera to the side, wearing the garment from the uploaded image. Clean minimal studio background, soft fashion lighting, realistic fabric textures, upper body clearly in frame.',
    },
    {
      label: 'Sleeve Detail',
      prompt: 'Professional fashion photography of the same male fashion model adjusting his sleeve with one hand while standing naturally, wearing the garment from the uploaded image. Clean light studio background, premium clothing catalogue style, highly detailed realistic fabric, torso clearly visible.',
    },
    {
      label: 'Lifestyle',
      prompt: 'Lifestyle fashion photograph of the same male fashion model leaning slightly against a wall with relaxed posture, hands casually positioned, wearing the garment from the uploaded image. Minimal modern background, soft lighting, editorial fashion shoot style, upper body clearly visible.',
    },
    {
      label: 'Back View',
      prompt: 'Studio fashion photograph showing the back view of the same male fashion model, standing straight with relaxed posture, arms naturally at sides, wearing the garment from the uploaded image. Neutral studio background, soft diffused lighting, full back of garment clearly visible, high-detail fashion catalogue photography.',
    },
  ],

  bottoms: [
    {
      label: 'Front View',
      prompt: 'Full body professional fashion catalogue photograph of the same male fashion model, standing upright with relaxed posture, hands casually in pockets, wearing the garment from the uploaded image. Clean studio background, soft even lighting, full body from head to feet visible, premium e-commerce photography.',
    },
    {
      label: 'Walking Pose',
      prompt: 'Full body fashion photoshoot of the same male fashion model walking naturally toward the camera with confident posture, wearing the garment from the uploaded image. Modern studio background, natural lighting, full body from head to feet visible, realistic premium clothing photography.',
    },
    {
      label: 'Relaxed Stance',
      prompt: 'Full body fashion photograph of the same male fashion model, standing with one leg slightly forward in a natural relaxed stance, hands casually positioned, wearing the garment from the uploaded image. Neutral studio background, soft professional lighting, complete garment from waist to feet clearly visible, high-end catalogue photography.',
    },
    {
      label: 'Side Angle',
      prompt: 'Full body studio fashion image of the same male fashion model, body angled sideways while face and eyes turned confidently toward the camera, relaxed posture, wearing the garment from the uploaded image. Clean background, soft diffused lighting, full leg and garment visible, premium fashion photography.',
    },
    {
      label: 'Seated',
      prompt: 'Full body fashion lifestyle photo of the same male fashion model sitting casually on a stool with relaxed posture, wearing the garment from the uploaded image. Modern studio environment, soft natural lighting, complete garment from waist to feet visible, high-end fashion editorial photography.',
    },
    {
      label: 'Back View',
      prompt: 'Full body fashion catalogue photograph showing the back view of the same male fashion model, standing straight with natural posture, arms relaxed, wearing the garment from the uploaded image. Neutral studio background, soft even lighting, complete back of garment from waist to feet visible, detailed e-commerce clothing photography.',
    },
  ],

  'one-pieces': [
    {
      label: 'Front View',
      prompt: 'Full body professional fashion catalogue photograph of the same male fashion model, standing upright with relaxed posture, hands casually in pockets, wearing the garment from the uploaded image. Clean studio background, soft even lighting, complete outfit from head to feet visible, premium e-commerce fashion photography.',
    },
    {
      label: 'Side Turn',
      prompt: 'Full body studio fashion photoshoot of the same male fashion model, standing with body slightly turned sideways, head facing the camera, hands relaxed, wearing the garment from the uploaded image. Neutral studio background, soft diffused lighting, entire outfit clearly visible, high-end clothing catalogue photography.',
    },
    {
      label: 'Three-Quarter',
      prompt: 'Full body professional fashion photoshoot of the same male fashion model in a confident three-quarter pose, body slightly turned away from the camera while the face is visible, hands casually placed in pockets, wearing the garment from the uploaded image. Clean background, soft studio lighting, complete outfit visible, ultra realistic fabric texture.',
    },
    {
      label: 'Relaxed Stance',
      prompt: 'Full body fashion photograph of the same male fashion model, standing with one leg slightly forward and relaxed posture, hands casually positioned, wearing the garment from the uploaded image. Neutral studio background, soft professional lighting, complete garment from head to feet visible, high-end catalogue photography.',
    },
    {
      label: 'Lifestyle',
      prompt: 'Full body lifestyle fashion photograph of the same male fashion model standing with relaxed confidence, shoulders slightly angled, wearing the garment from the uploaded image. Cinematic lighting, natural posture, luxury fashion brand photoshoot style, complete outfit visible, sharp focus, realistic textures.',
    },
    {
      label: 'Back View',
      prompt: 'Full body fashion catalogue photograph showing the back view of the same male fashion model, standing straight with natural posture, arms relaxed, wearing the garment from the uploaded image. Neutral studio background, soft even lighting, complete outfit from head to feet shown from behind, detailed e-commerce photography.',
    },
  ],

  auto: [
    {
      label: 'Front View',
      prompt: 'Professional fashion catalogue photo of the same male fashion model, standing confidently, hands casually in pockets, torso clearly visible, wearing the garment from the uploaded image. Clean light grey studio background, soft professional lighting, sharp focus, ultra realistic fabric texture, premium e-commerce fashion photography.',
    },
    {
      label: 'Side Turn',
      prompt: 'Studio fashion photoshoot of the same male fashion model, standing in a relaxed pose with body slightly turned sideways, head facing directly toward the camera, hands relaxed, wearing the garment from the uploaded image. Neutral studio background, soft diffused lighting, high-end clothing catalogue photography.',
    },
    {
      label: 'Full Body',
      prompt: 'Full body professional fashion catalogue photograph of the same male fashion model, standing upright with relaxed posture, hands casually in pockets, wearing the garment from the uploaded image. Clean studio background, soft even lighting, complete garment visible, premium e-commerce photography.',
    },
    {
      label: 'Three-Quarter',
      prompt: 'Professional fashion photoshoot of the same male fashion model in a confident three-quarter pose, body slightly turned away from the camera while the face is visible, hands casually placed in pockets, wearing the garment from the uploaded image. Clean background, soft studio lighting, ultra realistic skin and fabric texture, high-end clothing brand catalogue photography.',
    },
    {
      label: 'Editorial',
      prompt: 'High-end fashion editorial portrait of the same male fashion model, standing with relaxed confidence, shoulders slightly angled, gaze directed off-camera, hands casually positioned, wearing the garment from the uploaded image. Cinematic lighting, natural posture, luxury fashion brand photoshoot style, sharp focus, realistic textures.',
    },
    {
      label: 'Back View',
      prompt: 'Studio fashion photograph showing the back view of the same male fashion model, standing straight with relaxed posture, wearing the garment from the uploaded image. Neutral studio background, soft diffused lighting, garment clearly visible from behind, high-detail fashion catalogue photography.',
    },
  ],
};
