# Phase 3 — Pro Features: Video Generation

**Status**: Pending
**Timeline**: Weeks 8-10
**Goal**: Generate 5-7 second product videos for Pro plan subscribers
**Depends on**: Phase 2 completed + 20 paying users

---

## Features

- [ ] 5-7 second product video from garment photo
- [ ] Video styles: model showcase, product spin, lifestyle scene
- [ ] Pro plan: Rs 1,499/month (30 videos + 200 try-ons + 500 bg removals)
- [ ] Bulk upload support (up to 50 images at once)
- [ ] Video download in MP4 (optimized for WhatsApp, Instagram Reels)
- [ ] Video gallery with thumbnail previews

## Video Generation Styles

### Style 1: Model Showcase
```
Scene: AI model wearing garment, slight movement
Duration: 5 seconds
Flow: Static pose → subtle turn → zoom to fabric detail
```

### Style 2: Product Display
```
Scene: Garment on white background with smooth rotation
Duration: 5 seconds
Flow: Front view → side turn → back view → front
```

### Style 3: Lifestyle Scene
```
Scene: Model in shop/street environment wearing garment
Duration: 7 seconds
Flow: Wide shot → walk forward → pause → close-up
```

## New Tech Additions

| Layer | Technology | Notes |
|---|---|---|
| Video Generation | Kling AI API | ~$0.60/10s clip, good quality |
| Video Processing | FFmpeg | Trim, compress, format conversion |
| Queue (Priority) | BullMQ priority queues | Video jobs = lower priority than images |

## Architecture (Added Components)

```
┌─────────────────────┐
│   Next.js Frontend   │
│  + Video style picker│
│  + Bulk upload       │
│  + Video gallery     │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Fastify Backend     │
│  + Pro plan billing  │
│  + Bulk job manager  │
│  + Priority queues   │
└────────┬────────────┘
         │
    ┌────┼──────────┐
    ▼    ▼          ▼
┌──────┐┌──────┐┌────────────┐
│rembg ││FASHN ││ Kling AI   │
│      ││ API  ││ Video API  │
│      ││      ││ ~$0.60/vid │
└──────┘└──────┘└─────┬──────┘
                      │
                      ▼
               ┌──────────────┐
               │   FFmpeg      │
               │   Post-proc   │
               │   Compress    │
               └──────────────┘
```

## Video Processing Pipeline

```
1. User selects garment photo(s) + video style
2. System generates try-on image first (reuse Phase 2 pipeline)
3. Try-on image → Kling AI API with style-specific prompt
4. Kling returns raw video (10-15s)
5. FFmpeg post-processing:
   a. Trim to 5-7 seconds
   b. Add subtle fade-in/fade-out
   c. Compress for mobile (H.264, 720p)
   d. Generate thumbnail
6. Store video + thumbnail in R2
7. Notify user (SMS/push)
```

## Kling AI Integration

### API Call Structure
```
Endpoint: Kling Image-to-Video API
Input: Try-on image + motion prompt
Duration: 5-10 seconds
Resolution: 720p or 1080p
Mode: Standard (cost-effective) or Pro (higher quality)
```

### Prompt Templates by Style

**Model Showcase:**
```
"Fashion model wearing [garment_type], subtle body movement,
slight turn to show garment details, professional studio lighting,
Indian model, fashion photography style"
```

**Product Display:**
```
"[garment_type] on white background, smooth 360 degree rotation,
product showcase, clean lighting, e-commerce style"
```

**Lifestyle Scene:**
```
"Indian model wearing [garment_type], walking in [background_type],
natural lighting, lifestyle fashion video, confident walk"
```

## Database Schema (Phase 3 Additions)

```sql
-- Video Jobs (extends jobs table)
ALTER TABLE jobs ADD COLUMN video_style VARCHAR(30); -- 'model_showcase', 'product_display', 'lifestyle'
ALTER TABLE jobs ADD COLUMN video_url TEXT;
ALTER TABLE jobs ADD COLUMN video_thumbnail_url TEXT;
ALTER TABLE jobs ADD COLUMN video_duration_seconds DECIMAL(4,1);

-- Bulk Upload Batches
CREATE TABLE bulk_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    total_items INT NOT NULL,
    completed_items INT DEFAULT 0,
    failed_items INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'processing', -- processing, completed, partial_failure
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Link jobs to batches
ALTER TABLE jobs ADD COLUMN batch_id UUID REFERENCES bulk_batches(id);
```

## API Endpoints (Phase 3 Additions)

```
-- Video Generation
POST   /api/jobs/video             → Start video generation job
GET    /api/jobs/:id/video         → Get video URL + status

-- Bulk Operations
POST   /api/bulk/upload            → Upload multiple images
POST   /api/bulk/:batchId/process  → Process batch (bg removal / try-on / video)
GET    /api/bulk/:batchId          → Get batch status + results

-- Pro Plan
GET    /api/plans                  → Updated with Pro plan details
```

## Bulk Upload Flow

```
1. User selects up to 50 images
2. Frontend uploads all to R2 (presigned URLs for parallel upload)
3. Backend creates a bulk batch + individual jobs
4. User selects: processing type (bg removal / try-on / video)
5. If try-on/video: select model + background (applied to all)
6. Jobs processed via priority queue
7. Progress bar shows: "23/50 completed"
8. Download all as ZIP when complete
```

## Output Formats

| Platform | Format | Resolution | Max Size |
|---|---|---|---|
| WhatsApp Status | MP4 H.264 | 720p | 16MB |
| Instagram Reels | MP4 H.264 | 1080x1920 (9:16) | 100MB |
| General Download | MP4 H.264 | 1080p | No limit |

FFmpeg will auto-generate all three formats from the Kling output.

## Cost Per Video

| Step | Cost |
|---|---|
| Try-on image (FASHN) | ~Rs 6.5 |
| Kling AI API (standard) | ~Rs 50 ($0.60) |
| FFmpeg processing | ~Rs 0.5 |
| Storage (R2) | ~Rs 0.5 |
| **Total per video** | **~Rs 57.5** |

At Rs 1,499/month for 30 videos:
- Revenue per video: Rs 49.97
- Loss per video: ~Rs 7.5 (subsidized by try-on + bg removal margins)

**Note**: Video is a loss leader that drives Pro upgrades. The 200 try-ons (margin: Rs 476) and 500 bg removals (margin: ~Rs 475) in Pro plan cover the video loss.

### Pro Plan Unit Economics
```
Revenue:                          Rs 1,499
Cost: 500 bg removals (Rs 250)
    + 200 try-ons (Rs 1,520)
    + 30 videos (Rs 1,725)
Total cost:                       Rs 3,495
Loss per Pro user:                Rs -1,996
```

**Reality check**: Most users won't exhaust all credits. Assume 40% utilization:
```
Adjusted cost:                    Rs 1,398
Margin per Pro user:              Rs 101
```

Consider raising Pro to Rs 1,999/month or reducing video quota to 20/month after validating usage patterns.

## Success Criteria

- 10 Pro subscribers within 4 weeks
- Video quality rated 3.5+/5 (video gen AI is still evolving)
- Average video generation time < 60 seconds
- At least 5 retailers post generated videos on Instagram/WhatsApp
- Bulk upload works reliably for 50-image batches

## Key Risks

| Risk | Mitigation |
|---|---|
| Kling video quality inconsistent | Add retry logic, let user regenerate 1x free per video |
| Video generation slow (>2 min) | Set expectations in UI: "Your video will be ready in ~2 minutes" + SMS notify |
| Pro plan too expensive for small retailers | Offer annual plan at Rs 999/month (Rs 11,988/year) |
| Kling API pricing changes | Monitor costs, have Runway Gen-3 as backup API |

## Week-by-Week Breakdown

**Week 8**: Kling AI Integration
- [ ] Set up Kling AI API account + credentials
- [ ] Build video generation service
- [ ] Create prompt templates for 3 video styles
- [ ] FFmpeg post-processing pipeline (trim, compress, format)
- [ ] Test with 20+ garments

**Week 9**: Bulk Upload + Pro Plan
- [ ] Bulk upload UI (drag-drop multiple files)
- [ ] Presigned URL parallel upload to R2
- [ ] Batch processing with progress tracking
- [ ] Pro plan in Razorpay (Rs 1,499/month)
- [ ] Credit system update for video quota

**Week 10**: Polish + Launch
- [ ] Video gallery with playback
- [ ] Download in multiple formats (WhatsApp/Instagram/General)
- [ ] ZIP download for bulk results
- [ ] Pro plan marketing page
- [ ] Launch to existing users + targeted outreach
