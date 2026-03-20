/**
 * Structured background prompt system for catalog generation.
 *
 * Architecture: 5 composable layers
 * 1. Scene — the physical environment
 * 2. Lighting — direction, quality, color temperature (decoupled from scene)
 * 3. Depth — lens behavior, blur, subject separation
 * 4. Style — photography mood/genre
 * 5. Camera — lens focal length, angle, framing
 *
 * Multiple variants per category prevent samey outputs.
 * At generation time, a variant is picked by index (deterministic per batch position).
 */

// ============================================================
// LIGHTING LIBRARY (Decoupled — composable with any background)
// ============================================================

export interface LightingPreset {
  id: string;
  label: string;
  prompt: string;
}

export const LIGHTING: Record<string, LightingPreset> = {
  SOFT_DIFFUSED: {
    id: 'soft-diffused',
    label: 'Soft Diffused',
    prompt: 'soft diffused lighting, no harsh shadows, even illumination',
  },
  SOFT_DIRECTIONAL: {
    id: 'soft-directional',
    label: 'Soft Directional',
    prompt: 'soft directional key light from left, gentle fill from right, controlled shadows',
  },
  GOLDEN_HOUR: {
    id: 'golden-hour',
    label: 'Golden Hour',
    prompt: 'warm golden hour sunlight from side, warm tones on skin, long soft shadows',
  },
  NATURAL_WINDOW: {
    id: 'natural-window',
    label: 'Natural Window',
    prompt: 'natural window light, soft and directional, subtle warm shadows',
  },
  HIGH_KEY: {
    id: 'high-key',
    label: 'High Key',
    prompt: 'bright high-key lighting, minimal shadows, clean and airy',
  },
  DRAMATIC: {
    id: 'dramatic',
    label: 'Dramatic',
    prompt: 'dramatic side lighting, defined shadows, editorial contrast',
  },
  OVERCAST: {
    id: 'overcast',
    label: 'Overcast',
    prompt: 'overcast natural daylight, soft even illumination, no harsh shadows',
  },
};

// ============================================================
// CAMERA PRESETS
// ============================================================

export interface CameraPreset {
  id: string;
  label: string;
  prompt: string;
}

export const CAMERA: Record<string, CameraPreset> = {
  ECOMMERCE: {
    id: 'ecommerce',
    label: 'E-Commerce',
    prompt: '50mm lens, eye-level shot, sharp focus, realistic proportions',
  },
  EDITORIAL: {
    id: 'editorial',
    label: 'Editorial',
    prompt: '85mm lens, shallow depth of field, cinematic framing',
  },
  PORTRAIT: {
    id: 'portrait',
    label: 'Portrait',
    prompt: '85mm lens, tight crop, beautiful subject separation, creamy bokeh',
  },
  WIDE: {
    id: 'wide',
    label: 'Wide',
    prompt: '35mm lens, full environment visible, natural perspective',
  },
};

// ============================================================
// NEGATIVE PROMPT (appended to all generations)
// ============================================================

export const NEGATIVE_PROMPT = 'No text overlays, no watermarks, no logos, no distorted faces, no extra limbs, no bad anatomy, no oversaturated colors, no blurry output, no messy background elements.';

// ============================================================
// BACKGROUND CONFIGS
// ============================================================

export interface BackgroundConfig {
  scene: string;
  lighting: string;
  depth: string;
  style: string;
}

export interface BackgroundPresetGroup {
  id: string;
  label: string;
  fallbackHex?: string;
  defaultLighting: string;
  defaultCamera: string;
  variants: BackgroundConfig[];
}

function buildPrompt(bg: BackgroundConfig): string {
  // Keep it tight — scene + lighting is enough, depth/style handled by pose template
  return `${bg.scene}, ${bg.lighting}`;
}

export function getBackgroundPrompt(group: BackgroundPresetGroup): string {
  const variant = group.variants[Math.floor(Math.random() * group.variants.length)];
  return buildPrompt(variant);
}

export function getBackgroundPromptByIndex(group: BackgroundPresetGroup, index: number): string {
  const variant = group.variants[index % group.variants.length];
  return buildPrompt(variant);
}

// ============================================================
// STUDIO BACKGROUNDS
// ============================================================

export const STUDIO_WHITE: BackgroundPresetGroup = {
  id: 'studio-white',
  label: 'Studio White',
  fallbackHex: '#FFFFFF',
  defaultLighting: LIGHTING.HIGH_KEY.prompt,
  defaultCamera: CAMERA.ECOMMERCE.prompt,
  variants: [
    {
      scene: 'pure clean white seamless studio background',
      lighting: 'soft diffused lighting from front, minimal shadows on backdrop',
      depth: 'sharp focus on subject, clean separation from background',
      style: 'high-key professional fashion catalog photography',
    },
    {
      scene: 'bright white infinity wall studio backdrop',
      lighting: 'even softbox lighting from both sides, no harsh shadows',
      depth: 'subject in sharp focus, background uniformly lit',
      style: 'premium e-commerce product photography',
    },
    {
      scene: 'clean white cyclorama studio background',
      lighting: 'overhead strip lights with front fill, subtle floor reflection',
      depth: 'full body sharp, background smooth and distraction-free',
      style: 'professional fashion catalog, commercial grade',
    },
    {
      scene: 'pristine white studio with seamless paper roll',
      lighting: 'rim light from behind with soft frontal fill, clean highlights',
      depth: 'sharp subject with clean white negative space',
      style: 'luxury brand catalog photography, clean and modern',
    },
  ],
};

export const SOFT_GREY: BackgroundPresetGroup = {
  id: 'soft-grey',
  label: 'Soft Grey',
  fallbackHex: '#E8E8E8',
  defaultLighting: LIGHTING.SOFT_DIRECTIONAL.prompt,
  defaultCamera: CAMERA.ECOMMERCE.prompt,
  variants: [
    {
      scene: 'light grey seamless studio background',
      lighting: 'soft gradient lighting, subtle directional shadow to the right',
      depth: 'sharp focus on subject, clean smooth background',
      style: 'neutral premium catalog photography, balanced tones',
    },
    {
      scene: 'cool-toned grey studio backdrop',
      lighting: 'balanced diffused light, soft shadow under feet',
      depth: 'subject isolated with clean edges',
      style: 'modern clean fashion photography, e-commerce ready',
    },
    {
      scene: 'medium grey seamless paper studio background',
      lighting: 'soft key light from left, gentle fill from right, controlled shadows',
      depth: 'sharp subject, smooth gradient falloff on background',
      style: 'editorial fashion catalog, professional lighting setup',
    },
    {
      scene: 'charcoal to light grey gradient studio backdrop',
      lighting: 'centered spot with soft falloff, subtle vignette',
      depth: 'subject sharp against smooth tonal gradient',
      style: 'dramatic yet clean catalog photography, depth through tone',
    },
  ],
};

export const WARM_BEIGE: BackgroundPresetGroup = {
  id: 'warm-beige',
  label: 'Warm Beige',
  fallbackHex: '#F5F0E8',
  defaultLighting: LIGHTING.SOFT_DIFFUSED.prompt,
  defaultCamera: CAMERA.ECOMMERCE.prompt,
  variants: [
    {
      scene: 'warm beige studio background with subtle linen texture',
      lighting: 'soft natural-feel lighting, warm color temperature',
      depth: 'subject sharp, background slightly soft, intimate feel',
      style: 'cozy premium fashion aesthetic, lifestyle catalog',
    },
    {
      scene: 'sand tone studio backdrop',
      lighting: 'diffused sunlight simulation, warm golden undertones',
      depth: 'clean subject separation, creamy smooth background',
      style: 'elegant minimalist fashion photography',
    },
    {
      scene: 'muted cream studio background',
      lighting: 'soft wraparound lighting, gentle warmth, minimal shadows',
      depth: 'full body in focus, background uniform and distraction-free',
      style: 'premium boutique catalog style, natural tones preserved',
    },
    {
      scene: 'warm taupe studio background with subtle warmth',
      lighting: 'soft ambient fill with hint of warm side light',
      depth: 'sharp subject, background smooth and consistent',
      style: 'earthy modern fashion catalog, organic aesthetic',
    },
  ],
};

// ============================================================
// OUTDOOR BACKGROUNDS
// ============================================================

export const OUTDOOR_URBAN: BackgroundPresetGroup = {
  id: 'outdoor-urban',
  label: 'Urban Street',
  defaultLighting: LIGHTING.OVERCAST.prompt,
  defaultCamera: CAMERA.EDITORIAL.prompt,
  variants: [
    {
      scene: 'modern city street with clean architecture',
      lighting: 'natural daylight, soft shadows, open shade',
      depth: 'shallow depth of field, blurred urban environment behind subject',
      style: 'street style fashion photography, realistic urban setting',
    },
    {
      scene: 'European cobblestone street with classic building facades',
      lighting: 'soft natural afternoon light, gentle side illumination',
      depth: 'creamy bokeh on background architecture, 85mm perspective',
      style: 'premium lifestyle fashion editorial, cinematic quality',
    },
    {
      scene: 'minimalist modern building exterior with clean lines and glass',
      lighting: 'even natural daylight, cloud-diffused sun, no harsh shadows',
      depth: 'subject sharp, architectural background with pleasant bokeh',
      style: 'contemporary urban fashion photography, editorial grade',
    },
    {
      scene: 'quiet alley with warm-toned walls and subtle signage',
      lighting: 'diffused light bouncing off walls, warm ambient glow',
      depth: 'narrow depth, walls softly blurred, subject prominent',
      style: 'intimate street fashion photography, European city vibe',
    },
    {
      scene: 'modern cafe storefront with large windows and warm interior glow',
      lighting: 'natural overcast light with warm bounce from interior',
      depth: 'subject sharp, cafe interior softly blurred through glass',
      style: 'lifestyle urban fashion, aspirational everyday setting',
    },
  ],
};

export const OUTDOOR_NATURE: BackgroundPresetGroup = {
  id: 'outdoor-nature',
  label: 'Nature',
  defaultLighting: LIGHTING.GOLDEN_HOUR.prompt,
  defaultCamera: CAMERA.EDITORIAL.prompt,
  variants: [
    {
      scene: 'natural outdoor setting with lush greenery and trees',
      lighting: 'golden hour sunlight from side, warm tones on skin',
      depth: 'shallow depth of field with creamy bokeh on foliage',
      style: 'cinematic lifestyle fashion photography',
    },
    {
      scene: 'park with soft grass and blurred tree canopy',
      lighting: 'diffused sunlight filtering through leaves, dappled light pattern',
      depth: 'subject sharp, dreamy out-of-focus natural background',
      style: 'relaxed outdoor fashion shoot, organic feel',
    },
    {
      scene: 'garden path with flowering plants in soft focus',
      lighting: 'warm afternoon sun with gentle fill, natural color palette',
      depth: 'tight depth of field, flowers and greenery melting into bokeh',
      style: 'romantic lifestyle photography, fashion editorial quality',
    },
    {
      scene: 'open field with tall grass and distant horizon',
      lighting: 'late afternoon sun behind subject creating rim light',
      depth: 'wide open background with smooth gradient blur',
      style: 'expansive natural landscape fashion shoot, freedom aesthetic',
    },
    {
      scene: 'tropical setting with palm fronds and soft natural textures',
      lighting: 'bright tropical light, softened by foliage overhead',
      depth: 'palm leaves in foreground blur, subject sharp in middle ground',
      style: 'resort wear fashion photography, vacation catalog feel',
    },
  ],
};

export const OUTDOOR_BEACH: BackgroundPresetGroup = {
  id: 'outdoor-beach',
  label: 'Beach',
  defaultLighting: LIGHTING.GOLDEN_HOUR.prompt,
  defaultCamera: CAMERA.EDITORIAL.prompt,
  variants: [
    {
      scene: 'sandy beach with gentle waves and clear horizon',
      lighting: 'golden hour warm sidelight, sun low on horizon',
      depth: 'ocean softly blurred, sand texture visible near subject',
      style: 'beach fashion editorial, warm coastal tones',
    },
    {
      scene: 'white sand beach with turquoise water in distance',
      lighting: 'bright tropical sunlight softened by high clouds',
      depth: 'subject sharp, water and sky in beautiful soft bokeh',
      style: 'resort fashion catalog, aspirational tropical setting',
    },
    {
      scene: 'rocky coastline with dramatic sky',
      lighting: 'overcast dramatic light, moody contrast',
      depth: 'rocks in foreground soft, subject centered and sharp',
      style: 'rugged coastal fashion editorial, atmospheric mood',
    },
  ],
};

// ============================================================
// PREMIUM / LIFESTYLE BACKGROUNDS
// ============================================================

export const PREMIUM_INTERIOR: BackgroundPresetGroup = {
  id: 'premium-interior',
  label: 'Premium Interior',
  defaultLighting: LIGHTING.NATURAL_WINDOW.prompt,
  defaultCamera: CAMERA.EDITORIAL.prompt,
  variants: [
    {
      scene: 'luxury hotel lobby with marble floors and warm wood accents',
      lighting: 'ambient interior lighting with soft window light from side',
      depth: 'shallow depth of field, elegant interior blurred behind',
      style: 'high-end lifestyle fashion photography, aspirational setting',
    },
    {
      scene: 'modern minimalist apartment with large floor-to-ceiling windows',
      lighting: 'natural window light flooding in, soft and directional',
      depth: 'subject isolated, interior space beautifully defocused',
      style: 'editorial fashion shoot, contemporary luxury aesthetic',
    },
    {
      scene: 'elegant balcony with stone railing and distant cityscape',
      lighting: 'soft golden hour backlight with fill from reflector',
      depth: 'subject sharp, panoramic background in beautiful bokeh',
      style: 'premium lifestyle composition, European aesthetic',
    },
    {
      scene: 'upscale lounge with leather seating and warm ambient light',
      lighting: 'warm tungsten ambient with soft accent lighting',
      depth: 'intimate depth, lounge furniture softly blurred',
      style: 'evening wear catalog photography, sophisticated mood',
    },
    {
      scene: 'art gallery with white walls and curated pieces in background',
      lighting: 'clean gallery track lighting, soft and even',
      depth: 'subject sharp, art pieces visible but not competing',
      style: 'cultural luxury fashion editorial, refined taste',
    },
  ],
};

export const PREMIUM_ROOFTOP: BackgroundPresetGroup = {
  id: 'premium-rooftop',
  label: 'Rooftop',
  defaultLighting: LIGHTING.GOLDEN_HOUR.prompt,
  defaultCamera: CAMERA.EDITORIAL.prompt,
  variants: [
    {
      scene: 'rooftop terrace with city skyline panorama',
      lighting: 'sunset golden light with warm city glow',
      depth: 'skyline in soft bokeh, subject sharp against sky',
      style: 'urban luxury lifestyle fashion, aspirational heights',
    },
    {
      scene: 'modern rooftop garden with planters and lounge furniture',
      lighting: 'late afternoon sun, warm directional light',
      depth: 'greenery and furniture softly blurred, subject prominent',
      style: 'premium lifestyle photography, contemporary urban living',
    },
    {
      scene: 'minimalist rooftop with clean railing and open sky',
      lighting: 'even overcast sky providing soft natural light',
      depth: 'clean sky background, subject sharp with sky separation',
      style: 'clean modern fashion editorial, elevated perspective',
    },
  ],
};

// ============================================================
// TEXTURED / ARTISTIC BACKGROUNDS
// ============================================================

export const TEXTURED_WALL: BackgroundPresetGroup = {
  id: 'textured-wall',
  label: 'Textured Wall',
  defaultLighting: LIGHTING.SOFT_DIRECTIONAL.prompt,
  defaultCamera: CAMERA.ECOMMERCE.prompt,
  variants: [
    {
      scene: 'subtle concrete textured wall background',
      lighting: 'soft directional light from left, controlled shadows on wall',
      depth: 'subject sharp, wall texture visible but not distracting',
      style: 'modern editorial fashion photography, industrial chic',
    },
    {
      scene: 'aged brick wall with warm terracotta patina',
      lighting: 'natural sidelight, warm tones, gentle shadow play',
      depth: 'tight focus on subject, wall texture in slight soft focus',
      style: 'vintage-inspired fashion editorial, character-rich backdrop',
    },
    {
      scene: 'smooth plaster wall in muted earthy olive tone',
      lighting: 'even diffused light, minimal shadows, gallery-like feel',
      depth: 'clean subject focus, wall provides subtle visual interest',
      style: 'minimalist fashion photography, boutique catalog aesthetic',
    },
    {
      scene: 'whitewashed rustic wall with subtle cracks and character',
      lighting: 'soft natural light, Mediterranean warmth',
      depth: 'subject sharp, wall texture adds depth without distraction',
      style: 'coastal rustic fashion editorial, relaxed European vibe',
    },
    {
      scene: 'dark moody wall with dramatic texture and depth',
      lighting: 'focused spot on subject, wall falls into shadow',
      depth: 'strong subject separation through lighting contrast',
      style: 'dramatic fashion editorial, high contrast, premium feel',
    },
  ],
};

export const PASTEL_STUDIO: BackgroundPresetGroup = {
  id: 'pastel-studio',
  label: 'Pastel Pop',
  defaultLighting: LIGHTING.HIGH_KEY.prompt,
  defaultCamera: CAMERA.ECOMMERCE.prompt,
  variants: [
    {
      scene: 'solid soft pastel pink studio background',
      lighting: 'bright even lighting, cheerful and fresh aesthetic',
      depth: 'subject sharp, clean flat background with no distractions',
      style: 'vibrant modern e-commerce photography, color-forward catalog',
    },
    {
      scene: 'muted pastel blue studio backdrop',
      lighting: 'soft cool-toned lighting, contemporary feel',
      depth: 'clean separation, subject pops against colored background',
      style: 'trendy fashion catalog style, social media ready',
    },
    {
      scene: 'soft mint green studio background',
      lighting: 'gentle diffused lighting, fresh natural tones',
      depth: 'subject isolated on clean colored backdrop',
      style: 'modern fresh catalog photography, youthful aesthetic',
    },
    {
      scene: 'warm lavender studio background',
      lighting: 'soft warm-toned lighting, gentle and inviting',
      depth: 'subject clear against uniform pastel backdrop',
      style: 'boutique fashion catalog, feminine modern aesthetic',
    },
    {
      scene: 'soft peach studio backdrop',
      lighting: 'warm flattering light, skin tones enhanced',
      depth: 'clean subject separation, smooth uniform background',
      style: 'warm contemporary fashion photography, approachable luxury',
    },
  ],
};

// ============================================================
// SEASONAL / SPECIAL BACKGROUNDS
// ============================================================

export const FESTIVE_INDIAN: BackgroundPresetGroup = {
  id: 'festive-indian',
  label: 'Festive',
  defaultLighting: LIGHTING.SOFT_DIFFUSED.prompt,
  defaultCamera: CAMERA.EDITORIAL.prompt,
  variants: [
    {
      scene: 'ornate palace courtyard with intricate arches and warm sandstone',
      lighting: 'warm ambient light with golden accents, festive glow',
      depth: 'architecture softly blurred, subject sharp in foreground',
      style: 'Indian festive wear photography, cultural elegance',
    },
    {
      scene: 'marigold and diya decorated setting with warm fabrics',
      lighting: 'warm golden light, candle-like ambient glow',
      depth: 'decorations in soft bokeh, subject prominent',
      style: 'Diwali collection catalog, festive warmth and celebration',
    },
    {
      scene: 'haveli courtyard with traditional jali screens and potted plants',
      lighting: 'natural light filtering through jali patterns',
      depth: 'intricate patterns in soft focus, subject sharp',
      style: 'traditional Indian fashion editorial, heritage aesthetic',
    },
  ],
};

export const MINIMAL_GRADIENT: BackgroundPresetGroup = {
  id: 'minimal-gradient',
  label: 'Minimal Gradient',
  defaultLighting: LIGHTING.SOFT_DIFFUSED.prompt,
  defaultCamera: CAMERA.ECOMMERCE.prompt,
  variants: [
    {
      scene: 'smooth gradient background from light grey to white',
      lighting: 'even front lighting, clean professional look',
      depth: 'subject sharp, gradient provides subtle depth',
      style: 'modern catalog photography, clean and contemporary',
    },
    {
      scene: 'warm gradient background from beige to soft white',
      lighting: 'gentle warm illumination, flattering skin tones',
      depth: 'subject isolated on smooth tonal transition',
      style: 'premium e-commerce photography, warm and inviting',
    },
    {
      scene: 'cool blue-grey gradient background, darker at edges',
      lighting: 'centered soft light, natural vignette effect',
      depth: 'subject highlighted by gradient, clean isolation',
      style: 'modern editorial catalog, subtle drama through tone',
    },
  ],
};

// ============================================================
// ALL BACKGROUNDS (for UI selection / Telegram keyboard)
// ============================================================

export const ALL_BACKGROUNDS: BackgroundPresetGroup[] = [
  // Studio
  STUDIO_WHITE,
  SOFT_GREY,
  WARM_BEIGE,
  PASTEL_STUDIO,
  MINIMAL_GRADIENT,
  // Outdoor
  OUTDOOR_URBAN,
  OUTDOOR_NATURE,
  OUTDOOR_BEACH,
  // Premium
  PREMIUM_INTERIOR,
  PREMIUM_ROOFTOP,
  TEXTURED_WALL,
  // Special
  FESTIVE_INDIAN,
];

/** Default background for catalog generation */
/** Default: Beach gives the best first impression (golden hour, premium feel) */
export const DEFAULT_BACKGROUND = OUTDOOR_BEACH;
