# Bugs & Fixes Tracker

Last updated: 2026-03-17

## Fixed

### 1. Credit Race Condition [CRITICAL] — FIXED
**File**: `backend/src/modules/background/services/background-service.ts`
**Issue**: Credits checked and decremented in separate queries. Two concurrent requests could both pass the check and over-deduct.
**Fix**: Atomic `UPDATE WHERE credits > 0` + decrement in one query. Refund on failure with CRITICAL log if refund fails. Input validation moved before credit deduction.

### 2. Telegram Webhook Handler [CRITICAL] — FIXED
**File**: `backend/src/modules/telegram/bot.ts:129`
**Issue**: `new Request(webhookUrl, ...)` used external ngrok URL. Grammy only reads the body, but URL was semantically wrong.
**Fix**: Changed to `http://localhost/telegram/webhook` as a local sentinel URL.

### 3. Missing Route Schema Validation [HIGH] — FIXED
**File**: `backend/src/modules/tryon/routes/tryon-routes.ts`
**Issue**: POST `/catalog` and GET `/batch/:batchId` had no input validation schemas.
**Fix**: Added `generateCatalogSchema` (validates category enum) and `getBatchSchema` (validates batchId as UUID).

### 4. Frontend Catalog Page Hardcoded for 4 Images [HIGH] — FIXED
**File**: `frontend/src/app/(protected)/catalog/[batchId]/page.tsx`
**Issue**: Skeleton showed 4 items, grid was always 2-column. Backend now returns 1 image.
**Fix**: Skeleton shows 1 item. Grid adapts dynamically (1-col for single, 2-col for multiple). Removed unsafe `!` assertion on `output_image_url`.

### 5. Path Traversal in Storage [MEDIUM] — FIXED
**File**: `backend/src/lib/storage.ts`
**Issue**: `readLocalFile()` and `storage.remove()` didn't validate paths stay within uploads directory.
**Fix**: Added `resolve()` + `startsWith(uploadDir)` check to both `readLocalFile()` and `remove()`. Improved `relativePathFromUrl()` to handle both absolute and relative URL formats.

---

## Remaining (Low Priority)

### 6. No Telegram Webhook Secret
**File**: `backend/src/modules/telegram/bot.ts`
**Issue**: Webhook endpoint has no secret token verification. Anyone who discovers the URL can send fake updates.
**Fix needed**: Set `secret_token` in `bot.api.setWebhook()` and verify `X-Telegram-Bot-Api-Secret-Token` header in the route.
**Priority**: Low — only matters in production with a stable webhook URL.

### 7. UUID Format Missing on Some Schema Params
**File**: `backend/src/modules/tryon/schemas/tryon-schemas.ts`
**Issue**: `deleteUserModelSchema.id`, `generateTryOnSchema.job_id`, and `model_value` reference UUID primary keys but aren't validated as UUID format. Inconsistent with `getBatchSchema.batchId` which does validate.
**Fix needed**: Add `format: 'uuid'` to all ID params.
**Priority**: Low — Knex parameterizes queries so no SQL injection risk. Just wastes a DB round-trip on invalid IDs.

### 8. Scene Background Generation Race Condition
**File**: `backend/src/modules/background/services/background-service.ts:133-141`
**Issue**: Two concurrent requests could both generate and save the scene background for the same preset (no lock).
**Fix needed**: Use a DB transaction or optimistic locking pattern.
**Priority**: Low — worst case is duplicate AI calls, not data corruption.

### 9. Unchecked Array Destructuring from Knex
**Files**: Multiple service files (job-service.ts, tryon-service.ts, background-service.ts)
**Issue**: Pattern `const [job] = await db(...).returning('*')` assumes array has at least one element.
**Fix needed**: Add null checks after destructuring.
**Priority**: Low — Knex `.insert().returning('*')` always returns the inserted row on PostgreSQL.

### 10. Silent Error Swallowing in storage.remove()
**File**: `backend/src/lib/storage.ts:33`
**Issue**: `.catch(() => {})` silently swallows all errors including permission denied or disk errors.
**Fix needed**: Log non-ENOENT errors: `.catch(err => { if (err.code !== 'ENOENT') console.error(...) })`
**Priority**: Low — only affects cleanup operations, not core functionality.
