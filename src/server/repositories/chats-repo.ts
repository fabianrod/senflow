import { Chat, ChatMessage, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";

export type ConversationTab = "active" | "quiet" | "all";

export type ConversationSummary = {
  id: string;
  remoteJid: string;
  updatedAt: string;
  contactName?: string | null;
  contactPhone?: string | null;
  lastMessage?: {
    id: string;
    direction: string;
    content?: string | null;
    createdAt: string;
  };
};

type UpsertChatInput = {
  accountId: string;
  remoteJid: string;
  contactId?: string | null;
};

type CreateMessageInput = {
  chatId: string;
  direction: "incoming" | "outgoing";
  content?: string | null;
  payloadJson?: string | null;
  status?: string | null;
  sentAt?: Date | null;
};

function normalizePhoneForLookup(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

function jidToPhone(remoteJid: string): string {
  return normalizePhoneForLookup(remoteJid.split("@")[0] ?? "");
}

export const chatsRepo = {
  async findOrCreateChat(input: UpsertChatInput): Promise<Chat> {
    const existing = await prisma.chat.findFirst({
      where: {
        accountId: input.accountId,
        remoteJid: input.remoteJid,
      },
    });
    if (existing) {
      if (input.contactId && !existing.contactId) {
        return prisma.chat.update({
          where: { id: existing.id },
          data: { contactId: input.contactId, updatedAt: new Date() },
        });
      }
      return existing;
    }

    return prisma.chat.create({
      data: {
        accountId: input.accountId,
        remoteJid: input.remoteJid,
        contactId: input.contactId ?? null,
      },
    });
  },

  async findContactIdForAccountRemoteJid(accountId: string, remoteJid: string): Promise<string | null> {
    const phoneDigits = jidToPhone(remoteJid);
    if (!phoneDigits) {
      return null;
    }

    const contact = await prisma.contact.findFirst({
      where: {
        user: {
          accounts: {
            some: {
              accountId,
            },
          },
        },
        phoneNormalized: {
          endsWith: phoneDigits,
        },
      },
      select: {
        id: true,
      },
    });

    return contact?.id ?? null;
  },

  async createMessage(input: CreateMessageInput): Promise<ChatMessage> {
    const message = await prisma.chatMessage.create({
      data: {
        chatId: input.chatId,
        direction: input.direction,
        content: input.content ?? null,
        payloadJson: input.payloadJson ?? null,
        status: input.status ?? null,
        sentAt: input.sentAt ?? null,
      },
    });

    await prisma.chat.update({
      where: { id: input.chatId },
      data: { updatedAt: new Date() },
    });

    return message;
  },

  async listConversationSummaries(accountId: string, tab: ConversationTab, limit = 25): Promise<ConversationSummary[]> {
    const chats = await prisma.chat.findMany({
      where: {
        accountId,
        remoteJid: {
          not: {
            contains: "@lid",
          },
        },
      },
      include: {
        contact: {
          select: {
            name: true,
            phoneNormalized: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: Math.max(limit * 3, limit),
    });

    const filtered = chats.filter((chat) => {
      const last = chat.messages[0];
      if (tab === "all") {
        return true;
      }
      if (!last) {
        return false;
      }
      if (tab === "active") {
        return last.direction === "incoming";
      }
      return last.direction === "outgoing";
    });

    return filtered.slice(0, limit).map((chat) => {
      const last = chat.messages[0];
      return {
        id: chat.id,
        remoteJid: chat.remoteJid,
        updatedAt: chat.updatedAt.toISOString(),
        contactName: chat.contact?.name ?? null,
        contactPhone: chat.contact?.phoneNormalized ?? null,
        lastMessage: last
          ? {
              id: last.id,
              direction: last.direction,
              content: last.content,
              createdAt: last.createdAt.toISOString(),
            }
          : undefined,
      };
    });
  },

  async listMessages(chatId: string, accountId: string, limit = 100): Promise<ChatMessage[]> {
    return prisma.chatMessage.findMany({
      where: {
        chatId,
        chat: {
          accountId,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: limit,
    });
  },

  async findChatByIdForAccount(chatId: string, accountId: string): Promise<Chat | null> {
    return prisma.chat.findFirst({
      where: {
        id: chatId,
        accountId,
      },
    });
  },

  async listRecentPhoneChatsForAccount(
    accountId: string,
    limit = 15,
  ): Promise<Array<{ remoteJid: string; updatedAt: Date; contactName?: string | null }>> {
    const rows = await prisma.chat.findMany({
      where: {
        accountId,
        remoteJid: {
          contains: "@s.whatsapp.net",
        },
      },
      include: {
        contact: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
    });

    return rows.map((row) => ({
      remoteJid: row.remoteJid,
      updatedAt: row.updatedAt,
      contactName: row.contact?.name ?? null,
    }));
  },

  async findBestRecentReplyTargetChat(
    accountId: string,
    windowMinutes = 30,
  ): Promise<Chat | null> {
    const candidates = await prisma.chat.findMany({
      where: {
        accountId,
        remoteJid: {
          contains: "@s.whatsapp.net",
        },
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 5,
    });

    const now = Date.now();
    const maxAgeMs = windowMinutes * 60 * 1000;
    const best = candidates.find((chat) => {
      const ageMs = now - chat.updatedAt.getTime();
      const lastMessage = chat.messages[0];
      return ageMs <= maxAgeMs && lastMessage?.direction === "outgoing";
    });

    return best ?? null;
  },

  async deleteChatByIdForAccount(chatId: string, accountId: string): Promise<boolean> {
    const result = await prisma.chat.deleteMany({
      where: {
        id: chatId,
        accountId,
      },
    });
    return result.count > 0;
  },

  async deleteChatsByIdsForAccount(chatIds: string[], accountId: string): Promise<number> {
    if (chatIds.length === 0) {
      return 0;
    }
    const result = await prisma.chat.deleteMany({
      where: {
        id: {
          in: chatIds,
        },
        accountId,
      },
    });
    return result.count;
  },
};
