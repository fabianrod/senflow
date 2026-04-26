import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookieConfig, verifySessionToken } from "@/server/auth/session";

function isPublicPath(pathname: string): boolean {
  return pathname.startsWith("/api/auth/");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const cookie = getSessionCookieConfig();
  const token = request.cookies.get(cookie.name)?.value;
  const session = await verifySessionToken(token);

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if ((pathname === "/login" || pathname === "/register") && session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname === "/login" || pathname === "/register") {
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/register", "/api/:path*"],
};
