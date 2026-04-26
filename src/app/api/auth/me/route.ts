import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieConfig, verifySessionToken } from "@/server/auth/session";
import { authService } from "@/server/services";

export async function GET() {
  const cookie = getSessionCookieConfig();
  const cookieStore = await cookies();
  const token = cookieStore.get(cookie.name)?.value;

  const payload = await verifySessionToken(token);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const user = await authService.getPublicUserById(payload.userId);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sesion invalida." }, { status: 401 });
  }

  return NextResponse.json({ ok: true, data: { user } });
}
