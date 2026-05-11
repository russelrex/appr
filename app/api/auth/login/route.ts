import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    await page.goto("https://www.skool.com/login", {
      waitUntil: "networkidle",
      timeout: 20000,
    });

    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle", timeout: 20000 }),
      page.click('button[type="submit"]'),
    ]);

    const finalUrl = page.url();

    if (finalUrl.includes("/login")) {
      const errorText = await page
        .textContent('[class*="error"], [class*="Error"], [role="alert"]')
        .catch(() => null);
      await browser.close();
      return NextResponse.json(
        { error: errorText?.trim() || "Invalid email or password." },
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

    const displayEmail = email as string;
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
    await browser.close();
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

