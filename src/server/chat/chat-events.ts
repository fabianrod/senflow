import { EventEmitter } from "node:events";

export type ChatEventPayload = {
  type: "chat.message.created";
  accountId: string;
  payload: {
    chatId: string;
    remoteJid: string;
    direction: "incoming" | "outgoing";
    content?: string | null;
    createdAt: string;
  };
  timestamp: string;
};

class ChatEventBus {
  private emitter = new EventEmitter();

  subscribe(accountId: string, handler: (event: ChatEventPayload) => void): () => void {
    const eventName = `chat:${accountId}`;
    this.emitter.on(eventName, handler);
    return () => this.emitter.off(eventName, handler);
  }

  emit(event: ChatEventPayload): void {
    this.emitter.emit(`chat:${event.accountId}`, event);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __chatEventBus: ChatEventBus | undefined;
}

export const chatEventBus = globalThis.__chatEventBus ?? new ChatEventBus();

if (!globalThis.__chatEventBus) {
  globalThis.__chatEventBus = chatEventBus;
}
