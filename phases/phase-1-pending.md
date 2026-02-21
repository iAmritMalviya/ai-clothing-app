# Phase 1 — MVP: Background Removal + Background Selection

**Status**: In Progress
**Timeline**: Weeks 1-3
**Goal**: Ship a working background removal tool with background selection, get 50 early users

---

## Features

### Backend — DONE
- [x] Phone OTP login (Indian mobile numbers, dev mode with random codes)
- [x] JWT auth with 7-day expiry
- [x] User profile (name, shop_name) + credit tracking
- [x] Image upload + AI background removal (fal.ai BiRefNet v2)
- [x] Transparent PNG saved for re-compositing
- [x] Background selection: solid colors, AI scene presets, custom upload
- [x] 18 seeded background presets (10 solid colors + 8 AI scenes)
- [x] AI scene generation via fal.ai flux/schnell (cached after first use)
- [x] Image compositing via sharp (transparent PNG onto chosen background)
- [x] Free tier: 5 credits per user (1 credit per bg removal, 1 per bg apply)
- [x] Job history with status tracking
- [x] 13 API endpoints total

### Frontend — In Progress (separate Claude session)
- [x] Next.js 15 + React 19 + Tailwind CSS 4 + shadcn/ui setup
- [x] Login page (phone input → OTP verification)
- [x] Dashboard layout with auth guard
- [x] OTP input component (6-digit, auto-focus)
- [x] Auth provider (JWT storage, login/logout)
- [x] API client with auth headers
- [x] Types synced with backend
- [ ] Upload zone (drag-drop + camera capture)
- [ ] Job result page (before/after comparison)
- [ ] Background selection UI (preset grid, custom upload, solid color picker)
- [ ] Download button
- [ ] WhatsApp-optimized share button
- [ ] Job history list on dashboard
- [ ] Credits badge
- [ ] Landing page with before/after examples
- [ ] PWA configuration (manifest, service worker, Add to Home Screen)

## Tech Stack (Actual)

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 15 + React 19 + Tailwind CSS 4 + shadcn/ui | PWA, mobile-first, App Router |
| Backend | Node.js + Fastify v5 + Knex + TypeScript | REST API, JWT auth |
| AI Service | fal.ai (BiRefNet v2 + flux/schnell) | Cloud API, no local processing |
| Image Processing | sharp | Server-side compositing |
| Database | PostgreSQL | Users, jobs, background_presets, user_backgrounds |
| Storage | Local filesystem (uploads/) | Input, transparent, output, user-backgrounds, bg-previews |
| Auth | Dev mode OTP (random 6-digit, 5-min expiry) | Future: MSG91/Twilio for production |
| Package Manager | pnpm | Both frontend and backend |

## Architecture

```
User (Mobile/Desktop Browser)
        │
        ▼
┌─────────────────────┐
│   Next.js Frontend   │  Port 3000
│  Upload → Preview    │
│  Background Select   │
│  Download → Share    │
└────────┬────────────┘
         │ REST API calls
         ▼
┌─────────────────────┐
│  Fastify Backend     │  Port 3001
│  Auth │ Credits      │
│  Job Creation        │
│  Background Module   │
└────────┬────────────┘
         │
    ┌────┴─────────┐
    ▼              ▼
┌────────┐  ┌──────────────┐
│ fal.ai │  │    sharp      │
│ BiRef  │  │  compositing  │
│ Net v2 │  │  (~50-100ms)  │
│ (bg    │  └──────────────┘
│ remove)│
│        │
│ flux/  │
│schnell │
│ (scene │
│  gen)  │
└────────┘
```

## Backend Endpoints (13 total)

```
# Auth (no auth required)
POST   /api/auth/send-otp       → Send OTP to phone number
POST   /api/auth/verify-otp     → Verify OTP, return JWT + user

# User (auth required)
GET    /api/user/me              → Get user profile + remaining credits
PATCH  /api/user/me              → Update name / shop_name

# Jobs (auth required)
POST   /api/jobs/remove-bg      → Upload image, remove background (1 credit)
GET    /api/jobs/:id             → Get job status + result URL
GET    /api/jobs                 → List user's past jobs (paginated)

# Backgrounds (auth required)
GET    /api/backgrounds/presets  → List 18 background presets
POST   /api/backgrounds/upload   → Upload custom background (free)
GET    /api/backgrounds/mine     → List user's custom backgrounds
DELETE /api/backgrounds/mine/:id → Delete a custom background
POST   /api/backgrounds/apply    → Apply background to transparent image (1 credit)
```

## Database Schema

```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15) UNIQUE NOT NULL,
    name VARCHAR(100),
    shop_name VARCHAR(200),
    free_credits_remaining INT DEFAULT 5,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Processing Jobs
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(50) DEFAULT 'bg_removal',
    status VARCHAR(20) DEFAULT 'pending',
    input_image_url TEXT NOT NULL,
    transparent_image_url TEXT,
    output_image_url TEXT,
    source_job_id UUID REFERENCES jobs(id),
    background_type VARCHAR(20),
    background_value TEXT,
    processing_time_ms INT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Background Presets (18 seeded)
CREATE TABLE background_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,       -- 'solid_color' or 'ai_scene'
    value TEXT NOT NULL,              -- hex color or scene prompt
    preview_image_url TEXT,           -- cached preview (generated on first use)
    category VARCHAR(50) DEFAULT 'general',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User Custom Backgrounds
CREATE TABLE user_backgrounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    image_url TEXT NOT NULL,
    original_filename VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Background Selection Flow

```
1. POST /api/jobs/remove-bg
   → Upload garment photo
   → fal.ai BiRefNet v2 removes background
   → Saves: transparent PNG + white composite (default output)
   → Costs: 1 credit

2. POST /api/backgrounds/apply
   → User picks background type:
     a. solid_color: hex code → sharp compositing (~50ms)
     b. preset_scene: fal.ai flux/schnell generation → sharp compositing
        (cached in preset's preview_image_url after first generation)
     c. custom_upload: user's uploaded image → sharp compositing (~100ms)
   → Costs: 1 credit
```

## Cost Estimate (Phase 1)

| Item | Cost |
|---|---|
| fal.ai BiRefNet v2 (bg removal) | ~$0.00 (effectively free) |
| fal.ai flux/schnell (scene gen) | ~$0.003/image (cached after first use) |
| VPS (4GB RAM, 2 vCPU) | ~$15/mo |
| PostgreSQL (self-hosted) | $0 |
| OTP SMS (production) | ~Rs 0.15/SMS |
| Domain (.in) | ~Rs 500/year |
| **Total** | **~$15-20/mo for MVP** |

## What Changed From Original Plan

| Original Plan | Actual Implementation | Why |
|---|---|---|
| Python FastAPI + rembg | fal.ai BiRefNet v2 (cloud API) | Much better quality on clothing edges |
| Cloudflare R2 storage | Local filesystem (uploads/) | Simpler for MVP, R2 can be added later |
| White background only | 18 presets + custom upload + solid colors | Better product, users need variety |
| MSG91/Twilio OTP | Dev mode random OTP (logged to console) | Not needed until production |
| 6 API endpoints | 13 API endpoints | Background module added 5 endpoints |

## Remaining Work

### Frontend (other Claude session)
- Upload zone with image preview
- Background selection UI (preset grid, color picker, custom upload)
- Job result page with before/after
- Download + WhatsApp share
- Job history
- Credits display
- Landing page
- PWA setup

### Pre-Launch
- [ ] Production OTP provider (MSG91 or Twilio)
- [ ] Rate limiting
- [ ] Error handling polish
- [ ] Deploy to VPS (Docker Compose)
- [ ] Real domain + SSL

## Success Criteria

- 50 registered users within 2 weeks of launch
- Background removal quality rated 4+/5 by test users
- Average processing time < 5 seconds per image
- Zero-downtime during business hours (9am-9pm IST)
