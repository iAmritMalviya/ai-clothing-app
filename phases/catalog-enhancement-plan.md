# Catalog Enhancement Plan — Pose-Controlled Clothing Transfer

**Created**: 2026-03-14
**Core UX**: User uploads garment photo → gets 4-6 professional e-commerce catalog images with different poses
**Principle**: This is **pose-controlled clothing transfer**, not image generation

---

## The Three Constraints (First Principles)

Every generated image must satisfy three constraints simultaneously:

```
1. Garment constraint  → the uploaded clothing must be preserved EXACTLY (color, pattern, texture, logo)
2. Pose constraint     → the model's body pose must match the template (front, back, 3/4, editorial)
3. Context constraint  → lighting, framing, and camera must look like a professional fashion shoot
```

**Critical rule**: Never describe the garment in text prompts. Always say **"wearing the garment from the uploaded image"**. The image IS the constraint — text descriptions create conflicts.

---

## Current State (What We Have)

| Component | Status | Notes |
|-----------|--------|-------|
| Gemini SDK try-on | Working | Free tier (500 images/day), ~15-25s per image |
| Category-aware poses | Working | tops → torso, bottoms → full body, one-pieces → full body |
| 4 model presets | Working | AI-generated via flux (Casual Tee, Henley, Polo, Shirt Formal) |
| Batch catalog system | Working | Upload → 4 parallel try-ons → batch_id groups results |
| Pose templates | Working | `pose-templates.ts` with category-indexed prompt arrays |
| Frontend catalog page | Working | 2-column grid, per-image download, processing time |

### What's Wrong

1. **Poses locked to presets** — 4 presets = exactly 4 poses. These should be independent axes.
2. **No garment auto-detection** — user manually selects category (tops/bottoms/one-pieces)
3. **No post-processing** — raw Gemini output served directly (inconsistent brightness, aspect ratio)
4. **No pose reference images** — text prompts only, no visual pose constraint
5. **No retry for failed images** — if 1 of 4 fails, user can't regenerate just that one
6. **No "Download All"** — user downloads images one by one
7. **Prompt-only = inconsistent** — same prompt can produce wildly different poses each run

---

## Architecture Fix: Decouple Poses from Presets

**Current (wrong)**:
```
4 model presets → 4 images (1 pose per preset)
```

**Correct**:
```
Model preset = body/face reference (WHO the model is)
Pose template = pose description   (HOW the model stands)
These are independent.
```

This means:
- 1 preset + 6 pose templates = 6 catalog images (same model, 6 different poses)
- User picks how many images they want (4, 6, or 8)
- Category determines WHICH pose templates are used (tops → torso poses, bottoms → full body)

### New Data Flow

```
User uploads garment
       ↓
Auto-detect category (Gemini text — free, fast, ~1s)
       ↓
Select pose templates for that category
       ↓
Pick model reference image (1 preset or user's custom model)
       ↓
Generate N images in parallel (same model, different poses)
       ↓
Post-process (normalize, crop, sharpen)
       ↓
Return catalog
```

---

## Implementation Plan

### Sprint 1: Core Quality (Backend — 1-2 days)

**Goal**: Better prompts, auto-detection, decoupled poses, more variety

#### 1.1 — Auto-detect garment category using Gemini

Instead of the user selecting "Tops / Bottoms / One-Pieces", use Gemini's text model to classify the garment automatically. This is a single text API call (~1s, free).

**File**: `backend/src/lib/ai-client.ts`

```typescript
export async function detectGarmentCategory(imageBuffer: Buffer, mimeType: string): Promise<GarmentCategory> {
  const response = await gemini.models.generateContent({
    model: 'gemini-2.0-flash',  // text model, not image model — fast + free
    contents: [
      {
        role: 'user',
        parts: [
          bufferToBase64Part(imageBuffer, mimeType),
          { text: 'Classify this clothing item into exactly one category. Reply with ONLY one word: tops, bottoms, or one-pieces. tops = shirts, t-shirts, jackets, hoodies, sweaters. bottoms = jeans, trousers, shorts, skirts. one-pieces = dresses, jumpsuits, suits, kurta sets.' },
        ],
      },
    ],
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
  if (text === 'tops' || text === 'bottoms' || text === 'one-pieces') return text;
  return 'auto'; // fallback
}
```

**File**: `backend/src/modules/tryon/services/tryon-service.ts` — `createCatalog()`

```typescript
// Auto-detect if category is 'auto'
if (category === 'auto') {
  category = await detectGarmentCategory(garmentBuffer, garmentMime);
  console.log(`[catalog] auto-detected category: ${category}`);
}
```

**Frontend**: Keep the category selector but default to "Auto Detect". The backend does the real work.

#### 1.2 — Decouple poses from presets

Currently `createCatalog` generates exactly `presets.length` images (4). Change this:

- Add `imageCount` parameter to catalog endpoint (default: 4, max: 8)
- Pick a single model preset (or let user choose)
- Generate `imageCount` poses from the category's template list
- Cycle through templates if imageCount > templates.length

**File**: `backend/src/modules/tryon/services/tryon-service.ts`

The catalog function changes from "iterate over presets" to "iterate over pose templates":

```typescript
interface CreateCatalogInput {
  userId: string;
  garmentBuffer: Buffer;
  garmentFilename: string;
  category: GarmentCategory;
  imageCount?: number;  // NEW — default 4, max 8
}

export async function createCatalog(db, storage, input) {
  const { category, imageCount = 4 } = input;

  // Auto-detect category if 'auto'
  const resolvedCategory = category === 'auto'
    ? await detectGarmentCategory(garmentBuffer, garmentMime)
    : category;

  // Get pose templates for this category
  const templates = poseTemplates[resolvedCategory];

  // Pick model preset (use first active preset, or round-robin for variety)
  const presets = await db('model_presets').where({ is_active: true });
  const modelPreset = presets[0]; // or user-selected
  const modelBuffer = await readModelImage(modelPreset.image_url);
  const modelMime = getMimeType(modelPreset.image_url);

  // Generate N images — one per pose template
  const jobs = [];
  for (let i = 0; i < imageCount; i++) {
    const posePrompt = templates[i % templates.length];
    // create job, run tryOnGarment with this pose
  }
}
```

#### 1.3 — Expand pose templates to 6 per category

**File**: `backend/src/lib/pose-templates.ts`

Add 2 more templates per category:

**Tops (6 total)**:
1. Standard catalogue — hands in pockets, torso visible
2. Slight turn — body angled, head facing camera
3. Looking off-camera — editorial feel
4. Adjusting sleeve — natural action pose
5. Casual lean — leaning against wall, lifestyle
6. Back view — shows back of garment

**Bottoms (6 total)**:
1. Standard full body — upright, hands in pockets
2. Walking pose — natural stride toward camera
3. One leg forward — relaxed stance
4. Side angle — body sideways, face to camera
5. Sitting on stool — casual lifestyle
6. Back view full body — shows back of garment

#### 1.4 — Pose labels on each template

Add a `label` field to each template so the frontend can display what pose each image is:

```typescript
interface PoseTemplate {
  label: string;   // "Front View", "Back View", "Three-Quarter", etc.
  prompt: string;  // The full prompt text
}

export const poseTemplates: Record<GarmentCategory, PoseTemplate[]> = {
  tops: [
    { label: 'Front View', prompt: 'Professional fashion catalogue photo...' },
    { label: 'Side Turn', prompt: 'Studio fashion photoshoot...' },
    { label: 'Editorial', prompt: 'High-end fashion editorial...' },
    { label: 'Sleeve Detail', prompt: 'Professional fashion photography...' },
    { label: 'Lifestyle', prompt: 'Lifestyle fashion photograph...' },
    { label: 'Back View', prompt: 'Studio fashion photograph showing the back...' },
  ],
  // ...
};
```

The backend returns `pose_label` in the job response so the frontend can show it.

---

### Sprint 2: Frontend Polish (1-2 days)

**Goal**: Better UX for the catalog experience

#### 2.1 — Image count selector on dashboard

Replace (or augment) the category selector with an image count picker:

```
[4 photos] [6 photos] [8 photos]
```

Default: 4. This maps to `imageCount` on the API call.

#### 2.2 — Pose labels on results

Each image in the catalog grid shows its pose label:

```
┌─────────────────┐  ┌─────────────────┐
│                  │  │                  │
│  (generated img) │  │  (generated img) │
│                  │  │                  │
├─────────────────┤  ├─────────────────┤
│ Front View  ↓   │  │ Side Turn   ↓   │
└─────────────────┘  └─────────────────┘
```

The `↓` is the download button. The label comes from `pose_label` on the job record.

#### 2.3 — Download All as ZIP

Add a "Download All" button that bundles all completed images into a ZIP.

**Option A (simple)**: Use `JSZip` on the frontend — fetch each image, bundle, trigger download.
**Option B**: Backend endpoint `GET /api/tryon/batch/:batchId/download` returns a ZIP.

Option A is simpler, no backend changes:

```typescript
import JSZip from 'jszip';

async function downloadAll(jobs: Job[]) {
  const zip = new JSZip();
  await Promise.all(
    jobs.map(async (job, i) => {
      const res = await fetch(resolveImageUrl(job.output_image_url!));
      const blob = await res.blob();
      zip.file(`catalog-${i + 1}.png`, blob);
    })
  );
  const content = await zip.generateAsync({ type: 'blob' });
  // trigger download
}
```

#### 2.4 — Retry failed images

If a job in the batch failed, show a "Retry" button. On click:
- `POST /api/tryon/retry` with `{ jobId }` (new endpoint)
- Backend re-reads the garment + model + pose template, re-runs tryOnGarment
- Updates the existing job record

This requires storing `pose_index` or `pose_label` on the job so we know which template to retry with.

#### 2.5 — Processing progress

Currently shows a spinner for ~20s with no feedback. Improve:
- After uploading, navigate immediately to `/catalog/{batchId}`
- Poll `GET /api/tryon/batch/:batchId` every 3s
- Show images as they complete (some will finish before others)
- Stop polling when all jobs are completed/failed

This gives the user a "watching results appear" experience instead of a blank loading state.

---

### Sprint 3: Image Quality (3-5 days)

**Goal**: Post-processing pipeline for consistent, professional output

#### 3.1 — Consistent aspect ratio + crop

Use `sharp` to normalize all Gemini outputs:
- Target: 3:4 aspect ratio (standard e-commerce)
- Center crop if Gemini returns a different ratio
- Consistent output dimensions: 768x1024

```typescript
import sharp from 'sharp';

async function normalizeOutput(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(768, 1024, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();
}
```

#### 3.2 — Brightness + contrast normalization

Gemini produces inconsistent lighting across the 4-6 images. Normalize:

```typescript
async function normalizeLighting(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .normalize()         // stretch histogram to full range
    .sharpen({ sigma: 0.5 })  // subtle sharpening
    .png()
    .toBuffer();
}
```

This is fast (~50ms) and dramatically improves visual consistency across catalog images.

#### 3.3 — Background consistency check

If the prompt asks for "clean studio background" but Gemini adds random elements, we can:
1. Run background removal on the output (BiRefNet — already have this)
2. Composite onto a clean white/grey background

This is an optional post-processing step, triggered if the output looks "noisy".

#### 3.4 — Garment validation before processing

Before burning 4-6 Gemini calls, validate the uploaded image:
- Is it actually clothing? (Gemini text classification, same as auto-detect)
- Is it high enough resolution? (sharp metadata — reject < 256px)
- Is it a valid image format? (already have `image-validation.ts`)

Saves the user from waiting 20s for garbage results.

---

### Sprint 4: Advanced Quality (1-2 weeks, optional)

**Goal**: Move toward Myntra-level consistency

#### 4.1 — Pose reference images (biggest quality jump)

**This is the single most impactful improvement.** The user's knowledge is correct: prompts alone are inconsistent. Adding a **visual pose reference** dramatically improves consistency.

**How it works:**
- Store 6 pose reference images per category (real model photos in specific poses)
- Pass as a third image input to Gemini: `[garment, pose_reference, text_prompt]`
- The prompt says: "Match the exact body pose from the second image"
- The pose reference constrains the output more than text ever can

**Storage**: `uploads/pose-references/tops/front.jpg`, `uploads/pose-references/tops/back.jpg`, etc.
**Source**: Download from stock photo sites or generate once via Gemini and curate the best ones.

**Changes to ai-client.ts**:
```typescript
contents: [
  {
    role: 'user',
    parts: [
      bufferToBase64Part(garmentImageBuffer, garmentImageMime),        // image 1: garment
      bufferToBase64Part(poseReferenceBuffer, poseReferenceMime),      // image 2: pose reference
      bufferToBase64Part(modelReferenceBuffer, modelReferenceMime),    // image 3: model identity
      { text: fullPrompt },
    ],
  },
],
```

The prompt becomes:
```
Professional fashion catalogue photo. The model should match the face and body type from the third image.
The model's body pose must exactly match the pose shown in the second image.
The model is wearing the garment from the first image — reproduce it exactly.
No text overlays, no watermarks.
```

This gives Gemini THREE visual constraints: garment (exact), pose (exact), model identity (approximate). Much more controlled than prompt-only.

#### 4.2 — Model identity consistency

Currently each of the 4-6 images may produce a slightly different-looking model. Fix:
- Use a single high-quality model reference image
- Include "the same male fashion model" in every prompt (already doing this)
- Post-process: if face consistency is poor, consider face-swap using a reference

#### 4.3 — FASHN Direct API integration (when needed)

If Gemini quality plateaus, FASHN's direct API offers:
- `product-to-model` — flat-lay garment → on-model (no reference needed)
- `tryon-v1.6` — proper diffusion-based try-on (higher garment fidelity)
- `model-create` — generate consistent AI models optimized for their pipeline

This is the "break glass" option if prompt-based Gemini isn't cutting it.

**Cost**: $0.075/image vs $0 (Gemini free tier). Worth it if quality gap is significant.

---

## Prompt Library (Final, Production-Ready)

### TOPS (6 prompts)

```
1. FRONT VIEW
Professional fashion catalogue photo of the same male fashion model, standing confidently, hands casually in pockets, torso clearly visible, wearing the garment from the uploaded image. Clean light grey studio background, soft professional lighting, sharp focus, ultra realistic fabric texture, premium e-commerce fashion photography.

2. SIDE TURN
Studio fashion photoshoot of the same male fashion model, standing in a relaxed pose with body slightly turned sideways, head facing directly toward the camera, hands relaxed at sides, wearing the garment from the uploaded image. Neutral studio background, soft diffused lighting, torso fully visible, high-end clothing catalogue photography.

3. EDITORIAL (OFF-CAMERA GAZE)
High-end fashion editorial photo of the same male fashion model, standing with relaxed posture, one shoulder slightly forward, gaze directed confidently off-camera to the side, wearing the garment from the uploaded image. Clean minimal studio background, soft fashion lighting, realistic fabric textures, upper body clearly in frame.

4. SLEEVE DETAIL
Professional fashion photography of the same male fashion model adjusting his sleeve with one hand while standing naturally, wearing the garment from the uploaded image. Clean light studio background, premium clothing catalogue style, highly detailed realistic fabric, torso clearly visible.

5. LIFESTYLE LEAN
Lifestyle fashion photograph of the same male fashion model leaning slightly against a wall with relaxed posture, hands casually positioned, wearing the garment from the uploaded image. Minimal modern background, soft lighting, editorial fashion shoot style, upper body clearly visible.

6. BACK VIEW
Studio fashion photograph showing the back view of the same male fashion model, standing straight with relaxed posture, arms naturally at sides, wearing the garment from the uploaded image. Neutral studio background, soft diffused lighting, full back of garment clearly visible, high-detail fashion catalogue photography.
```

### BOTTOMS (6 prompts)

```
1. FRONT VIEW (FULL BODY)
Full body professional fashion catalogue photograph of the same male fashion model, standing upright with relaxed posture, hands casually in pockets, wearing the garment from the uploaded image. Clean studio background, soft even lighting, full body from head to feet visible, premium e-commerce photography.

2. WALKING POSE
Full body fashion photoshoot of the same male fashion model walking naturally toward the camera with confident posture, wearing the garment from the uploaded image. Modern studio background, natural lighting, full body from head to feet visible, realistic premium clothing photography.

3. ONE LEG FORWARD
Full body fashion photograph of the same male fashion model, standing with one leg slightly forward in a natural relaxed stance, hands casually positioned, wearing the garment from the uploaded image. Neutral studio background, soft professional lighting, complete garment from waist to feet clearly visible, high-end catalogue photography.

4. SIDE ANGLE
Full body studio fashion image of the same male fashion model, body angled sideways while face and eyes turned confidently toward the camera, relaxed posture, wearing the garment from the uploaded image. Clean background, soft diffused lighting, full leg and garment visible, premium fashion photography.

5. SITTING ON STOOL
Full body fashion lifestyle photo of the same male fashion model sitting casually on a stool with relaxed posture, wearing the garment from the uploaded image. Modern studio environment, soft natural lighting, complete garment from waist to feet visible, high-end fashion editorial photography.

6. BACK VIEW (FULL BODY)
Full body fashion catalogue photograph showing the back view of the same male fashion model, standing straight with natural posture, arms relaxed, wearing the garment from the uploaded image. Neutral studio background, soft even lighting, complete back of garment from waist to feet visible, detailed e-commerce clothing photography.
```

### ONE-PIECES (6 prompts)

```
1. FRONT VIEW (FULL BODY)
Full body professional fashion catalogue photograph of the same male fashion model, standing upright with relaxed posture, hands casually in pockets, wearing the garment from the uploaded image. Clean studio background, soft even lighting, complete outfit from head to feet visible, premium e-commerce fashion photography.

2. SIDE TURN (FULL BODY)
Full body studio fashion photoshoot of the same male fashion model, standing with body slightly turned sideways, head facing the camera, hands relaxed, wearing the garment from the uploaded image. Neutral studio background, soft diffused lighting, entire outfit clearly visible, high-end clothing catalogue photography.

3. THREE-QUARTER ANGLE
Full body professional fashion photoshoot of the same male fashion model in a confident three-quarter pose, body slightly turned away from the camera while the face is visible, hands casually placed in pockets, wearing the garment from the uploaded image. Clean background, soft studio lighting, complete outfit visible, ultra realistic fabric texture.

4. ONE LEG FORWARD
Full body fashion photograph of the same male fashion model, standing with one leg slightly forward and relaxed posture, hands casually positioned, wearing the garment from the uploaded image. Neutral studio background, soft professional lighting, complete garment from head to feet visible, high-end catalogue photography.

5. LIFESTYLE POSE
Full body lifestyle fashion photograph of the same male fashion model standing with relaxed confidence, shoulders slightly angled, wearing the garment from the uploaded image. Cinematic lighting, natural posture, luxury fashion brand photoshoot style, complete outfit visible, sharp focus, realistic textures.

6. BACK VIEW (FULL BODY)
Full body fashion catalogue photograph showing the back view of the same male fashion model, standing straight with natural posture, arms relaxed, wearing the garment from the uploaded image. Neutral studio background, soft even lighting, complete outfit from head to feet shown from behind, detailed e-commerce photography.
```

### AUTO / MIXED (6 prompts — safe general set)

```
1. STANDARD CATALOGUE
Professional fashion catalogue photo of the same male fashion model, standing confidently, hands casually in pockets, torso clearly visible, wearing the garment from the uploaded image. Clean light grey studio background, soft professional lighting, sharp focus, ultra realistic fabric texture, premium e-commerce fashion photography.

2. SLIGHT TURN
Studio fashion photoshoot of the same male fashion model, standing in a relaxed pose with body slightly turned sideways, head facing directly toward the camera, hands relaxed, wearing the garment from the uploaded image. Neutral studio background, soft diffused lighting, high-end clothing catalogue photography.

3. FULL BODY STANDARD
Full body professional fashion catalogue photograph of the same male fashion model, standing upright with relaxed posture, hands casually in pockets, wearing the garment from the uploaded image. Clean studio background, soft even lighting, complete garment visible, premium e-commerce photography.

4. THREE-QUARTER POSE
Professional fashion photoshoot of the same male fashion model in a confident three-quarter pose, body slightly turned away from the camera while the face is visible, hands casually placed in pockets, wearing the garment from the uploaded image. Clean background, soft studio lighting, ultra realistic skin and fabric texture, high-end clothing brand catalogue photography.

5. EDITORIAL
High-end fashion editorial portrait of the same male fashion model, standing with relaxed confidence, shoulders slightly angled, gaze directed off-camera, hands casually positioned, wearing the garment from the uploaded image. Cinematic lighting, natural posture, luxury fashion brand photoshoot style, sharp focus, realistic textures.

6. BACK VIEW
Studio fashion photograph showing the back view of the same male fashion model, standing straight with relaxed posture, wearing the garment from the uploaded image. Neutral studio background, soft diffused lighting, garment clearly visible from behind, high-detail fashion catalogue photography.
```

---

### Sprint 5: Telegram Bot Interface (2-3 days)

**Goal**: Same backend, simpler distribution. No app install, no website — just send a photo to a bot.

Telegram is the perfect channel for small Indian retailers: familiar, zero friction, works on any phone. The bot reuses every existing backend service — it's just a new "frontend".

#### 5.1 — Bot conversation flow

```
User sends garment photo to bot
       ↓
Bot: "What type of garment?" → inline keyboard [Tops] [Bottoms] [One-Pieces] [Auto Detect]
       ↓
Bot: "How many photos?" → inline keyboard [4] [6]
       ↓
Bot: "Choose background:" → inline keyboard [Studio White] [Light Grey] [Custom] [Keep AI Background]
       ↓
(If Custom → user sends background image)
       ↓
Bot: "Generating your catalog... ⏳" (processing message)
       ↓
Bot sends each image as it completes (progressive delivery)
       ↓
Bot: "✅ Catalog complete! 4/4 photos ready." + [Download All] button
```

#### 5.2 — Background selection in bot

The bot exposes the same background system already built:

```
[Studio White]     → solid_color: #FFFFFF
[Light Grey]       → solid_color: #F0F0F0
[Warm Beige]       → solid_color: #F5F0E8
[Outdoor Scene]    → preset_scene: "outdoor lifestyle"
[Custom Upload]    → user sends image → custom_upload
[Keep AI BG]       → skip post-processing, use Gemini's generated background as-is
```

For presets, show a thumbnail grid (Telegram supports inline photo results).

#### 5.3 — Technical architecture

```
Telegram Bot API (webhook or polling)
       ↓
backend/src/modules/telegram/
  ├── bot.ts              ← Bot initialization, webhook handler
  ├── handlers/
  │   ├── start.ts        ← /start command, welcome message
  │   ├── photo.ts        ← Receive garment photo, start flow
  │   ├── callback.ts     ← Inline keyboard responses (category, count, bg)
  │   └── background.ts   ← Custom background upload handler
  ├── services/
  │   └── session.ts      ← Track user state (which step they're on)
  └── keyboards.ts        ← Reusable inline keyboard builders
```

**Dependencies**: `grammy` (modern Telegram bot framework for Node.js, TypeScript-first) or `telegraf`

**Session state**: Simple in-memory map keyed by Telegram chat ID:
```typescript
interface BotSession {
  step: 'idle' | 'awaiting_category' | 'awaiting_count' | 'awaiting_background' | 'awaiting_custom_bg' | 'processing';
  garmentBuffer?: Buffer;
  garmentFilename?: string;
  category?: GarmentCategory;
  imageCount?: number;
  backgroundType?: 'keep_ai' | 'solid_color' | 'preset_scene' | 'custom_upload';
  backgroundValue?: string;
  customBgBuffer?: Buffer;
}
```

**Key design decisions**:
- Bot calls the SAME service functions (`createCatalog`, `applyBackground`) — no code duplication
- Auth: Telegram user ID maps to a `users` row (auto-create on first /start, no OTP needed)
- Credits: Same credit system, or separate free tier for Telegram users
- Progressive delivery: As each job completes, bot sends the photo immediately (don't wait for all 4-6)

#### 5.4 — Background compositing on catalog results

Currently the catalog pipeline generates try-on images and serves them as-is (Gemini's background). To support background selection:

**Post-generation background swap pipeline:**
```
Gemini try-on output (model wearing garment, AI-generated background)
       ↓
Background removal on OUTPUT (BiRefNet — already have this, ~$0.001/image)
       ↓
Transparent model-in-garment PNG
       ↓
Composite onto chosen background (sharp — already have image-compositor.ts)
       ↓
Final catalog image with user's chosen background
```

This works for both web and Telegram:
- Web: User generates catalog → picks background from existing preset/upload system → apply to all images
- Telegram: User picks background BEFORE generation → applied automatically after each try-on

**Cost**: +$0.001 per image (BiRefNet bg removal on output) + ~50ms (sharp composite). Negligible.

**Backend change**: Add optional `background` param to `createCatalog`:
```typescript
interface CreateCatalogInput {
  // ... existing fields
  background?: {
    type: 'keep_ai' | 'solid_color' | 'preset_scene' | 'custom_upload';
    value?: string;          // hex color, preset ID, or custom bg URL
    customBgBuffer?: Buffer; // if custom upload
  };
}
```

If `background.type !== 'keep_ai'`, the pipeline does:
1. Generate try-on image (Gemini)
2. Remove background from output (BiRefNet)
3. Composite onto chosen background (sharp)
4. Save final image

#### 5.5 — Env config

```
# Telegram Bot
TELEGRAM_BOT_TOKEN=<from @BotFather>
TELEGRAM_WEBHOOK_URL=<public URL>/api/telegram/webhook  # production
# For dev: use polling mode (no webhook needed)
```

---

### Sprint 6: Background Selection on Web (1-2 days)

**Goal**: Same background system from Telegram, available on the web catalog page

#### 6.1 — UI flow on catalog results page

After catalog images are generated, add a "Change Background" bar above the results grid:

```
┌─────────────────────────────────────────────────┐
│ Background: [Studio White ●] [Grey] [Beige]     │
│             [Custom Upload ↑] [Keep Original]    │
│             [Apply to All]                       │
└─────────────────────────────────────────────────┘

┌─────────────┐  ┌─────────────┐
│ Front View  │  │ Side Turn   │
│  (image)    │  │  (image)    │
└─────────────┘  └─────────────┘
```

When user clicks "Apply to All":
- `POST /api/tryon/batch/:batchId/background` with `{ type, value }`
- Backend runs bg removal + composite on each completed image
- Returns updated image URLs
- Frontend refreshes the grid

#### 6.2 — New API endpoint

```
POST /api/tryon/batch/:batchId/background
Body: { type: 'solid_color' | 'preset_scene' | 'custom_upload', value: string }
Response: { jobs: Job[] }  // updated jobs with new output_image_url
```

This reuses:
- `removeBackground()` from `ai-client.ts` (already built)
- `compositeOnColor()` / `compositeOnImage()` from `image-compositor.ts` (already built)
- Background preset system from `background-service.ts` (already built)

Zero new AI logic needed — just wiring existing services together.

---

## API Changes Summary

### Modified Endpoints

| Endpoint | Change |
|----------|--------|
| `POST /api/tryon/catalog` | Add `imageCount` param (4/6/8), auto-detect category, return `pose_label` per job |
| `GET /api/tryon/batch/:batchId` | Return `pose_label` per job |

### New Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/tryon/retry` | Retry a single failed job in a batch |
| `POST /api/tryon/batch/:batchId/background` | Apply background to all images in a batch |
| `GET /api/tryon/batch/:batchId/download` | (Optional) ZIP download of all completed images |
| `POST /api/telegram/webhook` | Telegram bot webhook (production) |

### DB Changes

| Table | Change |
|-------|--------|
| `jobs` | Add `pose_label TEXT` (nullable) — stores "Front View", "Back View", etc. |
| `jobs` | Add `pose_index INT` (nullable) — stores which template was used (for retry) |
| `users` | Add `telegram_id BIGINT` (nullable, unique) — link Telegram user to app user |

---

## Priority Order (What to Build First)

### Must-Have (Sprint 1-2, this week)

1. **Auto-detect garment category** — removes friction, user just uploads
2. **6 pose templates per category** — more variety than current 4
3. **Decouple poses from presets** — use one model reference, generate N poses
4. **Pose labels on results** — user knows what each image is
5. **Progressive loading** — show images as they complete, not all-at-once

### Should-Have (Sprint 3, next week)

6. **Post-processing** — normalize aspect ratio, brightness, sharpness (sharp, ~50ms)
7. **Download All as ZIP** — essential for actual e-commerce use
8. **Retry failed images** — don't waste 5 good images because of 1 failure
9. **Garment validation** — reject non-clothing images before processing

### High Impact (Sprint 4, when quality matters)

10. **Pose reference images** — THE biggest quality jump (visual constraint > text constraint)
11. **FASHN direct API** — higher garment fidelity than Gemini prompt-based approach
12. **BullMQ async processing** — prevent HTTP timeouts on slow generations

### Distribution (Sprint 5-6, parallel to above)

13. **Telegram bot** — same backend, zero-friction interface. User sends photo → gets catalog. No app install, no website needed. Ideal for small Indian retailers.
14. **Background selection on catalog** — user picks background (solid color, preset scene, custom upload) → applied to all catalog images via bg removal + sharp composite. Works on both web and Telegram.
15. **Background selection on web** — "Change Background" bar on catalog results page, reuses existing background system (presets, custom upload, image-compositor)

---

## Cost Analysis

| Configuration | Cost per image | Cost per 6-image catalog | Monthly (100 catalogs) |
|---------------|---------------|-------------------------|----------------------|
| Gemini free tier | $0.00 | $0.00 | $0 (500 images/day limit) |
| Gemini paid tier | ~$0.02 | ~$0.12 | ~$12 |
| FASHN via fal.ai | $0.075 | $0.45 | $45 |
| FASHN direct API | $0.075 | $0.45 | $45 |
| FASHN annual | ~$0.04 | $0.24 | $24 |

| Gemini + bg swap | ~$0.001 | ~$0.006 | ~$0.60 (bg removal on outputs) |

**Current setup (Gemini free tier) supports ~83 six-image catalogs per day at zero cost.** Background swap adds ~$0.001/image (BiRefNet) — negligible. This is more than enough for MVP and early traction.

---

## Key Insight from the Conversation

> "Serious fashion AI systems do NOT rely on prompt only. They use: Garment image + Pose reference image + Human model base image → Try-on diffusion model."

We're currently at **prompt + garment image + model reference** (2 of 3 visual constraints). Adding **pose reference images** (Sprint 4.1) completes the triangle and is the highest-leverage quality improvement available without changing the AI provider.

---

---

## Telegram Bot — Why This Matters

The web app is great for power users. But the target market (small Indian retailers, Instagram sellers, Shopify stores) lives on their phone. A Telegram bot gives them:

- **Zero friction**: No signup, no app install, no website to navigate
- **Familiar UX**: Send photo → get photos back. Everyone knows how messaging works.
- **Shareable**: Forward catalog images directly to customers or WhatsApp groups
- **Progressive delivery**: Images arrive one by one as they're ready (no blank loading screen)
- **Background selection**: Quick inline keyboard, not a complex UI

The backend doesn't change. The bot is just another consumer of `createCatalog()`, `removeBackground()`, and `compositeOnImage()`. Same services, different delivery channel.

**Future**: WhatsApp Business API (Phase 4) uses the same architecture — just swap `grammy` for the WhatsApp Cloud API client.

---

*This plan is actionable. Sprint 1-2 are pure code changes with no new dependencies. Sprint 3 uses `sharp` (already installed). Sprint 4 is the quality leap. Sprint 5-6 (Telegram + backgrounds) can run in parallel with any sprint — they're independent of the quality work.*
