# Credit Security & Bot Abuse Prevention Plan

**Status: ALL PRE-LAUNCH FIXES COMPLETE**

## Fixed (12/14)

| # | Issue | Fix |
|---|-------|-----|
| V2 | Double-tap race condition | Session locked to `generating` before async handler |
| M2 | Unauthenticated webhook | `secret_token` set on webhook, header verified in route |
| V3 | Refund on delivery failure | Track AI success separately from Telegram send |
| V5 | No DB constraint on credits | `CHECK (credits >= 0 AND credits <= 10)` |
| M6 | Session memory leak | 5-min TTL + periodic cleanup every 10 min |
| V4 | Rapid photos overwrite session | Reject photos while `awaiting_category` |
| M1 | No garment image validation | Pre-validate with Gemini 2.0 Flash before spending credits |
| V1 | Multi-account abuse | 1-minute minimum account age before generation allowed |
| V6 | No rate limit | 30-second cooldown between generations |
| M5 | Bot token in URLs | Error handler logs message only, not full context |
| M7 | Stickers without content validation | Covered by M1 garment validator |
| M8 | MIME type spoofing | Validate actual image format with sharp after download |

## Remaining (2/14 — post-launch)

| # | Issue | When | What |
|---|-------|------|------|
| M3 | Caption/prompt injection | When captions are used in prompts | Sanitize user text before passing to AI |
| M4 | Disk storage exhaustion | After launch | Cron job to clean outputs older than 7 days |
