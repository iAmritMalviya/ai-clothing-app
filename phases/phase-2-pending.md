# Phase 2 — Core Product: AI Model Try-On

**Status**: Pending
**Timeline**: Weeks 4-7
**Goal**: Let retailers see their garments on Indian AI models with shop backgrounds
**Depends on**: Phase 1 completed + 50 users validated

---

## Features

- [ ] Virtual try-on: garment placed on AI model
- [ ] Indian model library (10-15 models, diverse skin tones & body types)
- [ ] Model selection UI (gender, skin tone, body type)
- [ ] Shop background upload → composite behind model
- [ ] Background presets (plain white, studio, street, shop interior)
- [ ] Credit system (Basic plan: 50 try-ons/month)
- [ ] Razorpay payment integration (UPI, cards, net banking)
- [ ] Basic plan: Rs 499/month

## New Tech Additions

| Layer | Technology | Notes |
|---|---|---|
| Try-On API | FASHN API | $0.075/image, API-first, best quality |
| Compositing | Sharp (Node.js) or Pillow (Python) | Layer model onto shop background |
| Payments | Razorpay | INR, UPI, all Indian methods |
| Queue | BullMQ + Redis | Try-on jobs take 5-17 seconds |

## Architecture (Added Components)

```
┌─────────────────────┐
│   Next.js Frontend   │
│  + Model selector    │
│  + Background upload │
│  + Payment flow      │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Fastify Backend     │
│  + Credit system     │
│  + Razorpay webhooks │
│  + Job queue (BullMQ)│
└────────┬────────────┘
         │
    ┌────┴─────────┐
    ▼              ▼
┌────────┐  ┌──────────────┐
│ rembg  │  │  FASHN API   │
│ (bg    │  │  (try-on)    │
│ remove)│  │  $0.075/img  │
└────────┘  └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │  Compositing  │
            │  Service      │
            │  (model +     │
            │   shop bg)    │
            └──────────────┘
```

## Processing Pipeline

```
1. User uploads garment photo
2. Background removal (rembg) → transparent garment
3. User selects Indian model + background option
4. FASHN API call: garment + model base image → model wearing garment
5. If shop background selected:
   a. Remove FASHN output background
   b. Composite model onto shop background image
6. Return final image to user
```

## Database Schema (Phase 2 Additions)

```sql
-- Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    plan VARCHAR(20) NOT NULL, -- 'free', 'basic', 'pro'
    razorpay_subscription_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active', -- active, cancelled, expired
    credits_bg_removal INT DEFAULT 0,
    credits_tryon INT DEFAULT 0,
    credits_video INT DEFAULT 0,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Model Library
CREATE TABLE ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100),
    gender VARCHAR(20), -- male, female
    skin_tone VARCHAR(20), -- light, medium, dark
    body_type VARCHAR(20), -- slim, regular, plus
    image_url TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Shop Backgrounds
CREATE TABLE shop_backgrounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    image_url TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    label VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Update jobs table
ALTER TABLE jobs ADD COLUMN model_id UUID REFERENCES ai_models(id);
ALTER TABLE jobs ADD COLUMN background_id UUID REFERENCES shop_backgrounds(id);
ALTER TABLE jobs ADD COLUMN background_type VARCHAR(20); -- 'white', 'preset', 'shop'
```

## API Endpoints (Phase 2 Additions)

```
-- Models
GET    /api/models                  → List available AI models (with filters)
GET    /api/models/:id              → Get model details

-- Backgrounds
POST   /api/backgrounds/upload      → Upload shop background
GET    /api/backgrounds             → List user's shop backgrounds
DELETE /api/backgrounds/:id         → Delete a background

-- Try-On Jobs
POST   /api/jobs/try-on             → Start try-on job (garment + model + bg)
GET    /api/jobs/:id                → Poll job status

-- Subscriptions
GET    /api/plans                   → List available plans + pricing
POST   /api/subscriptions/create    → Create Razorpay subscription
POST   /api/webhooks/razorpay       → Handle payment webhooks
GET    /api/subscriptions/current   → Get current plan + remaining credits
```

## Indian Model Library Strategy

### Photoshoot Plan
- Hire 10-15 Indian models (mix of genders, skin tones, body types)
- Single-day photoshoot: ~Rs 30,000-50,000 total
- 20+ poses per model in neutral clothing (tank top/fitted tee + fitted pants)
- Plain gray background (easy to remove/replace)
- High-resolution (4K) for best FASHN API results

### Model Categories
| Category | Count | Description |
|---|---|---|
| Male - Light skin | 2 | North Indian look |
| Male - Medium skin | 2 | Pan-Indian look |
| Male - Dark skin | 1 | South Indian look |
| Female - Light skin | 2 | North Indian look |
| Female - Medium skin | 2 | Pan-Indian look |
| Female - Dark skin | 1 | South Indian look |
| Male - Plus size | 1 | Inclusive sizing |
| Female - Plus size | 1 | Inclusive sizing |

### Alternative (Faster, Cheaper)
- Use AI-generated Indian model base images (Midjourney/SDXL)
- Less authentic but faster to launch
- Can be replaced with real models later

## Razorpay Integration

```
Plans:
- Basic: Rs 499/month
  - 100 bg removals
  - 50 try-ons
  - 5 shop backgrounds

Razorpay Setup:
- Subscription mode (recurring monthly)
- Webhook for payment success/failure
- Auto-downgrade to free on payment failure
- UPI Autopay support
```

## Cost Per Try-On

| Step | Cost |
|---|---|
| Background removal (rembg) | ~Rs 0.5 |
| FASHN API call | ~Rs 6.5 ($0.075) |
| Background compositing | ~Rs 0.5 |
| Storage (R2) | ~Rs 0.1 |
| **Total per try-on** | **~Rs 7.6** |

At Rs 499/month for 50 try-ons:
- Revenue per try-on: Rs 9.98
- Margin per try-on: ~Rs 2.38 (24%)
- Monthly cost per Basic user: ~Rs 380
- Monthly margin per Basic user: ~Rs 119

## Success Criteria

- 20 paying Basic subscribers within 4 weeks
- Try-on quality rated 4+/5 by retailers
- Average try-on processing time < 20 seconds
- Payment success rate > 95% (Razorpay)
- At least 3 retailers share try-on images on their WhatsApp status

## Key Risks

| Risk | Mitigation |
|---|---|
| FASHN API quality on Indian garments (kurtas, sarees) | Test extensively before launch. Have 2nd API (LightX) as backup |
| Retailers won't pay Rs 499/month | Offer first month at Rs 99. Show ROI: "replaces Rs 5,000 photoshoot" |
| Model images don't look realistic | Start with real photoshoot models, not AI-generated |
| FASHN API downtime | Queue + retry mechanism. Show "processing" state to user |

## Week-by-Week Breakdown

**Week 4**: Payment + Credit System
- [ ] Razorpay subscription integration
- [ ] Credit tracking (bg removal + try-on quotas)
- [ ] Plan selection UI
- [ ] Webhook handling for payment events

**Week 5**: FASHN API Integration
- [ ] Integrate FASHN virtual try-on API
- [ ] Build processing pipeline (upload → remove bg → try-on → result)
- [ ] Job queue with BullMQ for async processing
- [ ] Test with 50+ garment types

**Week 6**: Model Library + Shop Backgrounds
- [ ] Model selection UI (grid with filters)
- [ ] Shop background upload + storage
- [ ] Background compositing service (Sharp/Pillow)
- [ ] Background preset library (5-10 common backgrounds)

**Week 7**: Polish + Launch
- [ ] End-to-end testing of full pipeline
- [ ] Loading states, progress indicators
- [ ] Error handling for failed API calls
- [ ] Email/SMS notification when job is done
- [ ] Launch to existing Phase 1 users + new marketing push
