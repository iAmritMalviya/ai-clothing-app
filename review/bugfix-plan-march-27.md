# Bug Fix Plan — March 27, 2026

## Real Bugs to Fix (filtered from 3-agent audit)

### P1: Critical (breaks production)

| # | Bug | File | Fix |
|---|-----|------|-----|
| 1 | Render uploads on ephemeral disk — images lost on restart | render.yaml, storage | Log warning; images served via Telegram not local URLs |
| 2 | getMimeType crashes for extensionless files | storage.ts:68 | Handle `lastIndexOf('.') === -1` |
| 3 | Admin approve/reject — no try-catch on DB update | bot.ts:211 | Wrap in try-catch with error response |
| 4 | User service — unhandled undefined on upsert failure | telegram-user-service.ts:27 | Add null check after destructuring |

### P2: High (causes bad UX)

| # | Bug | File | Fix |
|---|-----|------|-----|
| 5 | Progress counter includes failures — misleading "2/4" | tryon-service.ts:279 | Pass only completedCount, not completed+failed |
| 6 | downscaleForAI converts everything to PNG unnecessarily | tryon-service.ts:24-31 | Preserve original format |
| 7 | render.yaml PUBLIC_URL comment says wrong domain | render.yaml:30 | Fix comment to match actual domain |

### P3: Low (good to fix)

| # | Bug | File | Fix |
|---|-----|------|-----|
| 8 | Vertex AI lazy init race (non-critical) | ai-client.ts:22-31 | Init at module load |
| 9 | Gemini 403 returns HTTP 503 (wrong semantics) | ai-client.ts:53 | Change to 403 |
