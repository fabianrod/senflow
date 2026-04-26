import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { accountsRepo } from "@/server/repositories/accounts-repo";
import { prisma } from "@/server/db/client";
import { sessionManager } from "@/server/session/session-manager";

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

  const chatsCount = await prisma.chat.count({
    where: { accountId: account.id },
  });
  const messagesCount = await prisma.chatMessage.count({
    where: { chat: { accountId: account.id } },
  });
  const incomingCount = await prisma.chatMessage.count({
    where: { chat: { accountId: account.id }, direction: "incoming" },
  });
  const outgoingCount = await prisma.chatMessage.count({
    where: { chat: { accountId: account.id }, direction: "outgoing" },
  });

  const lastMessages = await prisma.chatMessage.findMany({
    where: { chat: { accountId: account.id } },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      chat: {
        select: {
          id: true,
          remoteJid: true,
        },
      },
    },
  });

  const lastChats = await prisma.chat.findMany({
    where: { accountId: account.id },
    orderBy: { updatedAt: "desc" },
    take: 10,
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          direction: true,
          content: true,
          createdAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      account: {
        id: account.id,
        name: account.name,
        status: account.status,
      },
      session: {
        state: sessionManager.getState(account.id),
        connected: sessionManager.isConnected(account.id),
      },
      counters: {
        chats: chatsCount,
        messages: messagesCount,
        incoming: incomingCount,
        outgoing: outgoingCount,
      },
      lastMessages: lastMessages.map((item) => ({
        id: item.id,
        chatId: item.chatId,
        direction: item.direction,
        content: item.content,
        createdAt: item.createdAt.toISOString(),
        remoteJid: item.chat.remoteJid,
      })),
      lastChats: lastChats.map((chat) => ({
        id: chat.id,
        remoteJid: chat.remoteJid,
        updatedAt: chat.updatedAt.toISOString(),
        lastMessage: chat.messages[0]
          ? {
              id: chat.messages[0].id,
              direction: chat.messages[0].direction,
              content: chat.messages[0].content,
              createdAt: chat.messages[0].createdAt.toISOString(),
            }
          : null,
      })),
    },
  });
}
