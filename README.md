# Adsterra Revenue Dashboard

A simple, fast revenue dashboard for Adsterra publishers. Built with Next.js 16, TypeScript, Tailwind CSS 4 and shadcn/ui. Deploys cleanly to Vercel from GitHub.

**Highlights**

- Total revenue / balance since a configurable floor date (default **2026-09-01**).
- Daily revenue area chart.
- Per-link (placement) earnings table — which link earned how much USD.
- Smart links list with traffic type & status.
- KPI cards: Total Balance, Impressions, Clicks, Avg CPM.
- API key lives only in server env (`ADSTERRA_API_KEY`). Never sent to the browser.
- Old data is impossible to fetch — the server-side client clamps every request's `start_date` to `ADSTERRA_MIN_DATE`.

## 1. Local development

```bash
# 1. Copy env vars and add your Adsterra API key
cp .env.example .env.local
# Edit .env.local and set ADSTERRA_API_KEY=xxxxx

# 2. Install deps + run dev
bun install
bun run dev
```

Open the preview panel (this sandbox) or visit `http://localhost:3000` locally.

## 2. Deploy to GitHub + Vercel

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Adsterra revenue dashboard"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
   - `.env.local` and `.env` are git-ignored. Only `.env.example` is committed.

2. **Import on Vercel**
   - Go to <https://vercel.com/new>
   - Pick your GitHub repo. Vercel auto-detects Next.js — no settings needed.
   - Framework preset: **Next.js**
   - Root directory: `./` (default)
   - Build command: `next build` (auto)
   - Output: leave default

3. **Add the secret env var on Vercel**
   - Vercel dashboard → your project → **Settings** → **Environment Variables**
   - Add:
     - Name: `ADSTERRA_API_KEY`
     - Value: *your Adsterra API key*
     - Environments: Production, Preview, Development (your choice)
   - Optional: `ADSTERRA_MIN_DATE` = `2026-09-01` (this is the default).

4. **Redeploy** (Vercel redeploys automatically once env vars are saved on a new commit, or hit *Redeploy*).

5. Visit your Vercel URL — dashboard loads live data immediately.

## 3. Where the data comes from

All calls hit `https://api3.adsterratools.com/publisher` with the `X-API-Key` header, server-side only.

| Endpoint | Used for |
| --- | --- |
| `GET /stats.json?start_date=2026-09-01&finish_date=today&group_by[]=date` | Daily revenue chart + KPI totals |
| `GET /stats.json?...&group_by[]=placement` | Per-link earnings table |
| `GET /placements.json` | Map placement ID → title + direct URL |
| `GET /smart-links.json` | Smart links list (URL, traffic type, status) |

The API caps date ranges at 366 days. The client (`src/lib/adsterra.ts`) automatically splits longer ranges into 366-day chunks so the dashboard keeps working even after Sept 2027.

## 4. Refreshing data

The `/api/dashboard` route is cached for 5 minutes on Vercel's edge. Click **Refresh** in the header to bypass cache and re-fetch live.

## 5. Project structure

```
src/
├── app/
│   ├── api/
│   │   └── dashboard/route.ts   # Aggregates all Adsterra data, returns JSON
│   ├── layout.tsx               # Root layout + metadata
│   ├── page.tsx                 # Dashboard UI (client component)
│   └── globals.css              # Tailwind theme tokens
├── lib/
│   └── adsterra.ts              # Server-only Adsterra API client
└── components/ui/               # shadcn/ui primitives (preinstalled)
```

## 6. Troubleshooting

- **"ADSTERRA_API_KEY environment variable is not set"** — Add the env var in Vercel project settings and redeploy.
- **Empty dashboard (no rows)** — Your account has no stats since 2026-09-01 yet. Once Adsterra records new traffic, it'll appear.
- **HTTP 422 "Date range cannot exceed 366 days"** — Should never happen; the client auto-splits ranges. If it does, file an issue.
