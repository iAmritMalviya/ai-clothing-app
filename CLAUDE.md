# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

This is a **two-app monorepo with no root tooling** — there is no root `package.json`, workspace, or task runner. Each app is an independent project with its own dependencies. To do anything, `cd` into the app first:

- **`backend/`** — Fastify v5 + Knex + PostgreSQL API and Telegram bot (pnpm, Node `>=22`, port 3001). Has its own detailed **`backend/CLAUDE.md`** — read it before touching backend code; it covers the module layout, AI provider routing, ESM `.js`-import quirk, migrations, auth, the Telegram bot, and the credits model.
- **`frontend/`** — Next.js 15 + React 19 + Tailwind 4 + shadcn/ui web client (pnpm, port 3002).

Non-code directories: `phases/` (implementation roadmap — `catalog-enhancement-plan.md` and `deployment-plan.md` are the live ones), `review/` (audits, bug/feature plans), `docs/` (business/monetization strategy). `render.yaml` defines the production deploy (Render, Singapore, free tier, long-polling bot mode).

## What this product does

Users upload a single garment photo; the backend runs AI try-on against model presets to generate a catalog of on-model fashion images (and can swap backgrounds / remove backgrounds). The same backend serves both a REST API (consumed by the Next.js frontend) and a Telegram bot (`ModelWalaBot`) as two front-ends over the same job pipeline.

## Commands

Run from inside the relevant app directory.

**Backend** (`cd backend`): `pnpm dev` (hot reload), `pnpm build`, `pnpm start`, `pnpm migrate` / `migrate:rollback` / `migrate:make <name>` / `migrate:prod`. See `backend/CLAUDE.md` for the full list and caveats.

**Frontend** (`cd frontend`): `pnpm dev` (Turbopack, port 3002), `pnpm build`, `pnpm start`, `pnpm lint` (eslint).

There is **no test runner** in either app — `tests/` folders in the backend are empty. Do not claim tests pass; there is nothing to run. The frontend has lint; the backend has neither lint nor tests.

## Frontend ↔ backend contract

**`backend/API.md` is the single source of truth for the API.** The frontend is written against it. When you change a request/response shape on either side, update `API.md` in the same change.

How the frontend talks to the backend:
- All requests go through `apiFetch` in `frontend/src/lib/api-client.ts`. Base URL comes from `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3001`); domain-specific wrappers live in `src/lib/*-api.ts` (`tryon-api.ts`, `backgrounds-api.ts`).
- Auth is a JWT stored in `localStorage` under `auth_token` (`src/lib/auth.ts`), sent as `Authorization: Bearer <token>`. The backend issues it via the OTP flow (dev OTP is hardcoded `123456`).
- A `401` response anywhere clears the token and hard-redirects to `/login` — this is centralized in `apiFetch`, so individual callers don't handle auth expiry.
- Routes under `frontend/src/app/(protected)/` are gated client-side by `<RequireAuth>` in the protected layout; `login/` is public. Errors surface as `ApiRequestError` (carries `statusCode` + `errorType`).

## Conventions

- **Never edit `.env` / `.env.*` files directly** — they are gitignored, and a repo hook (`.codex/hooks.json`) blocks edits to them. Update the corresponding `.env.example` and copy values manually. The backend validates required keys on startup and throws if a selected AI provider's key is missing.
- Backend imports use `.js` extensions on `.ts` source files (ESM + Node16 resolution) — this is required, not a mistake. See `backend/CLAUDE.md`.
