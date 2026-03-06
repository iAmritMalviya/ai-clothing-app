# Phase 2 — Core Product: AI Model Try-On

**Status**: In Progress (core try-on done, payments remaining)
**Timeline**: Weeks 4-7
**Goal**: Let retailers see their garments on AI models with professional lighting
**Depends on**: Phase 1 completed

---

## Features

### Backend — DONE
- [x] FASHN v1.6 virtual try-on via fal.ai ($0.075/generation)
- [x] Model preset system (4 presets: 2 female + 2 male from FASHN examples)
- [x] Custom model upload (user uploads their own model photos)
- [x] User model management (list, upload, delete)
- [x] Garment category support (tops, bottoms, one-pieces, auto-detect)
- [x] Try-on is FREE to users (no credit deduction)
- [x] Job tracking with `type: 'tryon'`, links to source bg_removal job
- [x] 5 API endpoints for try-on module

### Frontend — DONE
- [x] TryOnPicker component (model presets grid + custom upload tab)
- [x] Model selection with visual highlight
- [x] Garment category selector (Auto/Tops/Bottoms/One-Pieces)
- [x] Generate button with loading state
- [x] "Free" badge indicator
- [x] Custom model upload + delete
- [x] Try-on result display (before/after: garment vs try-on)
- [x] Job card + job detail page support for `tryon` type
- [x] API client (`tryon-api.ts`) with all 5 endpoints

### Not Yet Started
- [ ] Expand model library (10-15 diverse Indian models)
- [ ] Razorpay payment integration (UPI, cards, net banking)
- [ ] Subscription plans (Basic: Rs 499/month)
- [ ] Credit quota system (per-plan limits for bg removal + try-on)
- [ ] BullMQ job queue for async processing
- [ ] Production OTP (MSG91)

## Tech Stack (Actual)

| Layer | Technology | Notes |
|---|---|---|
| Try-On API | FASHN v1.6 via fal.ai | $0.075/image, 864x1296 resolution |
| Compositing | Sharp (Node.js) | Already used for bg compositing |
| Image Storage | Local filesystem | `uploads/model-presets/`, `uploads/user-models/` |
| Frontend | TryOnPicker component | Tabs: presets + custom, category selector |

## Architecture

```
User (Mobile/Desktop Browser)
        │
        ▼
┌─────────────────────┐
│   Next.js Frontend   │  Port 3002
│  + TryOnPicker       │
│  + Model grid        │
│  + Category selector │
└────────┬────────────┘
         │ POST /api/tryon/generate
         ▼
┌─────────────────────┐
│  Fastify Backend     │  Port 3001
│  + tryon module      │
│  + model management  │
└────────┬────────────┘
         │
    ┌────┴─────────────┐
    ▼                  ▼
┌────────┐      ┌──────────────┐
│ fal.ai │      │  fal.ai      │
│ storage│─────>│  FASHN v1.6  │
│ upload │      │  try-on      │
└────────┘      │  $0.075/gen  │
                └──────────────┘
```

## Try-On Processing Pipeline (Implemented)

```
1. User has a completed bg_removal job (garment photo)
2. User selects a model (preset or custom upload)
3. User picks garment category (auto/tops/bottoms/one-pieces)
4. POST /api/tryon/generate:
   a. Read garment image from local storage
   b. Read model image (preset file or user upload)
   c. Upload both to fal.ai storage
   d. Call FASHN v1.6 with model + garment + category
   e. Download result, save to uploads/outputs/
   f. Create job record with type: 'tryon'
5. Result displayed on job detail page (before/after)
6. Processing time: ~5-15 seconds
7. Cost: FREE to users ($0.075 to us per generation)
```

## API Endpoints (Try-On — 5 total)

```
GET    /api/tryon/models          → List model presets (4 seeded)
POST   /api/tryon/models/upload   → Upload custom model photo (free)
GET    /api/tryon/models/mine     → List user's uploaded models
DELETE /api/tryon/models/mine/:id → Delete a custom model
POST   /api/tryon/generate        → Generate try-on (free, ~5-15s)
```

## Database Schema (Implemented)

```sql
-- Model presets (4 seeded: 2 female + 2 male)
CREATE TABLE model_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    gender VARCHAR(20) NOT NULL,    -- 'female' | 'male'
    image_url TEXT NOT NULL,        -- /uploads/model-presets/*.png
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User-uploaded custom model photos
CREATE TABLE user_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    original_filename VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Jobs table addition
ALTER TABLE jobs ADD COLUMN model_image_url TEXT;
```

## Model Presets (Current)

| Name | Gender | Source | File |
|---|---|---|---|
| Female Model 1 | female | FASHN fal.ai examples | female-1.png (918KB) |
| Female Model 2 | female | FASHN fal.ai examples | female-2.png (882KB) |
| Male Model 1 | male | FASHN fal.ai examples | male-1.png (1.3MB) |
| Male Model 2 | male | FASHN fal.ai examples | male-2.png (1.9MB) |

## Cost Per Try-On (Actual)

| Step | Cost |
|---|---|
| FASHN v1.6 via fal.ai | ~Rs 6.5 ($0.075) |
| Storage (local) | Rs 0 |
| **Total per try-on** | **~Rs 6.5** |

Currently FREE to users — monetization via Razorpay subscriptions in next phase.

## What Changed From Original Plan

| Original Plan | Actual Implementation | Why |
|---|---|---|
| 10-15 Indian model photoshoot | 4 FASHN sample models | Ship fast, expand later |
| BullMQ + Redis queue | Synchronous processing | Simpler for MVP, queue not needed yet |
| Razorpay subscriptions | Not yet (try-on is free) | Validate product first, monetize later |
| rembg for bg removal | fal.ai BiRefNet v2 | Better quality (decided in Phase 1) |
| Model filtering (skin tone, body type) | Simple gender-based grid | Ship fast, add filters later |

## Remaining Work (Phase 2 Completion)

### Model Library Expansion
- [ ] Source 6-10 more diverse model photos (Indian models, varied body types)
- [ ] Add skin_tone and body_type columns to model_presets
- [ ] Add filtering UI in TryOnPicker (gender, skin tone)

### Payments (Razorpay)
- [ ] Razorpay account setup + API keys
- [ ] `subscriptions` table migration
- [ ] Plan selection page (Free / Basic Rs 499)
- [ ] Razorpay checkout integration (frontend)
- [ ] Webhook handler for payment events
- [ ] Credit quota system (replace flat 5 free credits)
- [ ] Auto-downgrade on payment failure

### Production Readiness
- [ ] Production OTP (MSG91 — ~INR 0.25/SMS, DLT registration needed)
- [ ] BullMQ job queue (for try-on jobs that take 5-15s)
- [ ] Rate limiting
- [ ] Error handling polish

## Success Criteria

- Try-on quality rated 4+/5 by test users
- Average try-on processing time < 20 seconds
- At least 3 retailers share try-on images on WhatsApp
- 20 paying Basic subscribers within 4 weeks of payments launch
