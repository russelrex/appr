#!/bin/bash
# From project root: bash fix-vercel.sh

set -euo pipefail

echo "▶ Ensuring serverless browser packages…"
pnpm add playwright-core @sparticuz/chromium

echo "▶ Local dev: full Playwright (Chromium) as devDependency…"
pnpm add -D playwright

echo ""
echo "✅ Packages OK. Manual steps:"
echo ""
echo "1. next.config.ts and vercel.json should already be in the repo root (app/api/… paths)."
echo ""
echo "2. Vercel → Settings → Environment variables (e.g.):"
echo "   AWS_LAMBDA_JS_RUNTIME = nodejs22.x"
echo "   LD_LIBRARY_PATH = /var/task/node_modules/@sparticuz/chromium/bin"
echo ""
echo "3. Deploy: git add . && git commit -m 'fix: vercel chromium' && git push"
