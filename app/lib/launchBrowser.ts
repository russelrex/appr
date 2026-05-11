/**
 * Vercel: @sparticuz/chromium + playwright-core (setHeadlessMode / setGraphicsMode).
 * Local: full `playwright` with bundled Chromium.
 */
export async function launchBrowser() {
  const isServerless =
    !!process.env.VERCEL || !!process.env.AWS_LAMBDA_JS_RUNTIME;

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const { chromium: playwrightCore } = await import("playwright-core");

    const sparticuz = chromium as typeof chromium & {
      setHeadlessMode?: boolean;
      setGraphicsMode?: boolean;
    };
    sparticuz.setHeadlessMode = true;
    sparticuz.setGraphicsMode = false;

    const executablePath = await chromium.executablePath();
    process.env.LD_LIBRARY_PATH = [
      process.env.LD_LIBRARY_PATH,
      executablePath.split("/").slice(0, -1).join("/"),
    ]
      .filter(Boolean)
      .join(":");

    return playwrightCore.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
  }

  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true });
}
