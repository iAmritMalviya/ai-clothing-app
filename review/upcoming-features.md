# Upcoming Features

## Next Update

### 1. Auto-detect garment category
- Extend the garment validator to classify: TOPS / BOTTOMS / ONE-PIECES
- Single Gemini Flash call (~₹0.002) — already validating, just change the prompt
- Skip category keyboard when user picks "Auto" — faster flow, fewer taps
- Falls back to manual selection if detection is uncertain

### 2. Soft background presets
- Add curated soft backgrounds to catalog output (instead of raw AI background)
- Options: auto-pick or user selects from preset list
- Possible presets:
  - Studio White (clean e-commerce)
  - Soft Grey Gradient
  - Warm Beige / Cream
  - Light Pink (for women's wear)
  - Pastel Blue
  - Minimal Marble
  - Wooden Texture
- Implementation: after Gemini generates the model image → remove bg → composite on preset background
- Telegram bot: add background keyboard after category selection, or auto-apply "Studio White"
- Reuses existing `removeBackground()` + `compositeOnColor()` / `compositeOnImage()`

### 3. Background swap quality improvement
- Current bg removal + composite looks unnatural (deferred from initial bot launch)
- Needs edge refinement and color matching post-processing
- Consider using Gemini for inpainting instead of hard composite

---

## Post-Launch Backlog

| Feature | Priority | Notes |
|---------|----------|-------|
| M3: Caption/prompt injection sanitization | Low | Only needed if captions are used in prompts |
| M4: Disk cleanup cron job | Medium | Clean outputs older than 7 days |
| Telegram Payments (Razorpay) | High | After 20+ active users ask to pay |
| Hindi bot messages | High | Bilingual responses for target market |
| 4 images per catalog | Medium | Switch back when charging ₹99/catalog |
| Switch to Gemini 3.1 Flash for production | High | Better quality at launch |
| WhatsApp Business integration | Medium | For users without Telegram |
| Retry failed generations | Low | /retry command to re-run last failed job |
