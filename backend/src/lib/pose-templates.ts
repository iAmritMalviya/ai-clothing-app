import type { GarmentCategory } from './ai-client.js';

/**
 * Pose System — Built from Visibility Primitives
 *
 * Architecture:
 *   garment type → required visibility regions → pose set → prompt composition
 *
 * Poses are NOT aesthetic choices — they are information exposure strategies.
 * Each pose exists to expose specific garment regions to the camera.
 *
 * Core rule: NEVER describe the garment in text.
 * Always use "wearing the garment from the uploaded image".
 */

// ============================================================
// VISIBILITY MODEL — What regions matter per garment type
// ============================================================

const VISIBILITY_REGIONS: Record<GarmentCategory, string[]> = {
  tops: ['chest', 'collar', 'sleeves', 'shoulder_fit', 'fabric_drape', 'back_panel'],
  bottoms: ['waist', 'hip', 'thigh', 'knee_fall', 'ankle_break', 'back_pockets'],
  'one-pieces': ['neckline', 'waist_definition', 'silhouette', 'length', 'flow', 'back_closure'],
  auto: ['overall_fit', 'front_view', 'back_view', 'silhouette', 'drape', 'movement'],
};

// ============================================================
// POSE PRIMITIVES — Reusable body descriptions
// ============================================================

const POSE_BODY: Record<string, string> = {
  front_straight: 'standing straight facing camera, relaxed posture, arms naturally down',
  front_pockets: 'standing confidently facing camera, hands casually in pockets',
  quarter_turn: 'body turned 30 degrees sideways, head facing camera, one hand in pocket',
  back_view: 'standing with back facing camera, legs slightly apart, arms relaxed',
  wide_stance: 'standing in wide confident stance, legs apart, hands near pockets',
  hand_in_pocket: 'standing relaxed, one hand inside front pocket, body slightly angled',
  walking: 'captured mid-step walking forward, one leg ahead, natural stride, arms in motion',
  lean_forward: 'body slightly leaning forward, shoulders relaxed, head tilted slightly, confident',
  sleeve_adjust: 'one hand adjusting the opposite sleeve cuff, body slightly turned sideways',
  collar_touch: 'one hand near collar, head slightly tilted, confident expression',
  side_profile: 'body angled sideways, face turned toward camera, confident expression',
  relaxed_offset: 'standing with one leg slightly forward, shoulders relaxed, hands casually positioned',
};

// ============================================================
// CAMERA LOGIC — Changes per garment type and pose
// ============================================================

type ShotType = 'medium' | 'full_body' | 'full_body_low' | 'full_body_wide' | 'medium_close';

const CAMERA: Record<ShotType, string> = {
  medium: 'medium shot, eye-level, 50mm lens',
  full_body: 'full body shot, eye-level, 50mm lens',
  full_body_low: 'full body shot, slightly low angle, 50mm lens',
  full_body_wide: 'full body shot, slightly low angle, 35mm lens',
  medium_close: 'medium close-up, slight top angle, 85mm lens',
};

function getCameraForPose(category: GarmentCategory, poseKey: string): string {
  // Bottoms and one-pieces always need full body
  if (category === 'bottoms' || category === 'one-pieces') {
    if (poseKey === 'walking') return CAMERA.full_body_wide;
    if (poseKey === 'wide_stance') return CAMERA.full_body_low;
    return CAMERA.full_body;
  }
  // Tops: mostly medium shots
  if (poseKey === 'collar_touch') return CAMERA.medium_close;
  if (poseKey === 'walking') return CAMERA.full_body_wide;
  return CAMERA.medium;
}

// ============================================================
// QUALITY SUFFIX — Appended to every prompt
// ============================================================

// Quality descriptors that push cheaper models toward sharper output
const QUALITY_SUFFIX = 'shot on Canon EOS R5 with 50mm f/1.4 lens, 4K resolution, tack sharp focus on face and garment, visible skin pores, clear facial features, defined jawline, crisp fabric texture, natural skin tones, professional studio fashion photography, high-end e-commerce catalog, photorealistic';
const NEGATIVE_SUFFIX = 'No blur, no soft focus on face, no text overlays, no watermarks, no logos, no distorted faces, no extra limbs, no bad anatomy, no oversaturated colors, no AI artifacts';

// ============================================================
// PROMPT GENERATOR — Composes from primitives
// ============================================================

function generatePosePrompt(
  poseKey: string,
  camera: string,
): string {
  const body = POSE_BODY[poseKey];
  if (!body) throw new Error(`Unknown pose key: ${poseKey}`);

  // Natural flowing language — Gemini generates much better with comma-separated descriptive prose
  // Face clarity signals: camera model, resolution, "sharp focus on face" are critical for cheaper models
  return `Professional high-resolution fashion catalogue photo of the same male fashion model with clearly visible sharp facial features, ${body}, wearing the garment from the uploaded image. {{BACKGROUND}}, ${camera}, ${QUALITY_SUFFIX}. ${NEGATIVE_SUFFIX}.`;
}

// ============================================================
// POSE TEMPLATE — Public interface
// ============================================================

export interface PoseTemplate {
  label: string;
  visibilityGoal: string;
  prompt: string;
}

interface PoseDefinition {
  label: string;
  visibilityGoal: string;
  poseKey: string;
}

// ============================================================
// POSE CATALOG — Maps garment type → required coverage
// ============================================================

const POSE_CATALOG: Record<GarmentCategory, PoseDefinition[]> = {
  tops: [
    { label: 'Front View', visibilityGoal: 'chest, collar, button line, overall drape', poseKey: 'front_straight' },
    { label: 'Three-Quarter', visibilityGoal: 'torso shape, side seam, shoulder fit', poseKey: 'quarter_turn' },
    { label: 'Back View', visibilityGoal: 'back panel, shoulder width, yoke detail', poseKey: 'back_view' },
    { label: 'Sleeve Detail', visibilityGoal: 'sleeve length, cuff, arm fit', poseKey: 'sleeve_adjust' },
    { label: 'Lifestyle', visibilityGoal: 'natural fabric fall, casual drape', poseKey: 'lean_forward' },
    { label: 'Editorial', visibilityGoal: 'premium feel, brand-worthy imagery', poseKey: 'collar_touch' },
  ],

  bottoms: [
    { label: 'Front View', visibilityGoal: 'waist fit, thigh taper, knee fall, length', poseKey: 'front_straight' },
    { label: 'Back View', visibilityGoal: 'back pockets, rear fit, branding area', poseKey: 'back_view' },
    { label: 'Wide Stance', visibilityGoal: 'thigh spread, crotch fit, structure', poseKey: 'wide_stance' },
    { label: 'Hand in Pocket', visibilityGoal: 'natural drape, pocket depth, relaxed fit', poseKey: 'hand_in_pocket' },
    { label: 'Walking', visibilityGoal: 'fabric movement, taper dynamics, stride', poseKey: 'walking' },
    { label: 'Side Angle', visibilityGoal: 'side seam, thigh profile, hip shape', poseKey: 'side_profile' },
  ],

  'one-pieces': [
    { label: 'Front View', visibilityGoal: 'full silhouette, neckline, waist, length', poseKey: 'front_pockets' },
    { label: 'Three-Quarter', visibilityGoal: '3D silhouette, side drape, form', poseKey: 'quarter_turn' },
    { label: 'Back View', visibilityGoal: 'back panel, closure, rear silhouette', poseKey: 'back_view' },
    { label: 'Walking', visibilityGoal: 'movement, flow, fabric behavior', poseKey: 'walking' },
    { label: 'Relaxed', visibilityGoal: 'natural fit, casual wearability', poseKey: 'relaxed_offset' },
    { label: 'Lifestyle', visibilityGoal: 'aspirational imagery, brand appeal', poseKey: 'side_profile' },
  ],

  auto: [
    { label: 'Front View', visibilityGoal: 'overall garment appearance and fit', poseKey: 'front_pockets' },
    { label: 'Three-Quarter', visibilityGoal: '3D form, side structure', poseKey: 'quarter_turn' },
    { label: 'Full Body', visibilityGoal: 'complete garment head to toe', poseKey: 'front_straight' },
    { label: 'Back View', visibilityGoal: 'rear panel, back details', poseKey: 'back_view' },
    { label: 'Lifestyle', visibilityGoal: 'natural wearability, lifestyle context', poseKey: 'lean_forward' },
    { label: 'Walking', visibilityGoal: 'fabric dynamics, movement behavior', poseKey: 'walking' },
  ],
};

// ============================================================
// BUILD TEMPLATES — Generate from catalog at module load
// ============================================================

function buildTemplates(category: GarmentCategory): PoseTemplate[] {
  return POSE_CATALOG[category].map((def) => ({
    label: def.label,
    visibilityGoal: def.visibilityGoal,
    prompt: generatePosePrompt(def.poseKey, getCameraForPose(category, def.poseKey)),
  }));
}

export const poseTemplates: Record<GarmentCategory, PoseTemplate[]> = {
  tops: buildTemplates('tops'),
  bottoms: buildTemplates('bottoms'),
  'one-pieces': buildTemplates('one-pieces'),
  auto: buildTemplates('auto'),
};

// Export for introspection/debugging
export { VISIBILITY_REGIONS, POSE_BODY, POSE_CATALOG };
