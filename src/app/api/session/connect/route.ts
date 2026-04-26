import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { accountsService } from "@/server/services";
import { ensureSessionAccountForUser } from "@/server/session/session-account";
import { sessionManager } from "@/server/session/session-manager";

type ConnectBody = {
  accountId?: string;
  forceNewLogin?: boolean;
};

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const body = ((await request.json().catch(() => ({}))) ?? {}) as ConnectBody;
  const accountId = body.accountId?.trim() || "default";
  const account = await ensureSessionAccountForUser(user.id, accountId);
  const state = await sessionManager.connect(account.id, {
    forceNewLogin: Boolean(body.forceNewLogin),
  });

  await accountsService.updateAccountStatus(account.id, state.status, {
    phoneNumber: state.connectedPhone ?? null,
    lastError: state.errorMessage ?? null,
    lastConnectedAt: state.status === "connected" ? new Date() : null,
  });

  return NextResponse.json({
    ok: true,
    data: {
      accountId: account.id,
      ...state,
    },
  });
}
