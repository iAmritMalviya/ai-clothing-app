# Credit Security & Bot Abuse Prevention

**Status: ALL PRE-LAUNCH FIXES COMPLETE (14/14)**

## Protection Chain (in order of execution)

```
Photo received
  → Session state check (reject if generating)
  → User find-or-create (telegram_id)
  → Approval gate (is_approved check → admin notification)
  → Download image from Telegram
  → Validate with sharp (reject fake files)
  → Validate + classify with Gemini Flash (reject non-garments, detect category + gender)
  → Gender check (reject female/kids → male only for now)
  → Credit check + atomic deduction
  → Rate limit (30s cooldown)
  → Generate catalog
  → Refund only if AI failed (not delivery failure)
```

## DB Constraints
- `CHECK (free_credits_remaining >= 0 AND free_credits_remaining <= 50)`
- `is_approved BOOLEAN DEFAULT false` — invite-only

## Remaining (post-launch)
| Issue | When | What |
|-------|------|------|
| M3: Caption injection | If captions used in prompts | Sanitize user text |
| M4: Disk cleanup | After launch | Cron to clean outputs > 7 days |
