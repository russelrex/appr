/**
 * Vercel/serverless: @sparticuz/chromium + playwright-core.
 * Local: full playwright with bundled Chromium.
 */
export async function launchBrowser() {
  const isVercel = !!process.env.VERCEL || process.env.AWS_LAMBDA_JS_RUNTIME;

  if (isVercel) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const { chromium: playwrightCore } = await import("playwright-core");
    const executablePath = await chromium.executablePath();
    process.env.LD_LIBRARY_PATH = [
      process.env.LD_LIBRARY_PATH,
      executablePath.split("/").slice(0, -1).join("/"),
    ]
      .filter(Boolean)
      .join(":");

    return playwrightCore.launch({
      args: [
        ...chromium.args,
        "--disable-gpu",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--single-process",
      ],
      executablePath,
      headless: true,
    });
  }

  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true });
}
