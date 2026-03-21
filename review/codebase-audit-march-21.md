# Codebase Audit — March 21, 2026

**Scope**: Full Telegram bot codebase
**Target**: 10-20 MVP users
**Auditor**: Senior Engineering Advisor

---

## CRITICAL (Will break for users)

### 1. `is_approved` column missing from migrations
**File**: `bot.ts:21`, all migration files
**Impact**: Column was added via `psql` directly — works now but breaks on DB recreate or deploy.
**Fix**: Create migration `20260321_add_is_approved.ts`

### 2. Partial failure: credits not refunded for failed images in multi-image batch
**File**: `catalog-handler.ts:127-136`, `tryon-service.ts:240-284`
**Impact**: User pays 4 credits, 2 images fail, loses 2 credits. No refund for partial failures.
**Fix**: Capture `createCatalogProgressive` return value, refund `failedCount` credits.

### 3. Race condition in `findOrCreateByTelegramId`
**File**: `telegram-user-service.ts:14-31`
**Impact**: SELECT then INSERT without conflict handling. Rapid messages can cause duplicate key error.
**Fix**: Use `INSERT ... ON CONFLICT(telegram_id) DO UPDATE` (upsert pattern).

### 4. Server crash loses credits with no recovery
**File**: `session.ts` (all state), `catalog-handler.ts`
**Impact**: Credits deducted, Gemini billed, but server dies mid-generation. Credits lost permanently.
**Fix**: Add startup cleanup — mark stale `processing` jobs as `failed` after 10 minutes.

---

## HIGH (Causes bad UX)

### 5. Admin approve/reject has no authorization check
**File**: `bot.ts:202-220`
**Impact**: Any user who crafts the right callback data could approve themselves.
**Fix**: Add `if (ctx.from.id !== ADMIN_CHAT_ID) return` to both handlers.

### 6. `delivery_failed` with no credit refund
**File**: `catalog-handler.ts:203-205`
**Impact**: AI succeeded, images on disk, but Telegram delivery failed. User gets nothing, credits gone.
**Fix**: Refund credits in the `sentCount === 0` path.

### 7. `setInterval` async callback has no error handling
**File**: `catalog-handler.ts:156-159`
**Impact**: If `editMessageText` rejects (rate limit), unhandled promise rejection. Can crash Node 18+.
**Fix**: Add `.catch(() => {})` to the `updateProgress` call inside setInterval.

### 8. Two separate Knex connection pools
**File**: `server.ts:13-14`, `plugins/database.ts`
**Impact**: 4 idle connections minimum. Wasteful but not breaking.
**Fix**: Pass `app.knex` to bot instead of creating new pool.

### 9. Cooldown based on `created_at` not `completed_at`
**File**: `catalog-handler.ts:30-38`
**Impact**: Cooldown is effectively bypassed — 30s elapses during generation itself.
**Fix**: Query `completed_at` instead of `created_at`.

### 10. Rejected users can spam admin with approval requests
**File**: `bot.ts:46-63`
**Impact**: No "rejected" state — rejected user triggers new admin notification every photo.
**Fix**: Skip admin notification for users who already have a record.

---

## MEDIUM (Technical debt)

### 11. No file size check before download
**File**: `catalog-handler.ts:59`
**Fix**: Check `file.file_size > 10MB` before downloading.

### 12. Stickers/WebP may bypass garment validation
**File**: `bot.ts:230-237`
**Fix**: Add minimum resolution check (200x200px).

### 13. No timeout on Gemini API calls
**File**: `ai-client.ts:276-291`
**Fix**: Add `Promise.race` with 60s timeout.

### 14. `getMimeType` edge case for extensionless files
**File**: `storage.ts:68-76`
**Fix**: Handle `lastIndexOf('.') === -1` explicitly.

---

## LOW (Nice to have)

### 15. Hardcoded admin chat ID
**Fix**: Move `ADMIN_CHAT_ID` to env variable.

### 16. Classification failure defaults to pass-through
**Fix**: Acceptable for MVP, just log prominently.

### 17. Unknown gender passes check
**Fix**: Defense-in-depth gap, acceptable for MVP.

---

## Priority Fix Order (Most impact, least effort)

| Priority | Issue | Effort |
|----------|-------|--------|
| 1 | #5 Admin auth check | 2 lines |
| 2 | #7 setInterval catch | 1 line |
| 3 | #6 delivery_failed refund | 1 line |
| 4 | #9 Cooldown fix | Change column name |
| 5 | #2 Partial batch refund | 10 lines |
| 6 | #3 Upsert pattern | Replace function |
| 7 | #1 is_approved migration | New migration file |
| 8 | #13 Gemini timeout | Promise.race wrapper |
| 9 | #4 Startup cleanup | 10 lines in server.ts |
| 10 | #10 Rejected user spam | Add check before notification |
