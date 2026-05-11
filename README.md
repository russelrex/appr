# Skool Member Scraper

Automated Skool member search tool built with Next.js + Playwright.

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Install Playwright browser
pnpm exec playwright install chromium

# 3. Run dev server
pnpm dev
```

Then open http://localhost:3000

## How it works

- **`/members`** — Dashboard UI (mock data shown by default)
- **`/api/scrape`** — POST endpoint that runs headless Playwright to scrape `skool.com/aegisnutritionacademy/-/members`

## Usage

1. Open the dashboard at `http://localhost:3000`
2. Click **Filter** to expand filter options
3. Enter your **Skool email + password** (sent only to your local API, never stored)
4. Set filters:
   - Name / handle search
   - Joined after / before date
   - Paid members only / Free members only
   - Referral source (Google, Instagram, YouTube, Facebook)
5. Click **Run Scraper** — live data replaces mock data

## Tabs

| Tab | Skool Filter |
|-----|-------------|
| Active | Default members list |
| Cancelling | `?filter=cancelling` |
| Churned | `?filter=churned` |
| Banned | `?filter=banned` |

## File Structure

```
app/
  page.tsx              → redirects to /members
  members/page.tsx      → main dashboard UI
  api/scrape/route.ts   → Playwright scraper API
```

## Notes

- Credentials are used only to authenticate with Skool during the scrape session
- The scraper scrolls the page to load lazy-loaded members before extracting
- All filters are applied server-side after scraping
