import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { accountsRepo } from "@/server/repositories/accounts-repo";
import { chatsService } from "@/server/services/chats-service";

type ConversationTab = "active" | "quiet" | "all";

function parseTab(input: string | null): ConversationTab {
  if (input === "active" || input === "quiet" || input === "all") {
    return input;
  }
  return "active";
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId")?.trim();
  if (!accountId) {
    return NextResponse.json({ ok: false, error: "Debes indicar accountId." }, { status: 400 });
  }

  const account = await accountsRepo.findByIdForUser(accountId, user.id);
  if (!account) {
    return NextResponse.json({ ok: false, error: "Cuenta no encontrada." }, { status: 404 });
  }

  const tab = parseTab(url.searchParams.get("tab"));
  const limit = Number(url.searchParams.get("limit") ?? "30");
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 30;
  const data = await chatsService.listConversations({
    accountId: account.id,
    tab,
    limit: safeLimit,
  });
  return NextResponse.json({ ok: true, data });
}
