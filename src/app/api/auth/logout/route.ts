import { NextResponse } from "next/server";
import { getSessionCookieConfig } from "@/server/auth/session";

export async function POST() {
  const cookie = getSessionCookieConfig();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, "", {
    ...cookie.options,
    maxAge: 0,
  });
  return response;
}
