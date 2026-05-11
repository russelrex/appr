import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected =
    pathname.startsWith("/members") ||
    pathname.startsWith("/api/scrape") ||
    pathname.startsWith("/api/cache");

  if (isProtected) {
    const session = req.cookies.get("skool_session");
    if (!session?.value) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname === "/login") {
    const session = req.cookies.get("skool_session");
    if (session?.value) {
      return NextResponse.redirect(new URL("/members", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/members/:path*", "/api/scrape/:path*", "/api/cache/:path*", "/login"],
};

