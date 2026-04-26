import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { accountsRepo } from "@/server/repositories/accounts-repo";
import { chatsRepo } from "@/server/repositories/chats-repo";

type DeleteChatBody = {
  accountId?: string;
};

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const { chatId } = await params;
  const body = (await request.json().catch(() => ({}))) as DeleteChatBody;
  const accountId = body.accountId?.trim();
  if (!accountId) {
    return NextResponse.json({ ok: false, error: "Debes indicar accountId." }, { status: 400 });
  }

  const account = await accountsRepo.findByIdForUser(accountId, user.id);
  if (!account) {
    return NextResponse.json({ ok: false, error: "Cuenta no encontrada." }, { status: 404 });
  }

  const deleted = await chatsRepo.deleteChatByIdForAccount(chatId, account.id);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "Conversacion no encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
