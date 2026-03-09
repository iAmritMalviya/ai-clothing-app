# Catalog Pipeline Plan — E-Commerce Fashion Photo Generation

**Created**: 2026-03-08
**Goal**: Generate Myntra/Ajio-quality catalog photos from a single garment upload
**Approach**: First principles — multi-model pipeline, not single API call

---

## Problem Statement

Upload a garment photo → get 4 professional e-commerce catalog photos with Indian male models, studio lighting, correct garment texture/logos, and realistic body alignment.

This is a **computer vision pipeline problem**, not a prompt-engineering problem.

---

## 1. Current State Assessment

### What We Have
- Fastify backend + Next.js frontend (working)
- FASHN v1.6 try-on via fal.ai ($0.075/generation)
- BiRefNet v2 bg removal via fal.ai
- Gemini for scene generation
- Catalog batch system (upload → 4 parallel try-ons → batch results page)
- Auth, credits, job tracking — all working

### What's Broken
- **Model preset photos are AI-generated** (fal flux-dev/schnell) — FASHN produces bad results with AI-generated inputs (headless, unrealistic)
- **Single-model pipeline** — one API call can't solve garment transfer, lighting, pose, and texture simultaneously
- **No garment segmentation** — we pass raw garment to FASHN, no pre-processing
- **No post-processing** — no face enhancement, lighting correction, or upscaling

### Root Cause
FASHN's try-on model was trained on real photos. AI-generated model inputs have subtle artifacts that break the pipeline. The real fix is either:
1. Use real model photos (stock or FASHN's own Model Create)
2. Build a proper multi-model pipeline

---

## 2. Target Architecture (First Principles)

Break the problem into deterministic steps, each solving one physics problem:

```
User Upload (garment photo)
   │
   ▼
Step 1: Background Removal
   │   Remove garment background → transparent PNG
   ▼
Step 2: Garment Segmentation
   │   Detect exact clothing region (shirt/pants/jacket/dress)
   ▼
Step 3: Garment Type Classification
   │   Classify: tshirt, shirt, jeans, jacket, kurta, dress
   ▼
Step 4: Pose Template Selection
   │   Select appropriate model pose (front/side/angle)
   ▼
Step 5: Virtual Try-On (Core Diffusion Model)
   │   Condition on: garment + pose + body → model wearing garment
   ▼
Step 6: Face Enhancement + Lighting Correction
   │   GFPGAN/CodeFormer + RealESRGAN
   ▼
Step 7: Background Generation
   │   Clean studio background with proper shadows
   ▼
Final Catalog Image
```

---

## 3. Model Stack (What Fashion AI Startups Use)

| Step | Model | Role | License |
|---|---|---|---|
| Background Removal | U2Net / rembg / BiRefNet | Transparent garment | Open |
| Garment Segmentation | SegFormer / Detectron2 | Identify clothing region | Open |
| Classification | CLIP / Simple CNN | tshirt vs shirt vs jeans | Open |
| Human Parsing | SCHP | Body part identification | Open |
| Pose Control | OpenPose + ControlNet Pose | Consistent model poses | Open |
| **Virtual Try-On** | **IDM-VTON** | Core garment transfer | **CC BY-NC-SA 4.0 (non-commercial)** |
| Try-On Alternative | CatVTON + Flux Fill | SOTA on VITON-HD benchmark | **CC BY-NC-SA 4.0 (non-commercial)** |
| Try-On Alternative | FASHN v1.6 | Commercial API | **Commercial OK** |
| Try-On Alternative | Stable Diffusion + ControlNet + IP-Adapter | Flexible but needs tuning | Open / Commercial |
| Face Enhancement | GFPGAN / CodeFormer | Restore face detail | Open |
| Super Resolution | RealESRGAN | Upscale + sharpen | Open |
| Lighting | Relight diffusion | Studio lighting correction | Open |

### Critical Licensing Issue

**ALL popular open-source VTON models are CC BY-NC-SA 4.0 — non-commercial:**
- IDM-VTON, CatVTON, StableVITON, OOTDiffusion, HR-VITON
- The two main training datasets (VITON-HD, DressCode) are also non-commercial
- Even if model code were permissive, models trained on these datasets inherit non-commercial restriction
- Self-hosting does NOT bypass this — the license applies to model weights, not just redistribution

**FASHN is currently the ONLY commercially-licensed, purpose-built virtual try-on API.**
This is why they can charge $0.075/image — zero commercial competition in API space.

For a commercial product, the realistic options are:
1. **FASHN API** (via fal.ai or direct) — commercial, proven, $0.075/image (down to $0.04 at scale)
2. **FASHN direct API** — full suite: Model Create, Product-to-Model, Face-to-Model, Saved Models
3. **Stable Diffusion + ControlNet + IP-Adapter** — fully open, commercial OK, but requires custom pipeline + GPU hosting + extensive tuning
4. **Train custom model** on licensed/self-collected data — highest quality long-term, highest upfront cost

---

## 4. Implementation Strategy (3 Phases)

### Phase A: Quick Fix — FASHN Model Create (1-2 days)
**Goal**: Fix the immediate model photo quality problem

The root cause of our bad results is AI-generated model photos from flux. FASHN has a **Model Create API** that generates photorealistic models optimized for their own try-on pipeline.

**Actions:**
- [ ] Sign up at app.fashn.ai/api for FASHN API key
- [ ] Use FASHN Model Create to generate 4 Indian male model photos ($0.30 total)
- [ ] Replace flux-generated presets with FASHN-generated ones
- [ ] Test catalog flow end-to-end — should produce Myntra-quality results
- [ ] Optionally use FASHN "Product to Model" endpoint (garment → on-model photo in one call, no separate model photo needed)

**FASHN Direct API — Full 10-Endpoint Suite:**

All use `POST https://api.fashn.ai/v1/run` with `model_name` field.
Auth: `Authorization: Bearer <FASHN_API_KEY>` (separate from fal.ai key).
Async: Returns prediction ID → poll `GET /v1/status/{id}` → get output URLs.

| # | model_name | Credits | Time | Description |
|---|---|---|---|---|
| 1 | `tryon-v1.6` | 1/image | 5-17s | Virtual try-on: dress a person in a garment |
| 2 | `product-to-model` | 1 (4 with face_ref) | ~12s | Flat-lay/mannequin → on-model photo (Preview) |
| 3 | `model-create` | 1/image | 10-12s | Generate AI fashion model from text prompt |
| 4 | `model-variation` | 1/image | — | Create variations of existing model images |
| 5 | `model-swap` | 1/image | — | Replace model identity, preserve clothing |
| 6 | `face-to-model` | 1/image | — | Any face → professional fashion model photo |
| 7 | `edit` | 1/image | — | Post-processing: bg changes, pose adjust, brush edit |
| 8 | `reframe` | 1 (2 at 2K/4K) | ~10s | Generative fill to extend/reshape to new aspect ratio |
| 9 | `background-remove` | 1/image | — | Clean transparent PNG cutouts |
| 10 | `image-to-video` | varies | — | 5-10s fashion video clips at up to 1080p |

**IMPORTANT — fal.ai vs Direct API:**
- fal.ai (`fal-ai/fashn/tryon/v1.6`) — **try-on ONLY**, $0.075/image, sync mode available
- Direct API (`api.fashn.ai`) — **all 10 endpoints**, same price at low volume, cheaper at scale
- Parameters for try-on are identical — migration is straightforward
- Need direct API for model-create, product-to-model, face-to-model, saved models

**FASHN Consistent Models:**
- You can train a LoRA on FASHN to create a persistent model identity
- Reference via `saved:<model_name>` in try-on requests
- Same AI face across all catalog photos — critical for brand consistency

**Volume Pricing (Direct API only):**
| Volume | Price/Credit |
|---|---|
| On-demand | $0.075 |
| Monthly plan | ~$0.05-0.06 |
| Annual commitment | < $0.04 |
| Free trial | 10 credits |

**Key Insight**: FASHN's "Product to Model" might be the ideal endpoint — it takes a flat-lay garment photo and directly generates an on-model e-commerce photo. No need for separate model presets at all.

**Cost**: 4 catalog photos × $0.075 = **$0.30 per catalog** (~Rs 25)

**FASHN API Integration:**
```
POST https://api.fashn.ai/v1/run
Headers: Authorization: Bearer <FASHN_API_KEY>

Submit job → get prediction ID
Poll GET /v1/status/{id} every 2s
Status: starting → in_queue → processing → completed
Output: CDN URL (valid 72 hours)
```

---

### Phase B: Proper Pipeline with Post-Processing (1-2 weeks)
**Goal**: Add garment pre-processing and image post-processing for Myntra-level quality

**Pre-processing (before try-on):**
- [ ] Add garment background removal (already have BiRefNet)
- [ ] Add garment type auto-classification using CLIP
  - Map to FASHN categories: upper_body, lower_body, dresses
  - Remove manual category selector from UI
- [ ] Validate garment quality (reject blurry, too small, non-clothing)

**Post-processing (after try-on):**
- [ ] Face enhancement with GFPGAN/CodeFormer (via Replicate, ~$0.01/image)
- [ ] Image upscaling with RealESRGAN (via Replicate, ~$0.01/image)
- [ ] Lighting normalization (consistent studio look across all 4 photos)

**Updated Pipeline:**
```
Garment Upload
   │
   ▼
Background Removal (BiRefNet, already have)
   │
   ▼
Auto-Classify Garment Type (CLIP — new)
   │
   ▼
FASHN Try-On × 4 models (parallel)
   │
   ▼
Face Enhancement (GFPGAN — new)
   │
   ▼
Upscale + Sharpen (RealESRGAN — new)
   │
   ▼
4 Catalog Photos
```

**Cost per catalog**: $0.30 (try-on) + $0.04 (face) + $0.04 (upscale) = **~$0.38** (~Rs 32)

**Async Processing:**
- [ ] Add Redis + BullMQ for job queue
- [ ] Webhook or polling for status updates
- [ ] Progress indicator in frontend

---

### Phase C: Self-Hosted Pipeline (4-8 weeks, when scale justifies)
**Goal**: Dramatically reduce costs by self-hosting models on GPU

**When to do this**: When monthly API costs exceed GPU rental costs (~$200+/month, ~2,700+ images/month)

**Architecture:**
```
Frontend (Next.js)
   │
   ▼
API Gateway (Fastify)
   │
   ▼
Redis + BullMQ Queue
   │
   ▼
Python AI Workers (PyTorch)      ← NEW
   │
   ├── Garment Segmentation (SegFormer)
   ├── Human Parsing (SCHP)
   ├── Pose Control (ControlNet)
   ├── Virtual Try-On (SD + ControlNet + IP-Adapter)
   ├── Face Enhancement (GFPGAN)
   └── Super Resolution (RealESRGAN)
   │
   ▼
S3 / Cloudflare R2
   │
   ▼
CDN (Cloudflare)
```

**GPU Options:**
| Provider | GPU | Cost | Use Case |
|---|---|---|---|
| RunPod | A100 80GB | $1.64/hr | Development + testing |
| RunPod | A10 | $0.44/hr | Production (cost-efficient) |
| Replicate | A100 80GB | $0.0014/sec | Pay-per-use (low volume) |
| AWS | g5.xlarge (A10G) | $1.01/hr | Production (managed) |

**Cost per image (self-hosted)**: ~$0.01-0.03 vs $0.075 API
**Break-even**: ~2,700 images/month (at RunPod A10 24/7)

**Self-Hosted Model Selection:**
- Use Stable Diffusion + ControlNet + IP-Adapter for try-on (fully commercial license)
- NOT IDM-VTON/CatVTON (non-commercial license — training data also non-commercial)
- Fine-tune on Indian fashion e-commerce dataset for best results
- Alternatively: negotiate a commercial license directly with FASHN for self-hosted deployment
- Or: continue using FASHN API at annual discount (<$0.04/image) — may be cheaper than GPU hosting until very high volume

**Python Worker Structure:**
```
ai-worker/
  ├── models/
  │     vton_model.py
  ├── pipelines/
  │     tryon_pipeline.py
  ├── preprocess/
  │     segmentation.py
  │     classification.py
  ├── postprocess/
  │     face_enhance.py
  │     upscale.py
  └── server.py          # FastAPI, receives jobs from BullMQ
```

---

## 5. Recommended Immediate Action (Phase A)

**Do this now — 1 day of work:**

1. Sign up at https://app.fashn.ai/api → get `FASHN_API_KEY`
2. Add `FASHN_API_KEY` to backend `.env`
3. **Option A**: Use FASHN Model Create to generate 4 Indian male model presets
   - Better model photos → better FASHN try-on results
   - Keep existing catalog flow
4. **Option B** (potentially better): Use FASHN "Product to Model" endpoint
   - Skip model presets entirely
   - Send flat-lay garment → get on-model photo directly
   - Each call generates a different model automatically
   - Simpler code, fewer moving parts
   - **Note**: This endpoint is in "Preview" status — may have quality/stability limitations
5. Add FASHN direct API client alongside existing fal.ai integration
6. Test end-to-end catalog generation

**Backend Changes:**
- Add `fashn-client.ts` for FASHN REST API (submit + poll pattern)
- Update `tryon-service.ts` to support FASHN direct API
- Add `FASHN_API_KEY` to env config

---

## 6. Cost Comparison

| Approach | Cost/Image | Cost/4-Photo Catalog | Monthly (1000 catalogs) |
|---|---|---|---|
| Current (FASHN via fal.ai) | $0.075 | $0.30 | $300 |
| FASHN direct API | $0.075 | $0.30 | $300 |
| FASHN + post-processing | $0.095 | $0.38 | $380 |
| Self-hosted (RunPod A10) | ~$0.02 | $0.08 | $80 + $320 GPU = $400 |
| Self-hosted (at 5000 catalogs) | ~$0.02 | $0.08 | $400 + $320 GPU = $720 vs $1500 API |

**Break-even for self-hosting: ~2,700 catalogs/month**

---

## 7. Competitive Landscape

| Competitor | Focus | Pricing | Our Advantage |
|---|---|---|---|
| ZMO AI | Global fashion | $0.10+/image | India focus, cheaper |
| FASHN AI | API-first | $0.075/image | Simpler UX for non-tech retailers |
| Vue.ai | Enterprise | Custom pricing | Self-serve, no sales process |
| Lalaland | Diverse models | Enterprise | India-specific models |
| Doji | Virtual try-on | Freemium | Hindi UI, WhatsApp integration |

**Our edge**: India focus + cheap pricing + simple UI + fast generation. Target: small retailers, Instagram stores, Shopify sellers.

---

## 8. Cross-Reference with Existing Plan

### Matches with Phase 2 (phase-2-pending.md)
- [x] Virtual try-on via FASHN — keeping, fixing model photos
- [x] Model preset system — keeping, upgrading photo quality
- [x] Garment category support — keeping, adding auto-classification later
- [x] Catalog batch system — built, needs model photo fix
- [ ] Expand model library (10-15 diverse models) — now via FASHN Model Create
- [ ] BullMQ job queue — deferred to Phase B

### Matches with Phase 3 (phase-3-pending.md)
- Video generation (Kling AI) — unchanged, try-on image feeds into video
- Bulk upload — unchanged, catalog batch system is the foundation
- FFmpeg post-processing — unchanged

### Matches with Phase 4 (phase-4-pending.md)
- WhatsApp catalog push — unchanged
- Hindi localization — unchanged
- Self-hosted IDM-VTON mentioned in "Beyond Phase 4" — now planned as Phase C with commercial-license alternative (SD + ControlNet + IP-Adapter)

### New from Analysis
- **Garment segmentation** (SegFormer/Detectron2) — not in existing plan, adds to Phase B
- **Auto-classification** (CLIP) — not in existing plan, adds to Phase B
- **Face enhancement** (GFPGAN/CodeFormer) — not in existing plan, adds to Phase B
- **Image upscaling** (RealESRGAN) — not in existing plan, adds to Phase B
- **Python AI workers** — not in existing plan, adds to Phase C
- **FASHN Product-to-Model** — not in existing plan, potential simplification for Phase A

---

## 9. Senior Engineer Analysis: Why Most Try-On Results Look Bad

### The Fundamental Problem
Most developers do: `garment → single diffusion model → result`

This fails because:
1. **Logos distort** — diffusion models alter text/logos during denoising
2. **Cloth fitting is wrong** — loose garments look weird without pose-aware warping
3. **Cloth type matters** — shirt vs jacket needs different draping physics
4. **Lighting inconsistency** — generated image lighting doesn't match studio look
5. **Face artifacts** — diffusion models produce subtle face issues

### Why Myntra Photos Look Real
Myntra uses a pipeline, not a single model:
- **Perfect garment texture** — preserved via specialized garment encoder
- **Correct cloth draping** — pose-aware warping (TPS transformation)
- **Natural body pose** — fixed pose templates, not random generation
- **Studio lighting** — post-processing with consistent lighting model
- **Consistent model identity** — same face across variations
- **Clean background** — studio bg generated separately

### The Fix
Each physics problem needs a specialized model. The pipeline architecture in Section 2 addresses each one individually. For MVP, FASHN's API handles most of this internally — we just need to feed it proper inputs (real/FASHN-generated model photos, not flux-generated).

---

## 10. Action Items (Priority Order)

### Immediate (Today)
- [ ] Get FASHN API key from app.fashn.ai/api
- [ ] Test FASHN Model Create with Indian male prompts
- [ ] Test FASHN Product-to-Model with garment flat-lay
- [ ] Decide: Model Create + Try-On vs Product-to-Model
- [ ] Generate 4 production model presets via FASHN

### This Week
- [ ] Integrate FASHN direct API into backend
- [ ] Replace flux-generated model presets
- [ ] Test full catalog flow in browser
- [ ] Add garment type auto-detection (simple heuristic or CLIP)

### Next 2 Weeks (Phase B)
- [ ] Add face enhancement post-processing
- [ ] Add image upscaling
- [ ] Add Redis + BullMQ for async processing
- [ ] Progress indicator in frontend during generation

### When Scale Justifies (Phase C)
- [ ] Set up Python AI worker service
- [ ] Self-host SD + ControlNet + IP-Adapter
- [ ] Self-host GFPGAN + RealESRGAN
- [ ] Benchmark quality vs FASHN API
- [ ] Migrate production traffic gradually

---

*This plan is a living document. Update as we validate assumptions with real results.*
