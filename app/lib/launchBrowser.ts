/**
 * Serverless: `require` + scan `node_modules` for `@sparticuz/chromium/bin` (pnpm + hoisted).
 * Local: `import("playwright")` with bundled Chromium.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

function resolveSparticuzBinDir(): string | undefined {
  const cwd = process.cwd();
  const hoisted = path.join(cwd, "node_modules/@sparticuz/chromium/bin");
  if (fs.existsSync(hoisted)) return hoisted;

  const pnpmStore = path.join(cwd, "node_modules/.pnpm");
  if (fs.existsSync(pnpmStore)) {
    const entries = fs.readdirSync(pnpmStore) as string[];
    const match = entries.find((e) => e.startsWith("@sparticuz+chromium@"));
    if (match) {
      const candidate = path.join(pnpmStore, match, "node_modules/@sparticuz/chromium/bin");
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

export async function launchBrowser() {
  const isServerless =
    !!process.env.VERCEL || !!process.env.AWS_LAMBDA_JS_RUNTIME;

  if (isServerless) {
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Chromium = require("@sparticuz/chromium") as {
      args: string[];
      executablePath: (input?: string) => Promise<string>;
      set setGraphicsMode(value: boolean);
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { chromium: playwrightCore } = require("playwright-core") as typeof import("playwright-core");

    Chromium.setGraphicsMode = false;

    const binDir = resolveSparticuzBinDir();
    console.log("[chromium] binDir:", binDir ?? "not found, using default");
    const executablePath = binDir
      ? await Chromium.executablePath(binDir)
      : await Chromium.executablePath();
    console.log("[chromium] executablePath:", executablePath);

    return playwrightCore.launch({
      args: Chromium.args,
      executablePath,
      headless: true,
    });
  }

  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true });
}
