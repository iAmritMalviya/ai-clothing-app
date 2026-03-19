# Architecture Review — Full Codebase

**Date**: 2026-03-19
**Scope**: Complete backend codebase (`backend/src/`)
**Production Readiness Score**: 4/10

---

## What's Good

1. **Zero `any` types** — strict TypeScript throughout, rare discipline
2. **Clean module boundaries** — consistent `routes → handlers → services` layering across all modules
3. **Atomic credit deduction** — `WHERE free_credits_remaining > 0` + decrement prevents race conditions
4. **Path traversal protection** — `storage.ts` validates paths with `resolve()` + `startsWith(uploadDir)`
5. **Config-driven AI provider switching** — per-operation env vars (`AI_PROVIDER_BG_REMOVAL`, etc.) with runtime key validation
6. **Pose template system** — well-architected, category-aware, adding new garment types is config-only
7. **Background prompt decomposition** — scene/lighting/depth/style layers with deterministic index-based selection
8. **Telegram bot security** — webhook secret, session state machine, account age checks, rate limiting, garment validation
9. **All sensitive files gitignored** — `.env`, `vertex-sa.json`, `uploads/`

---

## Critical Issues

### C1: Root `.gitignore` Doesn't Protect Secrets

**File**: `.gitignore` (root)
**Risk**: Root gitignore only has `.DS_Store` and `*.pem`. The `backend/.gitignore` protects `.env` and `vertex-sa.json`, but only when `git add` is run from within `backend/`. A `git add -A` from the project root would stage credentials permanently into git history.

**Fix**: Add to root `.gitignore`:
```
**/.env
**/.env.*
**/vertex-sa.json
```

---

### C2: CORS Wide Open

**File**: `backend/src/app.ts:26`
**Code**: `await app.register(cors)` — defaults to `origin: *`
**Risk**: Any website can make authenticated API requests if it has a JWT token. Combined with XSS anywhere, this is a credential theft vector.

**Fix**:
```typescript
await app.register(cors, {
  origin: [config.publicUrl, 'http://localhost:3002'],
  credentials: true,
});
```

---

### C3: No Graceful Shutdown

**File**: `backend/src/server.ts`
**Risk**: `SIGTERM` (sent by Docker/Coolify/Railway on deploy) kills the process mid-request. Database connections leak. In-progress AI jobs are abandoned without cleanup. The database plugin has an `onClose` hook but nobody calls `app.close()`.

**Fix**:
```typescript
const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Shutting down');
  await app.close(); // triggers onClose hooks (DB, bot, etc.)
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

---

### C4: No Timeout on External AI Calls

**File**: `backend/src/lib/ai-client.ts` — all `fetch()` calls
**Risk**: If an AI provider (fal.ai, Gemini, Vertex) hangs, the HTTP request hangs forever. Under load, this exhausts all Fastify worker capacity and the server becomes unresponsive.

**Fix**: Add `AbortController` with timeout to every external fetch:
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min
try {
  const response = await fetch(url, { signal: controller.signal, ... });
} finally {
  clearTimeout(timeout);
}
```

Also set Fastify-level timeout in `app.ts`:
```typescript
const app = Fastify({ requestTimeout: 180_000 }); // 3 min
```

---

## High Priority Issues

### H1: Synchronous AI Processing (No Job Queue)

**Files**: `job-service.ts`, `tryon-service.ts`, `background-service.ts`
**Issue**: All AI operations (5-60 seconds) run inside the HTTP request handler. The client waits, the Fastify worker thread is blocked, and if the connection drops the work is lost (AI cost already spent).
**Impact**: Cannot scale beyond ~5 concurrent users.

**Fix**: Add Redis + BullMQ:
1. Create job in `pending` state, return immediately with job ID
2. BullMQ worker processes the AI call
3. Client polls `GET /api/jobs/:id` or receives SSE/webhook notification

---

### H2: Redundant `createStorage()` in Every Handler

**Files**: `job-handlers.ts:6`, `background-handlers.ts:12`, `tryon-handlers.ts:14`, `server.ts:14`
**Issue**: 4 separate storage instances created at module scope. Should be a singleton.

**Fix**: Register as a Fastify decorator:
```typescript
// plugins/storage.ts
fp(async (fastify) => {
  fastify.decorate('storage', createStorage());
});
// Usage: request.server.storage
```

---

### H3: All Database Queries Return Untyped Results

**Files**: All service files
**Issue**: Knex queries return `any`. Column renames in migrations silently break runtime with zero TypeScript errors. Example: `sourceJob.transparent_image_url` — no type safety on `sourceJob`.

**Fix**: Define row types and use Knex generics:
```typescript
interface JobRow {
  id: string;
  user_id: string;
  type: 'bg_removal' | 'apply_bg' | 'tryon';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  input_image_url: string;
  // ...all columns
}
const job = await db<JobRow>('jobs').where({ id }).first();
```

---

### H4: No Global Error Handler

**File**: `backend/src/app.ts` — no `setErrorHandler`
**Issue**: Unhandled errors (e.g., Knex connection failure) return raw 500 with stack trace in dev, generic message in prod. Error response formats are inconsistent across the codebase.

**Fix**:
```typescript
app.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error }, 'Request error');
  const status = error.statusCode ?? 500;
  reply.status(status).send({
    statusCode: status,
    error: status >= 500 ? 'Internal Server Error' : error.message,
  });
});
```

---

### H5: `NODE_ENV` Cast Without Validation

**File**: `backend/src/config/env.ts:47`
**Code**: `nodeEnv: (process.env['NODE_ENV'] as Config['nodeEnv']) ?? 'development'`
**Issue**: If `NODE_ENV=staging`, the cast lies — TypeScript thinks it's valid but `database.ts` config lookup returns `undefined`.

**Fix**:
```typescript
function parseNodeEnv(val?: string): 'development' | 'production' | 'test' {
  if (val === 'production' || val === 'test') return val;
  return 'development';
}
```

---

### H6: No Rate Limiting on REST API

**File**: `backend/src/app.ts`
**Issue**: Telegram bot has 30s cooldown, but the REST API has zero rate limiting. An attacker with a JWT can spam `/api/tryon/catalog` and burn AI credits.

**Fix**: Add `@fastify/rate-limit`:
```typescript
await app.register(rateLimit, {
  max: 10,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.user?.userId ?? req.ip,
});
```

---

### H7: `updated_at` Not Auto-Updated

**File**: `users` table
**Issue**: `decrement('free_credits_remaining')` in `background-service.ts` and `catalog-handler.ts` doesn't update `updated_at`. Only manual profile updates do.

**Fix**: Add a PostgreSQL trigger:
```sql
CREATE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## Medium Priority Issues

### M1: Duplicate Prompt Strings

**Files**: `ai-client.ts:267,320`, `pose-templates.ts:77-78`, `background-prompts.ts:100`
**Issue**: Default pose prompt copy-pasted in `tryOnGemini` and `tryOnNanaBanana`. Quality/negative suffixes duplicated across 3 files.
**Fix**: Consolidate into `lib/prompts/shared.ts` and import everywhere.

---

### M2: SSRF Vector in `readModelImage`

**File**: `backend/src/modules/tryon/services/tryon-service.ts:89-98`
**Code**: `if (url.startsWith('http')) { const resp = await fetch(url); }`
**Issue**: If a model preset's `image_url` is set to an arbitrary URL (migration mistake, DB manipulation), the server fetches arbitrary external URLs.
**Fix**: Restrict to local paths only, or validate hostname against an allowlist.

---

### M3: `setInterval` Side Effect at Module Import

**File**: `backend/src/modules/telegram/session.ts:40-47`
**Issue**: A cleanup interval starts on `import`. Untestable, prevents clean shutdown, runs even if bot is disabled.
**Fix**: Return a cleanup function, or tie lifecycle to Fastify's `onClose` hook.

---

### M4: `createCatalog` and `createCatalogProgressive` Are 90% Duplicate

**File**: `backend/src/modules/tryon/services/tryon-service.ts:109-275`
**Issue**: ~170 lines of nearly identical code. Save garment, fetch preset, downscale, create job, run try-on, save output — duplicated. Only difference is the progressive version takes a callback.
**Fix**: Extract shared logic into a private helper. Both public functions call it.

---

### M5: Missing Index on `jobs.user_id`

**File**: `backend/migrations/20260220_create_users_and_jobs.ts`
**Issue**: Every job query filters by `user_id`, but there's no index. PostgreSQL doesn't auto-index FK columns. At 10K+ jobs, query performance degrades.
**Fix**: New migration: `table.index('user_id')` on `jobs`.

---

### M6: SSL Verification Disabled in Production

**File**: `backend/src/config/database.ts:24`
**Code**: `ssl: { rejectUnauthorized: false }`
**Risk**: Allows MITM attacks on the database connection in production.
**Fix**: Use proper CA certificate or set `rejectUnauthorized: true`.

---

### M7: Schema `jobProperties` Duplicated 3x

**Files**: `job-schemas.ts`, `background-schemas.ts`, `tryon-schemas.ts`
**Issue**: Identical JSON schema definition copy-pasted across 3 files.
**Fix**: Extract to `lib/schemas/job-properties.ts` and import.

---

### M8: No Image Downscaling Before BG Removal / Single Try-On

**File**: `backend/src/modules/job/handlers/job-handlers.ts`
**Issue**: Catalog flow downscales to 512px, but bg-removal and single try-on send raw uploads (up to 10MB / 8000x8000) to AI services.
**Fix**: Add `sharp().resize()` before sending to AI in all pipelines.

---

### M9: `background-prompts.ts` Is 585 Lines of String Constants

**File**: `backend/src/lib/background-prompts.ts`
**Issue**: Largest file in codebase. Essentially config data encoded as TypeScript. Adding backgrounds requires code changes.
**Fix**: Move to JSON/YAML config loaded at startup with type validation.

---

## Low Priority Issues

### L1: `console.log/error` Instead of Pino Logger (14 instances)

**Files**: Telegram module, AI client, OTP service
**Issue**: Bypasses Fastify's structured Pino logging — no timestamps, no request IDs, no JSON in production.
**Fix**: Create standalone Pino instance in `lib/logger.ts`, use everywhere.

---

### L2: Non-null Assertions on `sharp().metadata()`

**File**: `image-compositor.ts:16-17`
**Code**: `const width = metadata.width!;`
**Issue**: Corrupt/empty buffer → `undefined` → runtime crash with no descriptive error.
**Fix**: Check for undefined, throw descriptive error.

---

### L3: Phone Normalization Assumes India (+91)

**File**: `backend/src/modules/auth/services/auth-service.ts:6-18`
**Issue**: All 10-digit numbers silently get `+91` prefix. International numbers mangled without warning.
**Fix**: Document the assumption. Better: require `+XX` prefix from client.

---

### L4: OTP Always Returns Dev Provider

**File**: `backend/src/modules/auth/services/otp-service.ts:38-40`
**Code**: `return createDevOtpProvider()` — unconditional, ignores `NODE_ENV`
**Risk**: Production would use hardcoded `123456` OTP codes.
**Fix**: Check `NODE_ENV` and throw if no production provider configured.

---

### L5: Telegram Bot Creates Separate Knex Instance

**File**: `backend/src/server.ts:13`
**Issue**: `const db = knex(getKnexConfig())` creates a second connection pool. Wastes DB connections.
**Fix**: Use `app.knex` from the Fastify database plugin.

---

### L6: Shallow Health Check

**File**: `backend/src/app.ts:41-43`
**Issue**: Returns `{ status: 'ok' }` without checking DB connectivity.
**Fix**: `await request.server.knex.raw('SELECT 1')` inside health check.

---

### L7: Migration Seeds Reference Non-Existent Image Files

**File**: `backend/migrations/20260222_add_tryon.ts:33-37`
**Issue**: Seeds model presets with paths like `/uploads/model-presets/female-1.png`. Fresh deployment without these files → try-on fails with file-not-found.
**Fix**: Include preset images in repo, or handle missing files gracefully.

---

### L8: Zero Test Files

**File**: `backend/tests/` — empty `unit/`, `integration/`, `fixtures/`
**Issue**: No test suite, no test runner in `package.json`.
**Fix**: Add vitest, start with integration tests for auth flow and catalog generation.

---

## Priority Summary

| Priority | Count | Action |
|----------|-------|--------|
| Critical | 4 | Fix before any deployment |
| High | 7 | Fix before production traffic |
| Medium | 9 | Fix during next sprint |
| Low | 8 | Fix opportunistically |

## Top 5 Before Deployment

1. Lock down CORS → `app.ts`
2. Add graceful shutdown → `server.ts`
3. Add AbortController timeouts on AI calls → `ai-client.ts`
4. Add `@fastify/rate-limit` → `app.ts`
5. Protect root `.gitignore` → `.gitignore`

## Top 5 For Code Quality

1. Define TypeScript row types for all tables → use `db<RowType>('table')`
2. Register storage as Fastify decorator → singleton instead of per-handler
3. Extract shared schema fragments → eliminate 3-way duplication
4. Replace `console.log/error` with Pino → structured logging
5. Add vitest + integration tests → minimum auth + catalog flow
