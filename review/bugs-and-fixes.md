# Bugs & Fixes Tracker

Last updated: 2026-03-21

## All Fixed

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | CRITICAL | Credit race condition | Atomic `UPDATE WHERE credits > 0` + decrement |
| 2 | CRITICAL | Webhook URL wrong | Changed to localhost sentinel URL |
| 3 | HIGH | Missing route schemas | Added catalog + batch schemas |
| 4 | HIGH | Frontend hardcoded 4 images | Dynamic grid + skeleton |
| 5 | MEDIUM | Path traversal in storage | `resolve()` + `startsWith()` check |
| 6 | MEDIUM | Webhook no secret | `secret_token` set + header verified |
| 7 | MEDIUM | Credit refund silent failure | Try-catch with CRITICAL log |
| 8 | MEDIUM | Input validation after deduction | Moved before credit deduction |
| 9 | HIGH | Double-tap race | Session locked before async |
| 10 | HIGH | Refund on delivery failure | Track AI success separately |
| 11 | MEDIUM | Session memory leak | 5-min TTL + periodic cleanup |
| 12 | MEDIUM | No garment validation | Gemini Flash pre-validation |
| 13 | LOW | No rate limit | 30-second cooldown |
| 14 | LOW | MIME spoofing | Validate with sharp |

## Remaining (Low Priority)

| # | Issue | Notes |
|---|-------|-------|
| 1 | UUID format on all schema params | Inconsistency, not a vulnerability |
| 2 | Scene bg generation race | Worst case = duplicate AI call |
| 3 | Disk storage exhaustion (M4) | Need cron cleanup for outputs > 7 days |
| 4 | Root .gitignore doesn't protect secrets | Add `**/.env` to root gitignore |
| 5 | CORS wide open (`origin: *`) | Restrict to `localhost:3002` + production domain |
