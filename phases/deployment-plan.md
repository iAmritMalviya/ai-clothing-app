# Deployment Plan — Zero-Cost Production Stack

**Created**: 2026-03-18
**Goal**: Deploy the full app (backend + frontend + DB + storage + Telegram bot) for $0/month
**Constraint**: Telegram webhook needs always-on backend (no sleep/spindown)

---

## TL;DR — The Stack

| Component | Platform | Cost | Why |
|---|---|---|---|
| **Backend (Fastify)** | Oracle Cloud A1 + Coolify | $0 | Always-on, 4 OCPU + 24 GB RAM, no sleep |
| **PostgreSQL** | Oracle Cloud A1 (self-hosted) | $0 | No expiry, no storage limits |
| **Frontend (Next.js)** | Vercel Hobby | $0 | Zero-config Next.js, 100 GB bandwidth |
| **Image Storage** | Cloudflare R2 | $0 | 10 GB free, zero egress fees |
| **Telegram Webhook** | Oracle Cloud (direct public IP) | $0 | Stable HTTPS via Let's Encrypt |
| **Domain + SSL** | Coolify auto-SSL (Let's Encrypt) | $0 | Auto-renewal |
| **Total** | | **$0/month** | |

---

## Why Every Other Free Option Fails

| Platform | Problem for Our Use Case |
|---|---|
| **Render free** | Sleeps after 15 min. PostgreSQL deleted after 30 days. Webhook will timeout on cold start. |
| **Railway** | No free tier. $5 trial expires in 30 days. Then $5/month minimum. |
| **Fly.io** | No free tier for new users (removed Oct 2024). Pay-as-you-go only. |
| **Koyeb free** | Sleeps after 1 hour. Only 1 instance. 0.1 vCPU. No persistent volumes. |
| **Heroku** | No free tier since 2022. |
| **ngrok free** | URL changes on restart. 20K req/month cap. Interstitial page. Dev-only. |

**The core problem**: Every free managed platform sleeps. Telegram sends webhook → server is asleep → 30-60s cold start → Telegram retries → bad UX. Only self-hosted gives truly always-on at $0.

---

## 1. Oracle Cloud Always Free Tier

### What You Get (Forever Free, No Expiry)

**ARM Ampere A1 Instances:**
| Resource | Limit |
|---|---|
| OCPUs | 4 total (split across instances) |
| RAM | 24 GB total |
| Boot volume | 47 GB minimum per instance |
| Monthly compute hours | 3,000 OCPU-hrs + 18,000 GB-hrs |

**Storage & Networking:**
| Resource | Limit |
|---|---|
| Block storage | 200 GB total (boot + data volumes) |
| Object storage | 20 GB |
| Load balancer | 1 flexible (10 Mbps) |
| Outbound bandwidth | 10 TB/month |

**AMD Micro Instances (bonus):**
| Resource | Limit |
|---|---|
| Instances | 2x VM.Standard.E2.1.Micro |
| CPU | 1/8 OCPU each (burstable) |
| RAM | 1 GB each |

### Our Instance Layout

```
Oracle Cloud Always Free
│
├── ARM A1 Instance (Primary)
│   ├── 2 OCPUs, 12 GB RAM
│   ├── Coolify (self-hosted PaaS)
│   ├── Fastify Backend (Node.js)
│   ├── PostgreSQL 16
│   ├── Redis (for BullMQ later)
│   └── Telegram Bot Webhook
│
└── AMD Micro Instance (Optional backup)
    ├── 1/8 OCPU, 1 GB RAM
    └── UptimeRobot alternative / monitoring
```

We only need 1 ARM A1 instance with 2 OCPUs + 12 GB RAM. That leaves 2 OCPUs + 12 GB RAM unused for future services (Redis, AI worker proxy, etc.).

### Risks & Mitigations

| Risk | Mitigation |
|---|---|
| ARM instance creation fails (capacity) | Retry script with Terraform, or try different region (Mumbai, Hyderabad) |
| Oracle reclaims idle instances (<10% CPU) | Our backend + bot + DB = real workload, won't be idle |
| Self-managed infrastructure | Coolify handles deploys, SSL, backups. Minimal ops burden. |
| Oracle account requires credit card | No charge for always-free resources. Set billing alerts at $0. |

---

## 2. Coolify — Self-Hosted PaaS

Coolify is an open-source Heroku/Vercel alternative you run on your own server. It handles:
- Git-based deployments (push to deploy)
- Auto SSL via Let's Encrypt
- Docker container management
- PostgreSQL one-click setup
- Environment variable management
- Telegram notifications for deploys
- Database backups to S3/R2

### Requirements
- 2 GB RAM minimum (we have 12 GB)
- Ubuntu 22.04/24.04 LTS
- ARM64 supported (Oracle A1 is ARM)
- Install: `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash`

### What Coolify Replaces
| Without Coolify | With Coolify |
|---|---|
| SSH + manual Docker commands | Web dashboard + git push deploy |
| Manual nginx reverse proxy | Auto-configured per service |
| Manual Let's Encrypt | Auto-provisioned + auto-renewed |
| Manual PostgreSQL setup | One-click database creation |
| No deploy previews | PR previews (optional) |

---

## 3. Vercel — Frontend (Next.js)

### Hobby Plan (Free Forever)

| Resource | Limit |
|---|---|
| Serverless function execution | 4 hrs/month |
| Invocations | 1M/month |
| Bandwidth | 100 GB/month |
| Image optimizations | 5,000/month |
| Blob storage | 1 GB |
| Deployments | Unlimited |
| Custom domains | Yes |

### Setup
```bash
# Install Vercel CLI
npm i -g vercel

# From frontend directory
cd frontend
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_API_URL  # → https://api.yourdomain.com
```

### Gotcha
**Vercel Hobby = non-commercial use only.** Fine for development and validation. When you monetize, upgrade to Pro ($20/month) or move to Cloudflare Pages (free, no commercial restriction, unlimited bandwidth).

### Cloudflare Pages (Alternative)
- Free forever, **no commercial restriction**
- Unlimited bandwidth, unlimited static requests
- Next.js SSR via OpenNext adapter (`@opennextjs/cloudflare`)
- 500 builds/month
- Slightly more setup friction than Vercel

---

## 4. Cloudflare R2 — Image Storage

### Free Tier (Always Free)

| Resource | Limit |
|---|---|
| Storage | 10 GB/month |
| Class A operations (writes) | 1M/month |
| Class B operations (reads) | 10M/month |
| Egress | **$0 always** (zero egress fees) |

### Why R2 Over Local Filesystem
| Local Filesystem | Cloudflare R2 |
|---|---|
| Lost if server dies | Persistent object storage |
| No CDN | Cloudflare CDN (free) |
| No redundancy | Built-in durability |
| Can't scale | 10 GB free, cheap beyond |
| Works only in dev | Works in production |

### Integration Plan

Replace local `uploads/` directory with R2:

```typescript
// backend/src/lib/storage-r2.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Upload: save(buffer, folder, ext) → returns public URL
// Download: readFile(key) → returns Buffer
// Delete: remove(key) → void
```

R2 is S3-compatible — use `@aws-sdk/client-s3` (already works with Node.js).

Public access: Create a custom domain or Cloudflare Worker to serve images.

---

## 5. Neon PostgreSQL — Backup Database Option

If Oracle Cloud setup is delayed, use Neon as a temporary database:

### Free Tier (Always Free)

| Resource | Limit |
|---|---|
| Storage | 0.5 GB |
| Compute | 100 CU-hours/month |
| Max compute size | 2 CU (8 GB RAM) |
| Projects | 100 |
| Branches | 10 per project |
| Connection pooling | 10,000 (pgBouncer) |

**Scale-to-zero**: Computes sleep after 5 min inactivity. First query has ~0.5-2s cold start.

**Why backup, not primary**: 0.5 GB storage is tight. Self-hosted PostgreSQL on Oracle Cloud has no storage limits. But Neon is perfect as a fallback or for branching/dev databases.

---

## 6. Domain Setup

### Option A: Free Subdomain (No Purchase Needed)
- Coolify assigns `*.yourdomain.coolify.io` subdomains
- Or use Oracle Cloud's public IP directly
- Telegram webhook works with any valid HTTPS URL

### Option B: Custom Domain (~Rs 500-800/year, not free but nice-to-have)
- Buy `drape.in` or `pehno.in` from Namecheap/Porkbun
- Point DNS to Oracle Cloud IP
- Coolify auto-provisions SSL via Let's Encrypt

### DNS Layout
```
drape.in               → Vercel (frontend)
api.drape.in           → Oracle Cloud (backend)
images.drape.in        → Cloudflare R2 (image CDN)
bot.drape.in           → Oracle Cloud (Telegram webhook, same server)
coolify.drape.in       → Coolify dashboard
```

---

## 7. Deployment Architecture

```
┌──────────────────────────────────────────────────┐
│                    Internet                        │
└──────────┬──────────────┬──────────────┬──────────┘
           │              │              │
           ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Vercel     │ │ Oracle Cloud │ │ Cloudflare   │
│   (Frontend) │ │ A1 Instance  │ │ R2 (Images)  │
│              │ │              │ │              │
│ Next.js 15   │ │ ┌──────────┐│ │ 10 GB free   │
│ React 19     │ │ │ Coolify  ││ │ Zero egress  │
│ Tailwind     │ │ │ (PaaS)   ││ │ S3-compatible│
│              │ │ └────┬─────┘│ │              │
│ Hobby (free) │ │      │      │ │ Free forever │
│ 100GB BW     │ │ ┌────┴─────┐│ │              │
│              │ │ │ Fastify  ││ │              │
│ API calls ──────│ │ Backend  ││ │              │
│              │ │ │ Port 3001││ │              │
│              │ │ └────┬─────┘│ └──────────────┘
│              │ │      │      │
│              │ │ ┌────┴─────┐│
└──────────────┘ │ │PostgreSQL││
                 │ │ Port 5432││
                 │ └────┬─────┘│
                 │      │      │
                 │ ┌────┴─────┐│
                 │ │ Telegram ││
                 │ │ Webhook  ││
                 │ │/bot/hook ││
                 │ └──────────┘│
                 │              │
                 │ 2 OCPU      │
                 │ 12 GB RAM   │
                 │ 47 GB disk  │
                 │ Always-on   │
                 │ $0/month    │
                 └──────────────┘
```

---

## 8. Step-by-Step Setup Guide

### Step 1: Create Oracle Cloud Account (Day 1)

1. Sign up at https://cloud.oracle.com (credit card required, no charge)
2. Select home region: **AP Mumbai 1** (closest to India users)
3. Set billing alert at $0 to catch any accidental charges
4. Wait for account to be fully provisioned (can take 24-48 hours)

### Step 2: Create ARM A1 Instance (Day 1-3)

```bash
# Instance config:
#   Shape: VM.Standard.A1.Flex
#   OCPUs: 2
#   RAM: 12 GB
#   Image: Ubuntu 22.04 (aarch64)
#   Boot volume: 47 GB
#   Public IP: Yes (Ephemeral)
#   SSH key: Your public key

# If capacity error, retry with script or try alternate availability domain
```

**Security list (firewall) — open these ports:**
| Port | Protocol | Purpose |
|---|---|---|
| 22 | TCP | SSH |
| 80 | TCP | HTTP (Coolify redirects to 443) |
| 443 | TCP | HTTPS (Coolify, backend, webhook) |
| 8000 | TCP | Coolify dashboard |

### Step 3: Install Coolify (Day 1)

```bash
# SSH into Oracle instance
ssh ubuntu@<public-ip>

# Install Coolify
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash

# Access Coolify dashboard
# https://<public-ip>:8000
# Create admin account on first visit
```

### Step 4: Deploy PostgreSQL via Coolify (Day 1)

1. Coolify Dashboard → Resources → New → Database → PostgreSQL 16
2. Set database name: `clothing_app`
3. Set user: `amrit`
4. Note the connection string
5. Run migrations:
   ```bash
   # From Coolify terminal or SSH
   DATABASE_URL=postgresql://amrit:password@localhost:5432/clothing_app
   npx knex migrate:latest
   npx knex seed:run
   ```

### Step 5: Deploy Backend via Coolify (Day 2)

1. Coolify → Resources → New → Application
2. Connect GitHub repo (or use deploy key)
3. Set:
   - Build command: `cd backend && pnpm install && pnpm build`
   - Start command: `cd backend && node dist/server.js`
   - Port: 3001
   - Environment variables: All from `backend/.env`
4. Set domain: `api.drape.in` (or use Coolify subdomain)
5. Coolify auto-provisions SSL via Let's Encrypt
6. Deploy

### Step 6: Set Up Cloudflare R2 (Day 2)

1. Sign up at https://dash.cloudflare.com
2. R2 → Create Bucket → name: `drape-images`
3. Create API token (R2 read/write)
4. Add to backend env:
   ```
   R2_ACCOUNT_ID=xxxx
   R2_ACCESS_KEY_ID=xxxx
   R2_SECRET_ACCESS_KEY=xxxx
   R2_BUCKET_NAME=drape-images
   R2_PUBLIC_URL=https://images.drape.in
   ```
5. Set up custom domain or Cloudflare Worker for public image access

### Step 7: Deploy Frontend to Vercel (Day 2)

```bash
cd frontend
npx vercel

# Set environment variable:
# NEXT_PUBLIC_API_URL=https://api.drape.in
```

### Step 8: Configure Telegram Webhook (Day 2)

```bash
# Set webhook URL to your Oracle Cloud backend
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://api.drape.in/bot/webhook"

# Verify
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

### Step 9: Backend Code Changes for Production (Day 2-3)

**Storage migration** (local filesystem → R2):
- [ ] Add `@aws-sdk/client-s3` to backend
- [ ] Create `storage-r2.ts` implementing same `StorageProvider` interface
- [ ] Switch storage provider based on `NODE_ENV`
- [ ] Update image URL generation to use R2 public URL

**Database connection**:
- [ ] Update `DATABASE_URL` to point to Coolify-managed PostgreSQL
- [ ] Add connection pooling config for production

**Environment variables for production**:
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://amrit:xxxx@localhost:5432/clothing_app
JWT_SECRET=<strong-random-string>
FAL_KEY=xxxx
GEMINI_API_KEY=xxxx
R2_ACCOUNT_ID=xxxx
R2_ACCESS_KEY_ID=xxxx
R2_SECRET_ACCESS_KEY=xxxx
R2_BUCKET_NAME=drape-images
R2_PUBLIC_URL=https://images.drape.in
TELEGRAM_BOT_TOKEN=xxxx
WEBHOOK_URL=https://api.drape.in/bot/webhook
```

---

## 9. Migration Checklist

### From Dev to Production

- [ ] Oracle Cloud account created + A1 instance provisioned
- [ ] Coolify installed and accessible
- [ ] PostgreSQL deployed via Coolify
- [ ] Database migrated (schema + seeds)
- [ ] Backend deployed via Coolify (git push deploy)
- [ ] Cloudflare R2 bucket created
- [ ] Storage provider switched from local to R2
- [ ] Frontend deployed on Vercel
- [ ] `NEXT_PUBLIC_API_URL` pointing to production backend
- [ ] Telegram webhook URL set to production
- [ ] SSL certificates verified (auto via Coolify)
- [ ] Health check endpoint responding
- [ ] Test full flow: Telegram photo → catalog generation → results
- [ ] OTP working (dev: hardcoded 123456, prod: switch to MSG91 later)

---

## 10. Cost Summary

### Monthly Operating Cost

| Service | Cost |
|---|---|
| Oracle Cloud (compute + storage) | $0 |
| Coolify | $0 (self-hosted, open source) |
| PostgreSQL | $0 (self-hosted on Oracle) |
| Vercel Hobby (frontend) | $0 |
| Cloudflare R2 (10 GB images) | $0 |
| Let's Encrypt SSL | $0 |
| **Subtotal: Infrastructure** | **$0/month** |
| | |
| Gemini API (try-on, 500 free/day) | $0 |
| fal.ai (bg removal, ~$0.001/image) | ~$1-5/month at scale |
| Domain (optional, .in) | ~$0.50/month (Rs 500/year) |
| **Total** | **~$0-5/month** |

### When to Upgrade (Rough Thresholds)

| Milestone | Action | Added Cost |
|---|---|---|
| 500+ users | Upgrade Vercel to Pro (or move to Cloudflare Pages free) | $0-20/mo |
| 10 GB+ images | R2 stays free until ~10 GB, then $0.015/GB | ~$0-5/mo |
| Need backups | Add Coolify backup to R2 | $0 |
| Need Redis | Add Redis on same Oracle instance via Coolify | $0 |
| Need more compute | Add second Oracle A1 instance (still within free tier) | $0 |
| 1000+ daily users | Consider managed services (Railway, Render paid) | $15-50/mo |

---

## 11. Comparison: Why Oracle + Coolify Wins

| Criteria | Oracle + Coolify | Render Free | Railway |
|---|---|---|---|
| Always-on | Yes | No (sleeps 15 min) | Yes ($5/mo) |
| PostgreSQL | Self-hosted, no expiry | 30-day expiry | Paid |
| RAM | 12 GB | 512 MB | Based on usage |
| Storage | 47+ GB disk | Ephemeral | 0.5 GB |
| Telegram webhook | Works perfectly | Cold start breaks it | Works ($5/mo) |
| Cost | $0/month | $0 (but broken for webhooks) | $5/month |
| Deploy UX | Git push via Coolify | Git push (best UX) | Git push (best UX) |
| Maintenance | Self-managed (Coolify helps) | Zero | Zero |

**The tradeoff**: You manage the server, but Coolify reduces ops to near-zero. And you get 24x the RAM and no service restrictions.

---

## 12. Fallback Plan

If Oracle Cloud ARM capacity is unavailable in Mumbai:

1. **Try Hyderabad region** (ap-hyderabad-1)
2. **Try AMD Micro instances** (2x always available, 1 GB RAM each — tight but possible)
3. **Use Render free + Neon free** as temporary stack:
   - Backend on Render (will sleep, but works for testing)
   - PostgreSQL on Neon (0.5 GB free, no expiry)
   - Use Telegram long-polling instead of webhook (no need for always-on)
   - Migrate to Oracle once instance is available

**Long-polling fallback for Telegram:**
```typescript
// No webhook needed — bot polls Telegram servers
bot.start({ polling: true });
// Works on any platform including sleeping services
// But: slightly higher latency, uses more compute
```

---

*This plan is designed for $0/month while the product is being validated. When revenue starts, migrate to managed services for less operational burden.*
