# Phase 4 — Growth: Scale & Retain

**Status**: Pending
**Timeline**: Weeks 11-14
**Goal**: Retention, virality, and scaling to 500+ users
**Depends on**: Phase 3 completed + 30 total paying users

---

## Features

- [ ] WhatsApp Business API integration (push images directly to catalog)
- [ ] Hindi UI toggle (full app localization)
- [ ] Referral system (retailer refers retailer)
- [ ] Analytics dashboard (usage stats, popular garments)
- [ ] Instagram-ready export (9:16 ratio, story templates)
- [ ] Garment history & favorites
- [ ] Re-process with different model/background without re-upload
- [ ] Basic SEO landing pages (city-wise: "AI product photography Mumbai")
- [ ] Text on image: after bg removal, user taps to add product name, price, or shop name (pre-set fonts, colors, positions — no design skills needed)

## WhatsApp Business Integration

### Flow
```
1. User connects WhatsApp Business account (via WhatsApp Cloud API)
2. After generating try-on / video, user sees "Push to WhatsApp Catalog"
3. One click → image/video sent to their WhatsApp Business catalog
4. Metadata auto-filled: product name, price (user inputs once)
```

### Technical Setup
```
WhatsApp Cloud API (Meta Business Platform)
- Requires Meta Business verification
- Free tier: 1,000 conversations/month
- Catalog API: Upload product images directly
- Template messages for sharing with customers
```

### Why This Matters
Small Indian retailers run their business on WhatsApp. Their customers browse products via WhatsApp catalog and status updates. Direct integration removes the download → upload → add details friction.

## Hindi Localization

### Scope
- All UI text (buttons, labels, navigation)
- Error messages
- Onboarding flow
- Email/SMS notifications
- Landing page

### Implementation
```
- next-intl or next-i18next for i18n
- Two locales: en (English), hi (Hindi)
- Language toggle in header/settings
- Browser language auto-detection
- Store preference in user profile
```

### Future Languages (Post Phase 4)
- Tamil, Telugu, Marathi, Gujarati, Bengali
- Add based on user geography data

## Referral System

### Mechanism
```
Referrer: Gets 10 free try-ons when referee subscribes
Referee: Gets first month at 50% off (Rs 249 for Basic)
```

### Implementation
```sql
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID REFERENCES users(id),
    referee_id UUID REFERENCES users(id),
    referral_code VARCHAR(20) UNIQUE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, converted, expired
    reward_credited BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    converted_at TIMESTAMP
);

ALTER TABLE users ADD COLUMN referral_code VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN referred_by UUID REFERENCES users(id);
```

### Sharing
- Each user gets a unique referral link: `app.com/r/SHOPNAME`
- Share via WhatsApp (pre-filled message with referral link)
- Track conversions in analytics

## Analytics Dashboard

### For Retailers (In-App)
```
- Total images processed this month
- Credits remaining (bg removal / try-on / video)
- Most processed garment types
- Processing history with re-download
```

### For Us (Admin Panel)
```
- Total users (free / basic / pro)
- Daily/weekly active users
- Images processed per day
- Revenue (MRR, churn rate)
- API costs per day
- Top referrers
- City-wise user distribution
```

### Implementation
- Retailer dashboard: built into Next.js app
- Admin panel: separate admin route with auth guard
- Metrics: aggregate queries on jobs + subscriptions tables
- Consider PostHog for product analytics (free tier: 1M events/mo)

## Instagram-Ready Exports

### Story Templates
```
- 9:16 ratio (1080x1920)
- Product image centered with branded frame
- Price tag overlay (user inputs price)
- Shop name + contact at bottom
- "Swipe up" or "DM to order" CTA
```

### Reel-Ready Video
```
- 9:16 aspect ratio
- 5-7 seconds
- Auto-add background music (royalty-free)
- Shop name watermark (subtle, corner)
```

## Database Schema (Phase 4 Additions)

```sql
-- WhatsApp Connection
CREATE TABLE whatsapp_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    waba_id VARCHAR(100), -- WhatsApp Business Account ID
    phone_number_id VARCHAR(100),
    access_token TEXT, -- encrypted
    catalog_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Product Metadata (for catalog push)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(200),
    price DECIMAL(10,2),
    category VARCHAR(50), -- shirt, jeans, kurta, saree, etc.
    garment_image_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Link jobs to products
ALTER TABLE jobs ADD COLUMN product_id UUID REFERENCES products(id);

-- User preferences
ALTER TABLE users ADD COLUMN preferred_language VARCHAR(5) DEFAULT 'en';
ALTER TABLE users ADD COLUMN whatsapp_connected BOOLEAN DEFAULT false;
```

## API Endpoints (Phase 4 Additions)

```
-- WhatsApp
POST   /api/whatsapp/connect       → Start WhatsApp Business connection
POST   /api/whatsapp/catalog/push  → Push image/video to WhatsApp catalog
GET    /api/whatsapp/status        → Connection status

-- Products
POST   /api/products               → Create product (name, price, category)
GET    /api/products               → List user's products
PUT    /api/products/:id           → Update product details
DELETE /api/products/:id           → Delete product

-- Referrals
GET    /api/referral/code          → Get user's referral code + link
GET    /api/referral/stats         → Referral conversion stats
POST   /api/referral/apply         → Apply referral code during signup

-- Analytics
GET    /api/analytics/usage        → User's usage stats
GET    /api/admin/analytics        → Admin dashboard data (protected)

-- Localization
PUT    /api/user/language          → Update preferred language
```

## SEO & Landing Pages

### City-Specific Pages
```
/ai-product-photography-mumbai
/ai-product-photography-delhi
/ai-product-photography-bangalore
/ai-product-photography-surat (textile hub)
/ai-product-photography-tirupur (garment hub)
```

### Content Strategy
- Before/after examples from real retailers (with permission)
- "How [shop name] saves Rs 5,000/month on product photography"
- Target keywords: "product photography [city]", "clothing photo editing [city]"

## Cost Estimate (Phase 4 Monthly — at 200 users)

| Item | Cost |
|---|---|
| VPS (scaled up: 8GB, 4 vCPU) | ~$40/mo |
| Cloudflare R2 (100GB) | ~$10/mo |
| PostgreSQL (managed) | ~$15/mo |
| Redis (managed) | ~$10/mo |
| FASHN API (~3,000 try-ons) | ~$225/mo |
| Kling API (~200 videos) | ~$120/mo |
| WhatsApp Cloud API | Free (under 1K conversations) |
| SMS (OTP + notifications) | ~$10/mo |
| PostHog (analytics) | Free tier |
| **Total** | **~$430/mo (~Rs 36,000)** |

### Revenue at 200 users (projected mix)

| Tier | Users | Revenue |
|---|---|---|
| Free | 120 | Rs 0 |
| Basic (Rs 499) | 60 | Rs 29,940 |
| Pro (Rs 1,499) | 20 | Rs 29,980 |
| **Total MRR** | | **Rs 59,920 (~$710)** |

**Gross margin: ~39%** — Improves significantly with self-hosted models (Phase 5+).

## Success Criteria

- 200 total users, 80 paying
- MRR > Rs 50,000
- Monthly churn < 10%
- At least 20 referral conversions
- 5+ retailers connected to WhatsApp Business
- Hindi UI used by > 30% of users

## Key Risks

| Risk | Mitigation |
|---|---|
| WhatsApp API approval takes time | Start Meta Business verification in Week 8 (during Phase 3) |
| Hindi translations feel robotic | Hire a native Hindi speaker for UX copy review |
| Referral fraud (fake accounts) | Require paid subscription before referral reward |
| SEO takes months to show results | Combine with targeted WhatsApp group marketing |

## Week-by-Week Breakdown

**Week 11**: WhatsApp Integration
- [ ] Meta Business Platform setup + verification
- [ ] WhatsApp Cloud API integration
- [ ] Catalog push functionality
- [ ] Product metadata management

**Week 12**: Hindi Localization + Referral System
- [ ] i18n setup with next-intl
- [ ] Hindi translations for all UI
- [ ] Referral code generation + tracking
- [ ] WhatsApp share for referral links

**Week 13**: Analytics + Instagram Export
- [ ] Retailer analytics dashboard
- [ ] Admin analytics panel
- [ ] Instagram story template generator
- [ ] Reel-ready video export (9:16)

**Week 14**: SEO + Launch Push
- [ ] City-specific landing pages
- [ ] Before/after case studies
- [ ] Performance optimization (Core Web Vitals)
- [ ] Marketing push: WhatsApp groups, Instagram ads, cloth market visits

---

## Beyond Phase 4 (Future Roadmap)

- **Self-hosted IDM-VTON**: Replace FASHN API, dramatically reduce costs
- **Saree/Kurta specialization**: Fine-tune try-on models for Indian ethnic wear
- **Multi-language**: Tamil, Telugu, Marathi, Gujarati
- **Shopify/WooCommerce plugin**: For retailers with online stores
- **Mobile app**: React Native for offline-first experience
- **AI product descriptions**: Auto-generate Hindi/English product descriptions
- **Marketplace**: Connect retailers with buyers (long-term vision)
