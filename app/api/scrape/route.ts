import { NextRequest, NextResponse } from "next/server";
import { scrapeCache } from "@/app/lib/scrapeCache";
import { launchBrowser } from "@/app/lib/launchBrowser";
import type { SkoolMember } from "@/app/lib/skoolMember";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type { SkoolMember } from "@/app/lib/skoolMember";

export interface ScrapeResult {
  members: SkoolMember[];
  total: number;
  totalPages: number;
  tab: string;
  fromCache: boolean;
  cachedAt?: number;
  error?: string;
}

const SKOOL_URL = "https://www.skool.com/aegisnutritionacademy/-/members";

function getTabParam(tab: string): string {
  const map: Record<string, string> = {
    active: "",
    cancelling: "?filter=cancelling",
    churned: "?filter=churned",
    banned: "?filter=banned",
  };
  return map[tab] ?? "";
}

async function extractMembersFromPage(
  page: import("playwright-core").Page,
  pageIdx: number
): Promise<SkoolMember[]> {
  return page.evaluate((pgIdx: number) => {
    const results: SkoolMember[] = [];
    const cardSelectors = [
      "[class*='MemberCard']","[class*='member-card']","[class*='memberCard']",
      "[class*='UserCard']","[class*='user-card']","[data-member]","[data-testid*='member']",
    ];
    let cards: HTMLElement[] = [];
    for (const sel of cardSelectors) {
      const found = Array.from(document.querySelectorAll<HTMLElement>(sel));
      if (found.length > 0) { cards = found; break; }
    }
    if (cards.length === 0) {
      cards = Array.from(document.querySelectorAll<HTMLElement>("li, article")).filter((el) => {
        const t = el.innerText || "";
        return t.includes("@") && (t.includes("Active") || t.includes("Joined") || t.includes("/month") || t.includes("Free"));
      });
    }
    if (cards.length === 0) {
      cards = Array.from(document.querySelectorAll<HTMLElement>("div")).filter((div) => {
        if (div.querySelectorAll("img").length > 3) return false;
        const t = div.innerText || "";
        if (t.split("\n").filter(Boolean).length > 20) return false;
        return t.match(/@[\w-]+-\d{4}/) !== null && (t.includes("Active") || t.includes("Joined") || t.includes("/month"));
      });
    }

    cards.forEach((card, idx) => {
      const rawText = card.innerText || "";
      const lines = rawText.split("\n").map((l: string) => l.trim()).filter(Boolean);

      const handleMatch = rawText.match(/@([\w-]+-\d{3,6})/);
      const handle = handleMatch ? `@${handleMatch[1]}` : "";

      const headingEl = card.querySelector("h1,h2,h3,h4,[class*='name'],[class*='Name'],strong");
      let name = headingEl?.textContent?.trim() ?? "";
      if (handle && name.includes(handle)) name = name.replace(handle, "").trim();
      if (!name) name = lines.find((l: string) => !l.startsWith("@") && !/^\d+$/.test(l) && l.length > 1) ?? "";
      if (!name || name.startsWith("@")) return;

      const avatarEl = card.querySelector<HTMLImageElement>(
        "img[class*='avatar'],img[class*='Avatar'],img[class*='photo'],img[class*='profile'],img[class*='Picture'],img[alt]"
      );
      const bioEl = card.querySelector("[class*='bio'],[class*='Bio'],[class*='tagline'],[class*='description']");
      let bio = bioEl?.textContent?.trim() ?? "";
      if (!bio && handle) {
        const hi = lines.findIndex((l: string) => l.includes(handle));
        const c = lines[hi + 1] ?? "";
        if (c && !c.match(/^(Active|Joined|Free|\$|Renew|Cancel|Lifetime)/i)) bio = c;
      }

      const tierEl = card.querySelector("[class*='premium'],[class*='Premium'],[class*='tier'],[class*='badge'],[class*='Badge']");
      const tier = tierEl?.textContent?.trim() ?? (rawText.includes("Premium") ? "Premium" : "");

      const activeMatch   = rawText.match(/Active\s+(.+?)(?:\n|$)/i);
      const joinedMatch   = rawText.match(/Joined\s+(\w+\s+\d+,\s+\d{4}|\w+\s+\d{4})/i);
      const priceMatch    = rawText.match(/(\$[\d.,]+\/(?:month|year)|Free)/i);
      const renewsMatch   = rawText.match(/(Renews\s+in\s+\d+\s+days?|Lifetime\s+access)/i);
      const cancelMatch   = rawText.match(/(Cancelled?\s*\([^)]*\))/i);
      const referralMatch = rawText.match(/Joined\s+from\s+(\w+)/i);
      const levelMatch    = rawText.match(/Level\s+(\d+)|^(\d+)$/m);
      const referralImgEl = card.querySelector<HTMLImageElement>(
        "img[alt*='Google'],img[alt*='Instagram'],img[alt*='YouTube'],img[alt*='Facebook'],img[alt*='Twitter']"
      );

      results.push({
        id: `p${pgIdx}-m${idx}`,
        name, handle, bio,
        avatar: avatarEl?.src ?? "",
        tier,
        activeAgo: activeMatch?.[1]?.trim() ?? "",
        joinedDate: joinedMatch?.[1] ?? "",
        location: "",
        price: priceMatch?.[1] ?? "",
        renewsIn: renewsMatch?.[1] ?? "",
        status: cancelMatch ? "cancelled" : "active",
        cancelledInfo: cancelMatch?.[1],
        referralSource: referralMatch?.[1] ?? (referralImgEl?.alt?.replace(/^.*from\s*/i, "") ?? ""),
        referralIcon: referralImgEl?.src ?? "",
        level: parseInt(levelMatch?.[1] ?? levelMatch?.[2] ?? "1") || 1,
      });
    });
    return results;
  }, pageIdx);
}

export async function POST(req: NextRequest) {
  const sessionCookie = req.cookies.get("skool_session");
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let storedCookies: Array<{
    name: string; value: string; domain: string; path: string;
    expires?: number; httpOnly?: boolean; secure?: boolean; sameSite?: string;
  }>;
  try {
    storedCookies = JSON.parse(sessionCookie.value);
  } catch {
    return NextResponse.json({ error: "Invalid session. Please log in again." }, { status: 401 });
  }

  let body: { tab?: string; forceRefresh?: boolean } = {};
  try { body = await req.json(); } catch { /* ok */ }
  const { tab = "active", forceRefresh = false } = body;

  // ── Serve from cache if available and not force-refreshing ───────────────
  if (!forceRefresh) {
    const cached = scrapeCache.get(tab);
    if (cached) {
      return NextResponse.json({
        members: cached.members,
        total: cached.members.length,
        totalPages: cached.totalPages,
        tab,
        fromCache: true,
        cachedAt: cached.cachedAt,
      } satisfies ScrapeResult);
    }
  }

  // ── Cache miss or force refresh — run Playwright ─────────────────────────
  const browser = await launchBrowser();
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  await context.addCookies(
    storedCookies.map((c) => ({
      name: c.name, value: c.value, domain: c.domain, path: c.path || "/",
      expires: c.expires, httpOnly: c.httpOnly, secure: c.secure,
      sameSite: (c.sameSite as "Strict" | "Lax" | "None") || "Lax",
    }))
  );

  const page = await context.newPage();

  try {
    await page.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,eot}", (route) => route.abort());

    const url = `${SKOOL_URL}${getTabParam(tab)}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(2000);

    if (page.url().includes("/login")) {
      await browser.close();
      return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
    }

    // Detect total pages
    const totalPages = await page.evaluate(() => {
      const countText = document.body.innerText.match(/(\d[\d,]*)\s+(?:members?|results?)\s*$/im)
        ?? document.body.innerText.match(/\d+[-–]\d+\s+of\s+([\d,]+)/i);
      if (countText) {
        const total = parseInt(countText[1].replace(/,/g, ""));
        return Math.ceil(total / 30);
      }
      const pageButtons = Array.from(document.querySelectorAll("button, a"))
        .map((el) => parseInt(el.textContent?.trim() ?? ""))
        .filter((n) => !isNaN(n) && n > 0);
      return pageButtons.length > 0 ? Math.max(...pageButtons) : 1;
    });

    const allMembers: SkoolMember[] = [];
    const seen = new Set<string>();

    const addMembers = (batch: SkoolMember[]) => {
      for (const m of batch) {
        if (!m.name) continue;
        const key = m.handle || m.name.toLowerCase().replace(/\s+/g, "-");
        if (seen.has(key)) continue;
        seen.add(key);
        allMembers.push(m);
      }
    };

    // Page 1
    for (let s = 0; s < 6; s++) {
      await page.evaluate(() => window.scrollBy(0, 1400));
      await page.waitForTimeout(300);
    }
    addMembers(await extractMembersFromPage(page, 0));

    // Pages 2…N
    for (let pg = 2; pg <= totalPages; pg++) {
      const clicked = await page.evaluate((targetPage: number) => {
        const allBtns = Array.from(document.querySelectorAll<HTMLElement>("button, a[role='button'], li"));
        const pageBtn = allBtns.find((el) => el.textContent?.trim() === String(targetPage));
        if (pageBtn) { pageBtn.click(); return true; }
        const nextBtn = allBtns.find((el) =>
          /next/i.test(el.textContent ?? "") || el.getAttribute("aria-label") === "Next"
        );
        if (nextBtn) { nextBtn.click(); return true; }
        return false;
      }, pg);

      if (!clicked) break;

      await page.waitForTimeout(2000);
      await page.waitForLoadState("networkidle").catch(() => {});

      for (let s = 0; s < 4; s++) {
        await page.evaluate(() => window.scrollBy(0, 1400));
        await page.waitForTimeout(250);
      }
      await page.evaluate(() => window.scrollTo(0, 0));

      addMembers(await extractMembersFromPage(page, pg - 1));
    }

    await browser.close();

    // ── Store in cache ─────────────────────────────────────────────────────
    scrapeCache.set(tab, allMembers, totalPages);

    return NextResponse.json({
      members: allMembers,
      total: allMembers.length,
      totalPages,
      tab,
      fromCache: false,
      cachedAt: Date.now(),
    } satisfies ScrapeResult);

  } catch (err) {
    await browser.close();
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
