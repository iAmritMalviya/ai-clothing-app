# ModelWala — AI Fashion Catalog Generator

Turn a single garment photo into a full catalog of on-model fashion images. Upload a piece of clothing, pick a category, and the AI generates studio-quality product shots of models wearing it — plus background removal and background/scene swapping. The same backend powers a **REST API** (consumed by a Next.js web app) and a **Telegram bot** (`ModelWalaBot`) over one shared job pipeline.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
  - [1. Backend](#1-backend)
  - [2. Frontend](#2-frontend)
  - [3. Telegram bot (optional)](#3-telegram-bot-optional)
- [Environment variables](#environment-variables)
- [AI provider system](#ai-provider-system)
- [API overview](#api-overview)
- [Database](#database)
- [Credits model](#credits-model)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Notes & conventions](#notes--conventions)

---

## Features

- **AI try-on catalog** — upload one garment, generate it worn by multiple model presets in parallel, each with a category-aware pose. Results are grouped under a shared `batch_id`.
- **Background removal** — turn any product photo into a clean transparent PNG.
- **Background / scene swapping** — composite the cutout onto solid colors or AI-generated scenes.
- **Two front-ends, one pipeline** — a Next.js web client and a Telegram bot both drive the same backend jobs.
- **Pluggable AI providers** — each operation (bg removal / try-on / scene gen) independently routes to fal.ai, Google Gemini, nano-banana, or Vertex AI via env vars.
- **OTP auth + credits** — phone-based login with a JWT session and a free-credit model.

---

## Architecture

A **two-app monorepo with no root tooling** — there is no root `package.json` or workspace. Each app is independent; `cd` into it to work.

```
ai-clothing-app/
├── backend/      Fastify API + Telegram bot (port 3001)   — see backend/CLAUDE.md
├── frontend/     Next.js web client (port 3002)
├── phases/       Implementation roadmap & plans
├── review/       Audits, bug/feature plans
├── docs/         Business / monetization strategy
└── render.yaml   Production deploy config (Render)
```

```
                 ┌──────────────┐        ┌──────────────────┐
   Web user ───▶ │ Next.js (3002)│──REST─▶│                  │
                 └──────────────┘        │  Fastify backend  │──▶ PostgreSQL
                 ┌──────────────┐ webhook│      (3001)       │──▶ AI providers
 Telegram user ─▶│ ModelWalaBot │───────▶│                  │──▶ local /uploads
                 └──────────────┘ /poll  └──────────────────┘
```

- The **backend** composes a Fastify app (`src/app.ts`) and mounts each domain under `/api/<module>` (`auth`, `user`, `job`, `background`, `tryon`). The Telegram bot is a Grammy bot started inside `src/server.ts`. **`backend/API.md` is the source of truth for the API contract** — keep it in sync with any shape change.
- The **frontend** talks to the backend exclusively through `apiFetch` (`src/lib/api-client.ts`); domain wrappers live in `src/lib/*-api.ts`. Auth is a JWT in `localStorage`; a `401` anywhere clears it and redirects to `/login`. Pages under `src/app/(protected)/` are gated by `<RequireAuth>`.

For backend internals (module layout, the ESM `.js`-import rule, migrations, provider routing, the bot's webhook/polling modes) read **`backend/CLAUDE.md`**.

---

## Tech stack

**Backend** — Node.js `>=22`, TypeScript (ESM, Node16 resolution), Fastify v5, Knex + PostgreSQL, `sharp` (image compositing), Grammy (Telegram), `@fastify/jwt` + `@fastify/multipart` + `@fastify/static`. Package manager: **pnpm**.

**Frontend** — Next.js 15 (App Router, Turbopack), React 19, Tailwind CSS 4, shadcn/ui + Radix, `sonner` (toasts), `next-themes`. Package manager: **pnpm**.

**AI** — fal.ai (`@fal-ai/client`), Google Gemini (`@google/genai`), nano-banana (via fal), Vertex AI (`google-auth-library`).

---

## Prerequisites

- **Node.js ≥ 22** and **pnpm** (`npm install -g pnpm`)
- **PostgreSQL** running locally (or a connection string to a hosted instance, e.g. Neon)
- At least one **AI provider key** — a **fal.ai** key and/or a **Google Gemini** key, depending on which providers you enable
- *(optional)* A **Telegram bot token** from [@BotFather](https://t.me/BotFather) to run the bot

---

## Getting started

### 1. Backend

```bash
cd backend
pnpm install

# Configure environment
cp .env.example .env
# then edit .env — set DATABASE_URL, JWT_SECRET, and at least one AI key

# Create the database (defaults assume a local DB named clothing_app)
createdb clothing_app

# Run migrations — this also seeds background & model presets
pnpm migrate

# Start the dev server (hot reload via tsx) on http://localhost:3001
pnpm dev
```

Verify it's up:

```bash
curl http://localhost:3001/health
```

Other backend commands:

| Command | What it does |
|---|---|
| `pnpm build` | `tsc → dist/`, then strips `dist/migrations/*.d.ts` (Knex chokes on them) |
| `pnpm start` | Run the compiled server (`dist/src/server.js`) |
| `pnpm migrate:rollback` | Roll back the last migration batch |
| `pnpm migrate:make <name>` | Generate a new migration file |
| `pnpm migrate:prod` | Run **compiled** migrations (production entrypoint) |

> There is **no test runner and no lint script** in the backend — the `tests/` folders are empty.

### 2. Frontend

```bash
cd frontend
pnpm install

# Point the client at your backend
cp .env.example .env.local
# .env.local → NEXT_PUBLIC_API_BASE_URL=http://localhost:3001  (default)

# Start the dev server on http://localhost:3002
pnpm dev
```

Other frontend commands: `pnpm build`, `pnpm start`, `pnpm lint`.

**Logging in (dev):** the app uses phone-OTP auth. In development the OTP is hardcoded to **`123456`** (also logged to the backend console). First login auto-creates the user with **5 free credits**. Phone numbers are normalized from 10 digits to a `+91` prefix.

### 3. Telegram bot (optional)

The bot starts automatically inside the backend when `TELEGRAM_BOT_TOKEN` is set. It runs in one of two modes:

- **Long polling** (default) — set only `TELEGRAM_BOT_TOKEN`. Good for local dev and the Render free tier.
- **Webhook** — also set `TELEGRAM_WEBHOOK_URL` (e.g. an ngrok URL). The backend registers `POST /telegram/webhook` and validates a per-startup secret header.

New bot users are gated by an `is_approved` flag; approval requests are sent to a hardcoded admin chat. Flow: send a garment photo → pick a category → receive generated on-model images.

---

## Environment variables

Backend (`backend/.env` — see `backend/.env.example`):

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | Signs session tokens |
| `JWT_EXPIRES_IN` | | `7d` | Token lifetime |
| `PORT` / `HOST` | | `3001` / `0.0.0.0` | |
| `NODE_ENV` | | `development` | `production` adds SSL + caps the DB pool at 5 |
| `PUBLIC_URL` | | `http://localhost:3001` | Base URL used to build asset links |
| `UPLOAD_DIR` | | `./uploads` | Where generated/uploaded images are stored |
| `MAX_FILE_SIZE` | | `10485760` (10 MB) | Max upload size |
| `FAL_KEY` | ⚠️ | — | Required if any operation uses `fal` or `nano-banana` |
| `GEMINI_API_KEY` | ⚠️ | — | Required if any operation uses `gemini` |
| `GOOGLE_CLOUD_PROJECT` / `GOOGLE_APPLICATION_CREDENTIALS` | ⚠️ | — | Required only if using `vertex` |
| `AI_PROVIDER_BG_REMOVAL` | | `fal` | `fal` \| `gemini` \| `nano-banana` \| `vertex` |
| `AI_PROVIDER_TRYON` | | `fal` | same options |
| `AI_PROVIDER_SCENE_GEN` | | `gemini` | same options |
| `TELEGRAM_BOT_TOKEN` | | — | Enables the bot when set |
| `TELEGRAM_WEBHOOK_URL` | | — | Switches the bot from polling to webhook mode |

> The backend **validates on startup** that the API key for every selected provider is present, and throws otherwise. `⚠️` keys are conditionally required based on which providers you enable.

Frontend (`frontend/.env.local`):

| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3001` | Backend base URL |

> **Never edit `.env` files via tooling** — they're gitignored and a repo hook blocks edits to them. Change `.env.example` and copy values manually.

---

## AI provider system

There are three AI **operations** and four possible **providers**. Each operation independently selects its provider via env var, so you can mix and match (e.g. cheap bg removal on fal, high-quality try-on on Gemini):

| Operation | Env var | Providers |
|---|---|---|
| Background removal | `AI_PROVIDER_BG_REMOVAL` | `fal` (BiRefNet v2), `gemini`, `nano-banana`, `vertex` |
| Virtual try-on | `AI_PROVIDER_TRYON` | `fal` (FASHN v1.6), `gemini`, `nano-banana`, `vertex` |
| Scene generation | `AI_PROVIDER_SCENE_GEN` | `fal` (flux/schnell), `gemini`, `nano-banana`, `vertex` |

Routing lives in `backend/src/lib/ai-client.ts`; pose/prompt templates in `backend/src/lib/pose-templates.ts`. Core prompt rule: **never describe the garment in text** — always reference "the garment from the uploaded image".

---

## API overview

Base URL `http://localhost:3001`. All `/api/*` routes except auth require `Authorization: Bearer <token>`. Full request/response shapes are in **`backend/API.md`**.

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/health` | — | Liveness check |
| `POST` | `/api/auth/send-otp` | — | Request an OTP (dev: `123456`) |
| `POST` | `/api/auth/verify-otp` | — | Returns a JWT |
| `GET` / `PATCH` | `/api/user/me` | ✅ | Read / update profile |
| `POST` | `/api/jobs/remove-bg` | ✅ | Background removal (**1 credit**) |
| `GET` | `/api/jobs/:id`, `/api/jobs` | ✅ | Job status / list |
| `GET` | `/api/backgrounds/presets` | ✅ | Built-in backgrounds |
| `POST` / `GET` / `DELETE` | `/api/backgrounds/upload`, `/mine`, `/mine/:id` | ✅ | Manage custom backgrounds |
| `POST` | `/api/backgrounds/apply` | ✅ | Composite onto a background (**1 credit**) |
| `GET` / `POST` / `DELETE` | `/api/tryon/models`, `/models/upload`, `/models/mine`, `/models/mine/:id` | ✅ | Manage model presets |
| `POST` | `/api/tryon/catalog` | ✅ | Generate a catalog batch (**free**) |
| `GET` | `/api/tryon/batch/:batchId` | ✅ | Fetch all jobs in a batch |
| `POST` | `/api/tryon/generate` | ✅ | Single try-on (**free**) |

Generated and uploaded files are served statically at `/uploads/*`.

---

## Database

PostgreSQL via Knex. Migrations live in `backend/migrations/` (TypeScript) and run with `pnpm migrate`. Some migrations also **seed reference data** (background presets and model presets), so a fresh `pnpm migrate` gives you a working set of presets out of the box.

Core tables: `users`, `jobs`, `background_presets`, `user_backgrounds`, `model_presets`, `user_models`. The `jobs` table tracks the full pipeline (`transparent_image_url`, `model_image_url`, `background_type/value`, `batch_id`, status). On startup the server marks any job stuck in `processing` for >10 minutes as `failed` to recover from prior crashes.

> In production, the connection adds `ssl: { rejectUnauthorized: false }` and caps the pool at 5 (Neon free-tier limit).

---

## Credits model

Each new user starts with **5 free credits**, stored on `users.free_credits_remaining`.

| Operation | Cost |
|---|---|
| Background removal | 1 credit |
| Apply background | 1 credit |
| Try-on / catalog / model upload | Free |

Credits are **deducted only on successful completion** — the AI work runs first, then the balance is decremented, so failures never silently burn credits.

---

## Project structure

```
backend/
├── src/
│   ├── app.ts            # Fastify app composition (plugins → routes)
│   ├── server.ts         # Entry: starts bot (if configured) then listens
│   ├── config/           # env, database, migration runner
│   ├── lib/              # ai-client, pose-templates, storage, image utils
│   ├── middleware/       # auth-guard (JWT preHandler)
│   ├── modules/          # auth, user, job, background, tryon, telegram
│   │   └── <name>/{routes,handlers,schemas,services}
│   └── plugins/          # Fastify plugins
├── migrations/           # Knex migrations (+ seed inserts)
├── scripts/              # one-off model-generation / test scripts
├── uploads/              # generated assets (gitignored)
├── API.md                # API contract (source of truth)
└── CLAUDE.md             # backend deep-dive

frontend/
└── src/
    ├── app/              # App Router; (protected) routes gated by RequireAuth
    ├── components/       # auth, backgrounds, jobs, tryon, upload, ui, shared
    ├── lib/              # api-client + domain api wrappers, auth, constants
    ├── hooks/  providers/  types/  config/
```

---

## Deployment

`render.yaml` defines the production service on **Render** (Singapore region, free tier):

- Build: `npm install -g pnpm && pnpm install && pnpm build`
- Start: `pnpm migrate:prod && pnpm start`
- Health check: `/health`
- Bot runs in **long-polling** mode (no public webhook ingress on the free tier)
- `DATABASE_URL` points at a hosted PostgreSQL (Neon); `JWT_SECRET` is auto-generated; AI keys and `TELEGRAM_BOT_TOKEN` are set manually.

See `phases/deployment-plan.md` for the full deployment notes.

---

## Notes & conventions

- **Backend imports use `.js` extensions on `.ts` source files** — required by ESM + Node16 resolution, not a mistake.
- **`backend/API.md` is the contract** between frontend and backend — update it in the same change as any shape change.
- **`.env` files are off-limits to tooling** — edit `.env.example` and copy manually.
- New agents/contributors should read **`backend/CLAUDE.md`** (backend internals) and **`CLAUDE.md`** (monorepo big picture) before making changes.
