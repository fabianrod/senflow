import { cookies } from "next/headers";
import { authService } from "@/server/services";
import { getSessionCookieConfig, verifySessionToken } from "@/server/auth/session";

export async function getAuthenticatedUser() {
  const cookie = getSessionCookieConfig();
  const cookieStore = await cookies();
  const token = cookieStore.get(cookie.name)?.value;
  const payload = await verifySessionToken(token);
  if (!payload) {
    return null;
  }
  return authService.getPublicUserById(payload.userId);
}
