import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { ensureSessionAccountForUser } from "@/server/session/session-account";
import { sessionManager } from "@/server/session/session-manager";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId")?.trim() || "default";
  const account = await ensureSessionAccountForUser(user.id, accountId);

  return NextResponse.json({
    ok: true,
    data: {
      accountId: account.id,
      ...sessionManager.getState(account.id),
    },
  });
}
