# Vercel Deployment Fix

## The Problem

Standard `playwright` bundles a 280MB+ Chromium binary — way over Vercel's 50MB serverless function limit. The login/scrape routes silently fail on Vercel.

## The Fix: 2 packages + 2 env vars + vercel.json

---

## Step 1 — Install the right packages

```bash
pnpm add playwright-core @sparticuz/chromium

# Local dev still uses bundled Chromium from full playwright:
pnpm add -D playwright
```

Your `package.json` should include something like:

```json
{
  "dependencies": {
    "playwright-core": "…",
    "@sparticuz/chromium": "…",
    "xlsx": "…"
  },
  "devDependencies": {
    "playwright": "…"
  }
}
```

---

## Step 2 — vercel.json (project root)

`vercel.json` sets:

- `memory: 1024 MB` for the scraper (Chromium needs RAM)
- `maxDuration: 300s` for long scrapes (**Vercel Pro**; Hobby max is 60s)

Function paths in this repo use `app/api/...` (no `src/` folder).

---

## Step 3 — Environment variables (Vercel Dashboard)

**Vercel Dashboard → Your Project → Settings → Environment Variables**

| Name | Value |
|------|-------|
| `AWS_LAMBDA_JS_RUNTIME` | `nodejs22.x` |
| `LD_LIBRARY_PATH` | `/var/task/node_modules/@sparticuz/chromium/bin` |

Set these in the dashboard before deploy — not only in `.env.local`. `@sparticuz/chromium` may read `AWS_LAMBDA_JS_RUNTIME` at load time.

---

## Step 4 — next.config.ts

Mark Chromium / Playwright as server externals via `serverExternalPackages` so they are not bundled (required for native binaries). This repo does not add a custom `webpack` block so **Next.js 16’s default Turbopack** build keeps working; Vercel’s Next builder applies the same externals behavior.

---

## Step 5 — Deploy

```bash
git add .
git commit -m "fix: use sparticuz/chromium for Vercel serverless compatibility"
git push
```

---

## How it works

`app/lib/launchBrowser.ts` chooses the stack:

- **Vercel / Lambda:** `@sparticuz/chromium` + `playwright-core`
- **Local:** `playwright` with bundled Chromium

---

## Troubleshooting

**"libnspr4.so not found"** → Confirm `LD_LIBRARY_PATH` in Vercel.

**Function timeout** → Pro for 300s, or reduce pagination / scope.

**Memory** → Raise `memory` in `vercel.json` (e.g. 3008 on Pro).

**Login fails** → Vercel → Project → Logs / Functions.
