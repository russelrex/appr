import { NextRequest, NextResponse } from "next/server";
import { scrapeCache } from "@/app/lib/scrapeCache";
import { launchBrowser } from "@/app/lib/launchBrowser";
import type { SkoolMember } from "@/app/lib/skoolMember";

export const maxDuration = 300;
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
  pgIdx: number
): Promise<SkoolMember[]> {
  return page.evaluate((pageIdx: number) => {
    const results: SkoolMember[] = [];
    const selectors = [
      "[class*='MemberCard']",
      "[class*='member-card']",
      "[class*='memberCard']",
      "[class*='UserCard']",
      "[class*='user-card']",
      "[data-member]",
    ];
    let cards: HTMLElement[] = [];
    for (const sel of selectors) {
      const found = Array.from(document.querySelectorAll<HTMLElement>(sel));
      if (found.length > 0) {
        cards = found;
        break;
      }
    }
    if (!cards.length) {
      cards = Array.from(document.querySelectorAll<HTMLElement>("li, article")).filter((el) => {
        const t = el.innerText || "";
        return (
          t.includes("@") &&
          (t.includes("Active") || t.includes("Joined") || t.includes("Free") || t.includes("/month"))
        );
      });
    }
    if (!cards.length) {
      cards = Array.from(document.querySelectorAll<HTMLElement>("div")).filter((div) => {
        if (div.querySelectorAll("img").length > 3) return false;
        const t = div.innerText || "";
        if (t.split("\n").filter(Boolean).length > 20) return false;
        return (
          t.match(/@[\w-]+-\d{4}/) !== null &&
          (t.includes("Active") || t.includes("Joined") || t.includes("/month"))
        );
      });
    }
    cards.forEach((card, idx) => {
      const raw = card.innerText || "";
      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      const hm = raw.match(/@([\w-]+-\d{3,6})/);
      const handle = hm ? `@${hm[1]}` : "";
      const hEl = card.querySelector("h1,h2,h3,h4,[class*='name'],[class*='Name'],strong");
      let name = hEl?.textContent?.trim() ?? "";
      if (handle && name.includes(handle)) name = name.replace(handle, "").trim();
      if (!name) name = lines.find((l) => !l.startsWith("@") && !/^\d+$/.test(l) && l.length > 1) ?? "";
      if (!name || name.startsWith("@")) return;
      const avEl = card.querySelector<HTMLImageElement>(
        "img[class*='avatar'],img[class*='Avatar'],img[class*='photo'],img[class*='profile'],img[alt]"
      );
      const bioEl = card.querySelector("[class*='bio'],[class*='Bio'],[class*='tagline'],[class*='description']");
      let bio = bioEl?.textContent?.trim() ?? "";
      if (!bio && handle) {
        const hi = lines.findIndex((l) => l.includes(handle));
        const c = lines[hi + 1] ?? "";
        if (c && !c.match(/^(Active|Joined|Free|\$|Renew|Cancel|Lifetime)/i)) bio = c;
      }
      const tierEl = card.querySelector("[class*='premium'],[class*='Premium'],[class*='badge'],[class*='Badge']");
      const tier = tierEl?.textContent?.trim() ?? (raw.includes("Premium") ? "Premium" : "");
      const am = raw.match(/Active\s+(.+?)(?:\n|$)/i);
      const jm = raw.match(/Joined\s+(\w+\s+\d+,\s+\d{4}|\w+\s+\d{4})/i);
      const pm = raw.match(/(\$[\d.,]+\/(?:month|year)|Free)/i);
      const rm = raw.match(/(Renews\s+in\s+\d+\s+days?|Lifetime\s+access)/i);
      const cm = raw.match(/(Cancelled?\s*\([^)]*\))/i);
      const refm = raw.match(/Joined\s+from\s+(\w+)/i);
      const lm = raw.match(/Level\s+(\d+)|^(\d+)$/m);
      const refImg = card.querySelector<HTMLImageElement>(
        "img[alt*='Google'],img[alt*='Instagram'],img[alt*='YouTube'],img[alt*='Facebook'],img[alt*='Twitter']"
      );
      results.push({
        id: `p${pageIdx}-m${idx}`,
        name,
        handle,
        bio,
        avatar: avEl?.src ?? "",
        tier,
        activeAgo: am?.[1]?.trim() ?? "",
        joinedDate: jm?.[1] ?? "",
        location: "",
        price: pm?.[1] ?? "",
        renewsIn: rm?.[1] ?? "",
        status: cm ? "cancelled" : "active",
        cancelledInfo: cm?.[1],
        referralSource: refm?.[1] ?? (refImg?.alt?.replace(/^.*from\s*/i, "") ?? ""),
        referralIcon: refImg?.src ?? "",
        level: parseInt(lm?.[1] ?? lm?.[2] ?? "1", 10) || 1,
      });
    });
    return results;
  }, pgIdx);
}

export async function POST(req: NextRequest) {
  const sessionCookie = req.cookies.get("skool_session");
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let storedCookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
  }>;
  try {
    storedCookies = JSON.parse(sessionCookie.value);
  } catch {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  let body: { tab?: string; forceRefresh?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body */
  }
  const { tab = "active", forceRefresh = false } = body;

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

  let browser;
  try {
    browser = await launchBrowser();
  } catch (err) {
    console.error("Browser launch error:", err);
    return NextResponse.json(
      { error: `Browser failed to start: ${String(err)}` },
      { status: 500 }
    );
  }

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  await context.addCookies(
    storedCookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || "/",
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: (c.sameSite as "Strict" | "Lax" | "None") || "Lax",
    }))
  );

  const page = await context.newPage();

  await page.route("**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2,ttf,eot}", (route) => route.abort());

  try {
    await page.goto(`${SKOOL_URL}${getTabParam(tab)}`, {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });
    await page.waitForTimeout(2000);

    if (page.url().includes("/login")) {
      await browser.close();
      return NextResponse.json({ error: "Session expired." }, { status: 401 });
    }

    const totalPages = await page.evaluate(() => {
      const t = document.body.innerText.match(/\d+[-–]\d+\s+of\s+([\d,]+)/i);
      if (t) return Math.ceil(parseInt(t[1].replace(/,/g, ""), 10) / 30);
      const nums = Array.from(document.querySelectorAll("button, a"))
        .map((el) => parseInt(el.textContent?.trim() ?? "", 10))
        .filter((n) => !Number.isNaN(n) && n > 0);
      return nums.length ? Math.max(...nums) : 1;
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

    for (let s = 0; s < 5; s++) {
      await page.evaluate(() => window.scrollBy(0, 1400));
      await page.waitForTimeout(300);
    }
    addMembers(await extractMembersFromPage(page, 0));

    for (let pg = 2; pg <= totalPages; pg++) {
      const clicked = await page.evaluate((tp: number) => {
        const btns = Array.from(document.querySelectorAll<HTMLElement>("button, a[role='button'], li"));
        const b = btns.find((el) => el.textContent?.trim() === String(tp));
        if (b) {
          b.click();
          return true;
        }
        const nb = btns.find(
          (el) => /next/i.test(el.textContent ?? "") || el.getAttribute("aria-label") === "Next"
        );
        if (nb) {
          nb.click();
          return true;
        }
        return false;
      }, pg);

      if (!clicked) break;

      await page.waitForTimeout(1800);
      await page.waitForLoadState("domcontentloaded").catch(() => {});

      for (let s = 0; s < 4; s++) {
        await page.evaluate(() => window.scrollBy(0, 1400));
        await page.waitForTimeout(250);
      }
      addMembers(await extractMembersFromPage(page, pg - 1));
    }

    await browser.close();

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
    console.error("Scrape error:", err);
    await browser.close().catch(() => {});
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
