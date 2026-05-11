/**
 * Serverless (Vercel / Lambda-style): `require` + explicit `bin` dir so pnpm layouts resolve.
 * Local: dynamic `import("playwright")` with bundled Chromium.
 */
import { createRequire } from "node:module";
import path from "node:path";

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

    const entry = require.resolve("@sparticuz/chromium");
    const pkgDir = path.resolve(path.dirname(entry), "..", "..");
    const binDir = path.join(pkgDir, "bin");
    const execPath = await Chromium.executablePath(binDir);

    return playwrightCore.launch({
      args: Chromium.args,
      executablePath: execPath,
      headless: true,
    });
  }

  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true });
}
