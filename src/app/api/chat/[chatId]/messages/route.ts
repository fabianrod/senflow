import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { accountsRepo } from "@/server/repositories/accounts-repo";
import { chatsService } from "@/server/services/chats-service";
import { sessionManager } from "@/server/session/session-manager";

type SendMessageBody = {
  accountId?: string;
  text?: string;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const { chatId } = await params;
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId")?.trim();
  if (!accountId) {
    return NextResponse.json({ ok: false, error: "Debes indicar accountId." }, { status: 400 });
  }

  const account = await accountsRepo.findByIdForUser(accountId, user.id);
  if (!account) {
    return NextResponse.json({ ok: false, error: "Cuenta no encontrada." }, { status: 404 });
  }

  const limit = Number(url.searchParams.get("limit") ?? "150");
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 300) : 150;
  const data = await chatsService.listMessages({
    accountId: account.id,
    chatId,
    limit: safeLimit,
  });
  return NextResponse.json({ ok: true, data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const { chatId } = await params;
  const body = (await request.json().catch(() => ({}))) as SendMessageBody;
  const accountId = body.accountId?.trim();
  const text = body.text?.trim() ?? "";
  if (!accountId) {
    return NextResponse.json({ ok: false, error: "Debes indicar accountId." }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ ok: false, error: "Debes escribir un mensaje." }, { status: 400 });
  }

  const account = await accountsRepo.findByIdForUser(accountId, user.id);
  if (!account) {
    return NextResponse.json({ ok: false, error: "Cuenta no encontrada." }, { status: 404 });
  }

  try {
    sessionManager.markExpectedReplyTarget(account.id, chatId);
    await chatsService.sendMessageToChat({
      accountId: account.id,
      chatId,
      text,
      send: ({ jid, text: content }) =>
        sessionManager.sendMessage({
          accountId: account.id,
          jid,
          text: content,
          skipPersistence: true,
        }),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo enviar el mensaje.",
      },
      { status: 400 },
    );
  }
}
