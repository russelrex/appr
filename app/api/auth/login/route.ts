import { NextRequest, NextResponse } from "next/server";
import { launchBrowser } from "@/app/lib/launchBrowser";

export const maxDuration = 30;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* invalid json */
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  let browser;
  try {
    browser = await launchBrowser();
  } catch (err) {
    console.error("[login] browser launch failed:", String(err));
    return NextResponse.json(
      { error: `Browser failed to start: ${String(err)}` },
      { status: 500 }
    );
  }

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    await page.goto("https://www.skool.com/login", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);

    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }),
      page.click('button[type="submit"]'),
    ]);

    if (page.url().includes("/login")) {
      const errEl = await page.$('[class*="error"],[class*="Error"],[role="alert"]');
      const errText = errEl ? await errEl.textContent() : null;
      await browser.close();
      return NextResponse.json(
        { error: errText?.trim() || "Invalid email or password." },
        { status: 401 }
      );
    }

    const cookies = await context.cookies();
    await browser.close();

    const sessionData = JSON.stringify(cookies);
    const res = NextResponse.json({ ok: true, redirectTo: "/members" });

    res.cookies.set("skool_session", sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
    });

    const displayEmail = email;
    const displayName = displayEmail.split("@")[0];
    res.cookies.set("skool_user", JSON.stringify({ email: displayEmail, name: displayName }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
    });

    return res;
  } catch (err) {
    console.error("[login] scrape error:", String(err));
    await browser.close().catch(() => {});
    return NextResponse.json({ error: `Login error: ${String(err)}` }, { status: 500 });
  }
}
