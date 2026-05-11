import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface SkoolMember {
  id: string;
  name: string;
  handle: string;
  bio: string;
  avatar: string;
  tier: string;
  activeAgo: string;
  joinedDate: string;
  location: string;
  price: string;
  renewsIn: string;
  status: "active" | "cancelling" | "cancelled";
  cancelledInfo?: string;
  referralSource: string;
  referralIcon: string;
  level: number;
}

export interface ScrapeResult {
  members: SkoolMember[];
  total: number;
  tab: string;
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

  let body: {
    tab?: string; joinedAfter?: string; joinedBefore?: string;
    priceFilter?: string; referral?: string; searchName?: string;
  } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const { tab = "active", joinedAfter, joinedBefore, priceFilter, referral, searchName } = body;

  const browser = await chromium.launch({ headless: true });
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
    const url = `${SKOOL_URL}${getTabParam(tab)}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(2000);

    if (page.url().includes("/login")) {
      await browser.close();
      return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
    }

    // Scroll to load all lazy-loaded members
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 1400));
      await page.waitForTimeout(500);
    }

    const members: SkoolMember[] = await page.evaluate(() => {
      const results: SkoolMember[] = [];

      // --- Strategy 1: look for known Skool card class patterns ---
      const cardSelectors = [
        "[class*='MemberCard']",
        "[class*='member-card']",
        "[class*='memberCard']",
        "[class*='UserCard']",
        "[class*='user-card']",
        "[data-member]",
        "[data-testid*='member']",
      ];

      let cards: HTMLElement[] = [];
      for (const sel of cardSelectors) {
        const found = Array.from(document.querySelectorAll<HTMLElement>(sel));
        if (found.length > 0) { cards = found; break; }
      }

      // --- Strategy 2: Skool renders each member as a list item or article ---
      if (cards.length === 0) {
        cards = Array.from(document.querySelectorAll<HTMLElement>("li, article")).filter((el) => {
          const t = el.innerText || "";
          return t.includes("@") && (t.includes("Active") || t.includes("Joined") || t.includes("/month") || t.includes("Free"));
        });
      }

      // --- Strategy 3: structural div heuristic (last resort) ---
      if (cards.length === 0) {
        // Find the smallest divs that each contain a @handle AND "Active" or "Joined"
        const allDivs = Array.from(document.querySelectorAll<HTMLElement>("div"));
        cards = allDivs.filter((div) => {
          // Skip large containers that match many members at once
          if (div.querySelectorAll("img").length > 3) return false;
          const t = div.innerText || "";
          const lineCount = t.split("\n").filter(Boolean).length;
          if (lineCount > 20) return false; // too many lines = a list container, not a card
          return t.match(/@[\w-]+-\d{4}/) !== null && (t.includes("Active") || t.includes("Joined") || t.includes("/month"));
        });
      }

      cards.forEach((card, idx) => {
        const rawText = card.innerText || "";
        const lines = rawText.split("\n").map((l: string) => l.trim()).filter(Boolean);

        // ── Extract name and handle separately ──────────────────────────────
        // Skool always renders handle as @slug-with-numbers-1234
        const handleMatch = rawText.match(/@([\w-]+-\d{3,6})/);
        const handle = handleMatch ? `@${handleMatch[1]}` : "";

        // Name is the first bold/heading text, NOT the handle
        const headingEl = card.querySelector("h1, h2, h3, h4, [class*='name'], [class*='Name'], strong");
        let name = headingEl?.textContent?.trim() ?? "";

        // If the heading grabbed both name+handle (the bug in the screenshot),
        // strip the handle portion out of the name.
        if (handle && name.includes(handle)) {
          name = name.replace(handle, "").trim();
        }

        // If still no name, take the first line that isn't a handle
        if (!name) {
          name = lines.find((l: string) => !l.startsWith("@") && !/^\d+$/.test(l) && l.length > 1) ?? "";
        }

        if (!name || name.startsWith("@")) return; // skip if we can't find a real name

        // ── Avatar ──────────────────────────────────────────────────────────
        const avatarEl = card.querySelector<HTMLImageElement>(
          "img[class*='avatar'], img[class*='Avatar'], img[class*='photo'], img[class*='profile'], img[class*='Picture'], img[alt]"
        );

        // ── Bio: text after handle, before the metadata lines ───────────────
        const bioEl = card.querySelector("[class*='bio'], [class*='Bio'], [class*='tagline'], [class*='Tagline'], [class*='description']");
        let bio = bioEl?.textContent?.trim() ?? "";
        // Fallback: the line right after the handle line (if not a metadata line)
        if (!bio && handle) {
          const handleLineIdx = lines.findIndex((l: string) => l.includes(handle));
          const candidate = lines[handleLineIdx + 1] ?? "";
          if (candidate && !candidate.match(/^(Active|Joined|Free|\$|Renew|Cancel|Lifetime)/i)) {
            bio = candidate;
          }
        }

        // ── Tier (Premium / Free) ───────────────────────────────────────────
        const tierEl = card.querySelector("[class*='premium'], [class*='Premium'], [class*='tier'], [class*='badge'], [class*='Badge']");
        const tier = tierEl?.textContent?.trim() ?? (rawText.includes("Premium") ? "Premium" : "");

        // ── Metadata via regex on the full card text ─────────────────────────
        const activeMatch  = rawText.match(/Active\s+(.+?)(?:\n|$)/i);
        const joinedMatch  = rawText.match(/Joined\s+(\w+\s+\d+,\s+\d{4}|\w+\s+\d{4})/i);
        const priceMatch   = rawText.match(/(\$[\d.,]+\/(?:month|year)|Free)/i);
        const renewsMatch  = rawText.match(/(Renews\s+in\s+\d+\s+days?|Lifetime\s+access)/i);
        const cancelMatch  = rawText.match(/(Cancelled?\s*\([^)]*\))/i);
        const referralMatch = rawText.match(/Joined\s+from\s+(\w+)/i);
        const levelMatch   = rawText.match(/Level\s+(\d+)|^(\d+)$/m);

        const referralImgEl = card.querySelector<HTMLImageElement>(
          "img[alt*='Google'], img[alt*='Instagram'], img[alt*='YouTube'], img[alt*='Facebook'], img[alt*='Twitter']"
        );

        results.push({
          id: `member-${idx}`,
          name,
          handle,
          bio,
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
    });

    // ── De-duplicate by handle (same person scraped twice from nested DOM) ──
    const seen = new Set<string>();
    const deduped = members.filter((m) => {
      if (!m.name) return false;
      // Use handle as unique key, fall back to name if handle is missing
      const key = m.handle || m.name.toLowerCase().replace(/\s+/g, "-");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ── Apply filters ───────────────────────────────────────────────────────
    let filtered = deduped;

    if (searchName) {
      const q = searchName.toLowerCase();
      filtered = filtered.filter((m) =>
        m.name.toLowerCase().includes(q) || m.handle.toLowerCase().includes(q)
      );
    }

    // Subscription plan filter
    if (priceFilter) {
      filtered = filtered.filter((m) => {
        const raw = (m.price || "").toLowerCase().replace(/[,\s]/g, "");
        switch (priceFilter) {
          case "free":
            // "Free" or no price
            return raw === "free" || raw === "";
          case "35":
            // $35/month
            return raw.includes("35");
          case "129":
            // $129/month
            return raw.includes("129");
          case "annual":
            // /year subscription OR any price >= $300
            if (raw.includes("/year") || raw.includes("year")) return true;
            // Extract numeric value and check >= 300
            const numMatch = raw.match(/[\d.]+/);
            if (numMatch) return parseFloat(numMatch[0]) >= 300;
            return false;
          default:
            return true;
        }
      });
    }

    if (referral)  filtered = filtered.filter((m) => m.referralSource.toLowerCase().includes(referral.toLowerCase()));
    if (joinedAfter) {
      const after = new Date(joinedAfter);
      filtered = filtered.filter((m) => { const d = new Date(m.joinedDate); return !isNaN(d.getTime()) && d >= after; });
    }
    if (joinedBefore) {
      const before = new Date(joinedBefore);
      filtered = filtered.filter((m) => { const d = new Date(m.joinedDate); return !isNaN(d.getTime()) && d <= before; });
    }

    await browser.close();
    return NextResponse.json({ members: filtered, total: filtered.length, tab } satisfies ScrapeResult);
  } catch (err) {
    await browser.close();
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
