import type { GarmentCategory } from './ai-client.js';

/**
 * Pose System — Visibility-Goal Driven
 *
 * Architecture:
 *   garment type → required visibility regions → pose set → prompt composition
 *
 * Tops: head to above knee (three-quarter), focus on garment
 * Bottoms: waist to shoes (no head), plain white tee + white sneakers, focus on jeans/pants
 * One-pieces: full body
 *
 * Core rules (from feedback_prompt_engineering.md):
 * - "Canon EOS R5" forces photorealism
 * - "Indian male model with sharp facial features" anchors consistency
 * - Keep under 550 chars, natural flowing language
 * - Never describe the garment — "wearing the garment from the uploaded image"
 */

export interface PoseTemplate {
  label: string;
  visibilityGoal: string;
  prompt: string;
}

// ============================================================
// POSE BODY PRIMITIVES
// ============================================================

const POSE: Record<string, string> = {
  // General
  front_straight: 'standing straight facing camera, arms relaxed at sides',
  front_pockets: 'standing facing camera, hands in pockets, confident posture',
  quarter_turn: 'body turned 30 degrees, head facing camera, one hand in pocket',
  back_view: 'back facing camera, standing straight, arms at sides',
  side_profile: 'body angled sideways, face turned toward camera',
  relaxed_offset: 'one leg forward, relaxed shoulders, casual hands',
  // Tops-specific
  sleeve_adjust: 'adjusting sleeve cuff with one hand, body slightly turned',
  collar_touch: 'hand near collar, head tilted slightly, editorial expression',
  lean_forward: 'leaning slightly forward, shoulders relaxed, confident expression',
  // Bottoms-specific
  bottom_front: 'standing straight facing camera, one hand in jeans pocket, other arm relaxed',
  bottom_angled: 'body slightly angled, one hand in front pocket, relaxed confident stance',
  bottom_hand_pocket: 'standing relaxed, both hands near front pockets, thumbs hooked in pockets',
  bottom_walking: 'captured mid-step walking, natural stride, one leg forward',
  bottom_back: 'back facing camera, standing straight, showing rear pockets and fit',
  bottom_side: 'standing sideways showing full leg profile, one hand in back pocket',
  // Detail
  detail_waistband: 'close-up of waist area showing front pockets, button, zipper, belt loops, and fabric texture',
};

// ============================================================
// CAMERA PER CONTEXT
// ============================================================

const CAM = {
  top_half: 'three-quarter shot from head to above knee, thighs visible, 50mm f/1.4',
  bottom_half: 'cropped from waist to shoes, head not visible, legs fully visible, 50mm f/1.4',
  bottom_low: 'cropped from waist to shoes, slightly low angle, legs fully visible, 50mm',
  bottom_walk: 'cropped from waist to shoes, 35mm lens, stride and leg movement visible',
  bottom_detail: 'tight close-up shot, macro detail, 85mm f/1.8',
  full: 'full body shot, 50mm f/1.4',
  close_editorial: 'medium close-up, 85mm f/1.8, shallow depth of field',
};

function camFor(category: GarmentCategory, poseKey: string): string {
  if (category === 'tops') {
    if (poseKey === 'collar_touch') return CAM.close_editorial;
    return CAM.top_half;
  }
  if (category === 'bottoms') {
    if (poseKey === 'detail_waistband') return CAM.bottom_detail;
    if (poseKey === 'bottom_walking') return CAM.bottom_walk;
    if (poseKey === 'bottom_back' || poseKey === 'bottom_side') return CAM.bottom_low;
    return CAM.bottom_half;
  }
  if (category === 'one-pieces') {
    return CAM.full;
  }
  if (poseKey === 'collar_touch') return CAM.close_editorial;
  return CAM.full;
}

// ============================================================
// PROMPT BUILDERS — Different for tops vs bottoms
// ============================================================

// Tops: focus on upper body, model face matters
function buildTopPrompt(poseKey: string, camera: string): string {
  const body = POSE[poseKey];
  if (!body) throw new Error(`Unknown pose: ${poseKey}`);

  return [
    `A young Indian male model with sharp facial features and short black hair,`,
    `${body},`,
    `wearing the garment from the uploaded image.`,
    `{{BACKGROUND}}.`,
    `${camera}, shot on Canon EOS R5, 4K,`,
    `tack sharp focus on face and fabric,`,
    `photorealistic skin texture, defined jawline, clear eyes,`,
    `professional fashion catalog photography.`,
    `No blur, no watermarks, no distorted features.`,
  ].join(' ');
}

// Bottoms: focus on lower body, model wears plain white tee + white sneakers
function buildBottomPrompt(poseKey: string, camera: string): string {
  const body = POSE[poseKey];
  if (!body) throw new Error(`Unknown pose: ${poseKey}`);

  if (poseKey === 'detail_waistband') {
    // Detail shot — no model description needed
    return [
      `${body}, wearing the garment from the uploaded image.`,
      `{{BACKGROUND}}.`,
      `${camera}, shot on Canon EOS R5, 4K,`,
      `ultra sharp focus on fabric texture, stitching details, button and zipper visible,`,
      `premium product photography, high resolution.`,
      `No blur, no watermarks, no text.`,
    ].join(' ');
  }

  return [
    `A young Indian male model wearing a plain white crew-neck t-shirt on top and white sneakers,`,
    `${body},`,
    `wearing the garment from the uploaded image as the bottom wear.`,
    `{{BACKGROUND}}.`,
    `${camera}, shot on Canon EOS R5, 4K,`,
    `tack sharp focus on jeans fabric texture, waist fit, and leg taper,`,
    `photorealistic, clean e-commerce catalog photography.`,
    `No blur, no watermarks, no distorted features.`,
  ].join(' ');
}

// General: full body for one-pieces and auto
function buildGeneralPrompt(poseKey: string, camera: string): string {
  const body = POSE[poseKey];
  if (!body) throw new Error(`Unknown pose: ${poseKey}`);

  return [
    `A young Indian male model with sharp facial features and short black hair,`,
    `${body},`,
    `wearing the garment from the uploaded image.`,
    `{{BACKGROUND}}.`,
    `${camera}, shot on Canon EOS R5, 4K,`,
    `tack sharp focus on face and fabric,`,
    `photorealistic skin texture, defined jawline, clear eyes,`,
    `professional fashion catalog photography.`,
    `No blur, no watermarks, no distorted features.`,
  ].join(' ');
}

// ============================================================
// POSE CATALOG — Coverage sets per garment type
// ============================================================

interface PoseDef {
  label: string;
  goal: string;
  key: string;
}

const CATALOG: Record<GarmentCategory, PoseDef[]> = {
  tops: [
    { label: 'Front View', goal: 'chest, collar, button line, drape', key: 'front_straight' },
    { label: 'Three-Quarter', goal: 'torso shape, side seam, shoulder fit', key: 'quarter_turn' },
    { label: 'Back View', goal: 'back panel, shoulder width, yoke', key: 'back_view' },
    { label: 'Sleeve Detail', goal: 'sleeve length, cuff, arm fit', key: 'sleeve_adjust' },
    { label: 'Lifestyle', goal: 'natural drape, casual wearability', key: 'lean_forward' },
    { label: 'Editorial', goal: 'premium feel, brand imagery', key: 'collar_touch' },
  ],
  bottoms: [
    { label: 'Front View', goal: 'waist fit, thigh taper, knee fall, full length', key: 'bottom_front' },
    { label: 'Angled View', goal: 'pocket depth, side seam, 3D fit', key: 'bottom_angled' },
    { label: 'Back View', goal: 'back pockets, rear fit, branding area', key: 'bottom_back' },
    { label: 'Hand in Pocket', goal: 'natural drape, pocket depth, relaxed fit', key: 'bottom_hand_pocket' },
    { label: 'Side Profile', goal: 'thigh profile, hip shape, leg line', key: 'bottom_side' },
    { label: 'Waist Detail', goal: 'button, zipper, belt loops, fabric texture', key: 'detail_waistband' },
  ],
  'one-pieces': [
    { label: 'Front View', goal: 'full silhouette, neckline, waist, length', key: 'front_pockets' },
    { label: 'Three-Quarter', goal: '3D silhouette, side drape', key: 'quarter_turn' },
    { label: 'Back View', goal: 'back panel, closure, rear shape', key: 'back_view' },
    { label: 'Walking', goal: 'movement, fabric flow', key: 'bottom_walking' },
    { label: 'Relaxed', goal: 'natural fit, comfort', key: 'relaxed_offset' },
    { label: 'Lifestyle', goal: 'aspirational, brand appeal', key: 'side_profile' },
  ],
  auto: [
    { label: 'Front View', goal: 'full garment visible head to toe', key: 'front_straight' },
    { label: 'Three-Quarter', goal: '3D form, structure', key: 'quarter_turn' },
    { label: 'Hand in Pocket', goal: 'natural fit, relaxed look', key: 'hand_in_pocket' },
    { label: 'Back View', goal: 'rear details', key: 'back_view' },
    { label: 'Lifestyle', goal: 'natural wearability', key: 'lean_forward' },
    { label: 'Walking', goal: 'fabric dynamics', key: 'bottom_walking' },
  ],
};

// ============================================================
// BUILD & EXPORT
// ============================================================

function buildCategory(category: GarmentCategory): PoseTemplate[] {
  const builder = category === 'tops' ? buildTopPrompt
    : category === 'bottoms' ? buildBottomPrompt
    : buildGeneralPrompt;

  return CATALOG[category].map((def) => ({
    label: def.label,
    visibilityGoal: def.goal,
    prompt: builder(def.key, camFor(category, def.key)),
  }));
}

export const poseTemplates: Record<GarmentCategory, PoseTemplate[]> = {
  tops: buildCategory('tops'),
  bottoms: buildCategory('bottoms'),
  'one-pieces': buildCategory('one-pieces'),
  auto: buildCategory('auto'),
};

export { POSE, CATALOG };
