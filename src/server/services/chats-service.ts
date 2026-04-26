import { chatsRepo, ConversationTab } from "@/server/repositories/chats-repo";
import { chatEventBus } from "@/server/chat/chat-events";

function toRemoteJid(input: string): string {
  if (input.includes("@")) {
    return input;
  }
  return `${input.replace(/[^\d]/g, "")}@s.whatsapp.net`;
}

function toSafePayloadJson(payload: unknown): string | null {
  if (!payload) {
    return null;
  }
  try {
    return JSON.stringify(payload);
  } catch {
    return null;
  }
}

export const chatsService = {
  async startConversationFromContact(input: {
    accountId: string;
    contactId: string;
    contactPhoneNormalized?: string | null;
  }) {
    const phone = input.contactPhoneNormalized?.replace(/[^\d+]/g, "");
    if (!phone) {
      throw new Error("El contacto no tiene telefono normalizado.");
    }

    const chat = await chatsRepo.findOrCreateChat({
      accountId: input.accountId,
      remoteJid: toRemoteJid(phone),
      contactId: input.contactId,
    });

    return chat;
  },

  async saveIncomingMessage(input: {
    accountId: string;
    remoteJid: string;
    content?: string | null;
    payload?: unknown;
  }): Promise<{ chat: { id: string; remoteJid: string }; message: { id: string } } | null> {
    const normalizedJid = toRemoteJid(input.remoteJid);
    const contactId = await chatsRepo.findContactIdForAccountRemoteJid(input.accountId, normalizedJid);

    let chat = null;
    if (normalizedJid.includes("@lid")) {
      // Evita crear chats @lid huerfanos cuando podemos asociar el entrante
      // a un chat telefonico reciente del mismo account.
      chat = await chatsRepo.findBestRecentReplyTargetChat(input.accountId, 30);
      if (!chat) {
        return null;
      }
    }
    if (!chat) {
      chat = await chatsRepo.findOrCreateChat({
        accountId: input.accountId,
        remoteJid: normalizedJid,
        contactId,
      });
    }

    const message = await chatsRepo.createMessage({
      chatId: chat.id,
      direction: "incoming",
      content: input.content ?? null,
      payloadJson: toSafePayloadJson(input.payload),
      status: "received",
      sentAt: new Date(),
    });

    chatEventBus.emit({
      type: "chat.message.created",
      accountId: input.accountId,
      payload: {
        chatId: chat.id,
        remoteJid: chat.remoteJid,
        direction: "incoming",
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
      timestamp: new Date().toISOString(),
    });

    return { chat, message };
  },

  async saveOutgoingMessage(input: { accountId: string; remoteJid: string; content?: string | null; payload?: unknown }) {
    const normalizedJid = toRemoteJid(input.remoteJid);
    const contactId = await chatsRepo.findContactIdForAccountRemoteJid(input.accountId, normalizedJid);
    const chat = await chatsRepo.findOrCreateChat({
      accountId: input.accountId,
      remoteJid: normalizedJid,
      contactId,
    });

    const message = await chatsRepo.createMessage({
      chatId: chat.id,
      direction: "outgoing",
      content: input.content ?? null,
      payloadJson: toSafePayloadJson(input.payload),
      status: "sent",
      sentAt: new Date(),
    });

    chatEventBus.emit({
      type: "chat.message.created",
      accountId: input.accountId,
      payload: {
        chatId: chat.id,
        remoteJid: chat.remoteJid,
        direction: "outgoing",
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
      timestamp: new Date().toISOString(),
    });

    return { chat, message };
  },

  async listConversations(input: { accountId: string; tab: ConversationTab; limit?: number }) {
    const conversations = await chatsRepo.listConversationSummaries(input.accountId, input.tab, input.limit ?? 30);
    return conversations;
  },

  async listMessages(input: { accountId: string; chatId: string; limit?: number }) {
    return chatsRepo.listMessages(input.chatId, input.accountId, input.limit ?? 100);
  },

  async sendMessageToChat(input: {
    accountId: string;
    chatId: string;
    text: string;
    send: (params: { jid: string; text: string; skipPersistence?: boolean }) => Promise<void>;
  }) {
    const chat = await chatsRepo.findChatByIdForAccount(input.chatId, input.accountId);
    if (!chat) {
      throw new Error("Conversacion no encontrada.");
    }

    const text = input.text.trim();
    if (!text) {
      throw new Error("El mensaje no puede estar vacio.");
    }

    await input.send({ jid: chat.remoteJid, text, skipPersistence: true });
    const persisted = await this.saveOutgoingMessage({
      accountId: input.accountId,
      remoteJid: chat.remoteJid,
      content: text,
      payload: { text },
    });
    return persisted.chat;
  },
};
