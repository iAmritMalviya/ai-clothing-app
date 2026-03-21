# Upcoming Features

Last updated: 2026-03-21

## Done (moved from upcoming)

- ✅ Auto-detect garment category (tops/bottoms/one-pieces)
- ✅ Gender detection (male only, female/kids rejected with message)
- ✅ Soft background presets (12 backgrounds, /setbackground command)
- ✅ Hindi/Hinglish language support (/language)
- ✅ Credit system (/credits)
- ✅ Multi-image catalog (/catalog — 1 to 4 images)
- ✅ Progress bar during generation
- ✅ Approval system (invite-only, admin approve/reject)
- ✅ Bottom wear pose system (waist-to-shoes framing)

## Next Sprint

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Bottom wear quality tuning | High | 2 hrs | Test with real jeans, iterate prompts |
| Disk cleanup cron | Medium | 1 hr | Clean outputs older than 7 days |
| Root .gitignore fix | Medium | 5 min | Add `**/.env` to root gitignore |
| CORS restriction | Medium | 10 min | Restrict origin to known domains |
| Telegram Payments (Razorpay) | High | 1 day | After 20+ users want to pay |

## Future Backlog

| Feature | Notes |
|---------|-------|
| Female model support | New model presets + prompts |
| WhatsApp Business integration | For users without Telegram |
| Face locking across catalog | Same model face for 4 images |
| Marketplace-specific sizing | Amazon/Myntra/Ajio format presets |
| Video generation | Fit & movement videos |
| Web dashboard | For heavy users who outgrow the bot |
