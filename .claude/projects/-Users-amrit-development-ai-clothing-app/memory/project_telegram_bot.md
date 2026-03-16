---
name: Telegram Bot (ModelWalaBot) Status
description: Telegram bot for catalog generation — current state, decisions, and next release items
type: project
---

ModelWalaBot Telegram bot implemented and working end-to-end (blocked only by Gemini spending cap during testing).

**Architecture**: Grammy bot running alongside Fastify, webhook mode via ngrok (long polling fallback). Separate Knex connection. In-memory session Map for conversation state.

**Current flow (2-step)**: Send photo → pick category → generates 4 catalog images with AI background.

**Deferred to next release**:
- Solid-color background swap (bg removal + composite) — white/grey/beige backgrounds look odd, needs quality improvement before shipping.
- **Why:** The bg removal + composite pipeline produces unnatural results on Gemini try-on outputs. Needs post-processing tuning.
- **How to apply:** Background selection keyboard and composite logic were removed from bot.ts and catalog-handler.ts. The code for `compositeOnColor` and `removeBackground` still exists in the codebase — just not wired into the bot flow.

**Key files**: `backend/src/modules/telegram/` (bot.ts, session.ts, services/, handlers/)
