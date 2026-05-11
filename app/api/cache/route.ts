import { NextRequest, NextResponse } from "next/server";
import { scrapeCache } from "@/app/lib/scrapeCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/cache — returns cache status for all tabs */
export async function GET(req: NextRequest) {
  const session = req.cookies.get("skool_session");
  if (!session?.value) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  return NextResponse.json({ status: scrapeCache.status() });
}

/** DELETE /api/cache?tab=active — invalidate one tab or all */
export async function DELETE(req: NextRequest) {
  const session = req.cookies.get("skool_session");
  if (!session?.value) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const tab = new URL(req.url).searchParams.get("tab") ?? undefined;
  scrapeCache.invalidate(tab);
  return NextResponse.json({ ok: true, invalidated: tab ?? "all" });
}
