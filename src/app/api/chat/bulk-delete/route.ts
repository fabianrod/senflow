import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { accountsRepo } from "@/server/repositories/accounts-repo";
import { chatsRepo } from "@/server/repositories/chats-repo";

type BulkDeleteBody = {
  accountId?: string;
  chatIds?: string[];
};

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as BulkDeleteBody;
  const accountId = body.accountId?.trim();
  const chatIds = [...new Set((body.chatIds ?? []).map((item) => item.trim()).filter(Boolean))];
  if (!accountId) {
    return NextResponse.json({ ok: false, error: "Debes indicar accountId." }, { status: 400 });
  }
  if (chatIds.length === 0) {
    return NextResponse.json({ ok: false, error: "Debes indicar al menos un chat." }, { status: 400 });
  }

  const account = await accountsRepo.findByIdForUser(accountId, user.id);
  if (!account) {
    return NextResponse.json({ ok: false, error: "Cuenta no encontrada." }, { status: 404 });
  }

  const deleted = await chatsRepo.deleteChatsByIdsForAccount(chatIds, account.id);
  return NextResponse.json({ ok: true, data: { deleted } });
}
