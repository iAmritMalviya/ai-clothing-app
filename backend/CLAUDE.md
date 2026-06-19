# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm**. Node `>=22` required.

```bash
pnpm dev              # tsx watch src/server.ts (hot reload)
pnpm build            # tsc → dist/, then strips dist/migrations/*.d.ts (Knex chokes on them)
pnpm start            # node dist/src/server.js (production)
pnpm migrate          # run pending migrations against DATABASE_URL (uses tsx, reads migrations/*.ts)
pnpm migrate:rollback # rollback last batch
pnpm migrate:make <name>  # generate a new migration file
pnpm migrate:prod     # production entrypoint — runs compiled migrations from dist/migrations/
```

There is **no test runner configured** and **no lint script**. Test files exist as empty folders (`tests/unit`, `tests/integration`). Don't claim "tests pass" — there's nothing to run.

The dev server runs on `PORT` (default 3001) and is independent of the Next.js frontend on port 3002.

## Architecture

### Fastify app composition (`src/app.ts` → `src/server.ts`)

`buildApp()` returns a configured Fastify instance — plugins register first, then routes are mounted under `/api/<module>`. `server.ts` calls `buildApp()`, then optionally starts the Telegram bot **before** `app.listen()` so the webhook route is registered in time. On startup, it also marks any `jobs` row stuck in `processing` for >10 minutes as `failed` (recovers from previous crashes that would otherwise lose credits).

Module layout repeats for every domain (`auth`, `user`, `job`, `background`, `tryon`):
```
modules/<name>/
  routes/    — Fastify route registration, applies authGuard preHandler
  handlers/  — request handlers (the actual work)
  schemas/   — JSON-schema validators imported by routes
  services/  — domain logic, DB queries, AI calls
```
The `telegram` module is the odd one out — it's a Grammy bot, not HTTP routes (see below).

### Imports use `.js` extensions on TS files

`tsconfig.json` uses `Node16` module resolution with `"type": "module"`. Imports must use `.js` extensions even when importing from `.ts` source (e.g. `import { config } from './config/env.js'`). This is not a mistake — it's required by ESM + Node16 and applies to every file.

### AI provider routing (`src/lib/ai-client.ts` + `src/config/env.ts`)

There are three AI operations (`bg_removal`, `tryon`, `scene_gen`) and four possible providers (`fal`, `gemini`, `nano-banana`, `vertex`). Each operation independently picks a provider via env vars `AI_PROVIDER_BG_REMOVAL`, `AI_PROVIDER_TRYON`, `AI_PROVIDER_SCENE_GEN`. `env.ts` validates that the required API key for each selected provider is present, throwing on startup if missing — so adding a provider means updating both the type union and the validation block.

When adding a new operation or provider:
1. Add the operation function in `ai-client.ts` (route based on `config.aiProvider*`)
2. Use the existing `handleFalError` / `handleGeminiError` patterns so user-facing errors stay consistent
3. Errors throw with `Object.assign(new Error(msg), { statusCode })` — Fastify's sensible plugin surfaces these

Pose templates live in `src/lib/pose-templates.ts` — composable primitives (POSE + CAMERA + BACKGROUND) keyed by `GarmentCategory`. The core prompt-engineering rule: **never describe the garment in text**, always say "wearing the garment from the uploaded image". See `feedback_prompt_engineering.md` in user memory for the full rationale.

### Storage abstraction (`src/lib/storage.ts`)

Currently only local-disk storage exists, but everything goes through the `StorageProvider` interface (`save` / `getUrl` / `remove`) so swapping to S3 later is a one-file change. `relativePathFromUrl()` reverses URLs back to relative paths; `readLocalFile()` reads with path-traversal protection (resolved path must stay inside `uploadDir`). Uploaded files are served by `@fastify/static` at `/uploads/*`.

### Auth (`src/middleware/auth-guard.ts` + `@fastify/jwt`)

Routes that need auth do `app.addHook('preHandler', authGuard)` at the top of the route registration. The guard calls `request.jwtVerify()` and returns 401 on failure. JWT payload is just `{ userId: string }`. In dev, OTP is hardcoded to `123456` (logged to console) — see `src/modules/auth/`. Phone numbers are normalized 10-digit → `+91` prefix.

### Telegram bot (`src/modules/telegram/bot.ts`)

The bot starts inside `server.ts` if `TELEGRAM_BOT_TOKEN` is set, and runs in two modes:
- **`TELEGRAM_WEBHOOK_URL` set** → registers `POST /telegram/webhook` on the Fastify app, calls `bot.api.setWebhook` with a per-startup secret (UUID, validated via `x-telegram-bot-api-secret-token` header). The webhook route **must be registered before `app.listen()`** — that's why `startBot` runs before `app.listen` in `server.ts`.
- **No webhook URL** → falls back to long polling. Used on Render free tier (no public webhook ingress).

Bot has gated user access — `is_approved` column on `users`. New users hit `ADMIN_CHAT_ID = 679598242` (hardcoded admin) with approve/reject buttons. Per-chat in-memory session state lives in `session.ts` (lost on restart — that's why the stale-job cleanup runs at boot).

### Database (Knex + PostgreSQL)

`knexfile.ts` re-exports `databaseConfig` from `src/config/database.ts`. Migrations live in `migrations/` (TS source) and compile to `dist/migrations/` for production. The build step **deletes `dist/migrations/*.d.ts`** because Knex tries to execute every file in the directory and chokes on declaration files — don't remove that step from `pnpm build`. Production uses `migrate:prod` which points Knex at `dist/migrations/` and `.js` extension.

Production connection adds `ssl: { rejectUnauthorized: false }` and caps the pool at 5 (Neon free tier limit).

### Credits model

Stored as `users.free_credits_remaining` (starts at 5). Costs: bg removal 1cr, apply background 1cr, try-on free, catalog free, model upload free. **Credits are deducted only on successful completion** — handlers must do the AI work first, then decrement.

## Source of truth for API

`backend/API.md` is the API contract used by the frontend. When changing request/response shapes, update `API.md` in the same change.

## Reference

- `phases/` (one level up) contains the implementation roadmap — `catalog-enhancement-plan.md` and `deployment-plan.md` are the live ones
- Frontend (`../frontend/`) is Next.js 15 + React 19 on port 3002; it consumes the endpoints documented in `API.md`
- `render.yaml` (one level up) defines the production deploy on Render — Singapore region, free tier, long-polling bot mode
