import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import { Boom } from "@hapi/boom";
import { EventEmitter } from "node:events";
import { SessionState, SessionStatus } from "@/server/common/types";
import { accountsRepo } from "@/server/repositories/accounts-repo";
import { waAuthRepo } from "@/server/repositories/wa-auth-repo";
import { chatsService } from "@/server/services/chats-service";
import { chatsRepo } from "@/server/repositories/chats-repo";
import { useSqliteAuthState } from "@/server/session/sqlite-auth-state";

const DEFAULT_ACCOUNT_ID = "default-runtime-account";

type SessionEvent = {
  type: "session.updated";
  accountId: string;
  state: SessionState;
};

type AccountRuntime = {
  state: SessionState;
  socket?: WASocket;
  isConnecting: boolean;
};

type RecentPeer = {
  jid: string;
  at: number;
};

type ExpectedReplyTarget = {
  chatId: string;
  at: number;
};

type IncomingMessageEntry = {
  key?: {
    remoteJid?: string | null;
    participant?: string | null;
    fromMe?: boolean | null;
  };
  message?: Record<string, unknown> | null;
  pushName?: string | null;
};

function jidDigits(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const base = value.split("@")[0] ?? value;
  const withoutDevice = base.split(":")[0] ?? base;
  return withoutDevice.replace(/[^\d]/g, "");
}

class MultiSessionManager {
  private runtimes = new Map<string, AccountRuntime>();
  private eventBus = new EventEmitter();
  private upsertListenerBySocket?: WeakMap<
    WASocket,
    (upsert: { messages?: Array<IncomingMessageEntry & { key?: { fromMe?: boolean | null } }> }) => void
  >;
  private recentOutgoingPeerByAccount?: Map<string, RecentPeer>;
  private expectedReplyTargetByAccount?: Map<string, ExpectedReplyTarget>;
  readonly runtimeVersion = 2;

  private getUpsertListenerMap(): WeakMap<
    WASocket,
    (upsert: { messages?: Array<IncomingMessageEntry & { key?: { fromMe?: boolean | null } }> }) => void
  > {
    if (!this.upsertListenerBySocket) {
      this.upsertListenerBySocket = new WeakMap();
    }
    return this.upsertListenerBySocket;
  }

  private getRecentOutgoingPeerMap(): Map<string, RecentPeer> {
    if (!this.recentOutgoingPeerByAccount) {
      this.recentOutgoingPeerByAccount = new Map<string, RecentPeer>();
    }
    return this.recentOutgoingPeerByAccount;
  }

  private getExpectedReplyTargetMap(): Map<string, ExpectedReplyTarget> {
    if (!this.expectedReplyTargetByAccount) {
      this.expectedReplyTargetByAccount = new Map<string, ExpectedReplyTarget>();
    }
    return this.expectedReplyTargetByAccount;
  }

  private createInitialState(): SessionState {
    return {
      status: "disconnected",
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  private getOrCreateRuntime(accountId: string): AccountRuntime {
    const existing = this.runtimes.get(accountId);
    if (existing) {
      return existing;
    }
    const runtime: AccountRuntime = {
      state: this.createInitialState(),
      socket: undefined,
      isConnecting: false,
    };
    this.runtimes.set(accountId, runtime);
    return runtime;
  }

  private extractMessageText(message: Record<string, unknown> | null | undefined): string | undefined {
    if (!message) {
      return undefined;
    }
    const ephemeral = message.ephemeralMessage as { message?: Record<string, unknown> } | undefined;
    if (ephemeral?.message) {
      return this.extractMessageText(ephemeral.message);
    }
    const viewOnce = message.viewOnceMessage as { message?: Record<string, unknown> } | undefined;
    if (viewOnce?.message) {
      return this.extractMessageText(viewOnce.message);
    }
    const viewOnceV2 = message.viewOnceMessageV2 as { message?: Record<string, unknown> } | undefined;
    if (viewOnceV2?.message) {
      return this.extractMessageText(viewOnceV2.message);
    }
    if (typeof message.conversation === "string") {
      return message.conversation;
    }
    const extendedText = message.extendedTextMessage as { text?: string } | undefined;
    if (typeof extendedText?.text === "string") {
      return extendedText.text;
    }
    const imageMessage = message.imageMessage as { caption?: string } | undefined;
    if (typeof imageMessage?.caption === "string") {
      return imageMessage.caption;
    }
    const videoMessage = message.videoMessage as { caption?: string } | undefined;
    if (typeof videoMessage?.caption === "string") {
      return videoMessage.caption;
    }
    return undefined;
  }

  private normalizeDigits(input: string | null | undefined): string | undefined {
    if (!input) {
      return undefined;
    }
    const digits = input.replace(/[^\d]/g, "");
    return digits || undefined;
  }

  private toPhoneJidFromCandidate(candidate: string | null | undefined): string | undefined {
    if (!candidate) {
      return undefined;
    }
    if (candidate.includes("@s.whatsapp.net")) {
      return candidate;
    }
    const digits = this.normalizeDigits(candidate);
    if (!digits) {
      return undefined;
    }
    return `${digits}@s.whatsapp.net`;
  }

  private extractParticipantPhoneJid(message: Record<string, unknown> | null | undefined): string | undefined {
    if (!message) {
      return undefined;
    }

    const messageContextInfo = message.messageContextInfo as
      | {
          participant?: string;
          participantPn?: string;
          senderPn?: string;
        }
      | undefined;
    const extended = message.extendedTextMessage as
      | {
          contextInfo?: {
            participant?: string;
            participantPn?: string;
            senderPn?: string;
          };
        }
      | undefined;
    const image = message.imageMessage as
      | {
          contextInfo?: {
            participant?: string;
            participantPn?: string;
            senderPn?: string;
          };
        }
      | undefined;
    const video = message.videoMessage as
      | {
          contextInfo?: {
            participant?: string;
            participantPn?: string;
            senderPn?: string;
          };
        }
      | undefined;

    const candidates = [
      messageContextInfo?.participant,
      messageContextInfo?.participantPn,
      messageContextInfo?.senderPn,
      extended?.contextInfo?.participant,
      extended?.contextInfo?.participantPn,
      extended?.contextInfo?.senderPn,
      image?.contextInfo?.participant,
      image?.contextInfo?.participantPn,
      image?.contextInfo?.senderPn,
      video?.contextInfo?.participant,
      video?.contextInfo?.participantPn,
      video?.contextInfo?.senderPn,
    ];

    for (const candidate of candidates) {
      const jid = this.toPhoneJidFromCandidate(candidate);
      if (jid) {
        return jid;
      }
    }

    const ephemeral = message.ephemeralMessage as { message?: Record<string, unknown> } | undefined;
    if (ephemeral?.message) {
      return this.extractParticipantPhoneJid(ephemeral.message);
    }
    const viewOnce = message.viewOnceMessage as { message?: Record<string, unknown> } | undefined;
    if (viewOnce?.message) {
      return this.extractParticipantPhoneJid(viewOnce.message);
    }
    const viewOnceV2 = message.viewOnceMessageV2 as { message?: Record<string, unknown> } | undefined;
    if (viewOnceV2?.message) {
      return this.extractParticipantPhoneJid(viewOnceV2.message);
    }
    return undefined;
  }

  private resolveIncomingRemoteJid(entry: IncomingMessageEntry): string | undefined {
    const remoteJid = entry.key?.remoteJid ?? undefined;
    if (!remoteJid) {
      return undefined;
    }
    if (!remoteJid.includes("@lid")) {
      return remoteJid;
    }

    const byParticipant = this.toPhoneJidFromCandidate(entry.key?.participant ?? undefined);
    if (byParticipant) {
      return byParticipant;
    }

    const byPayload = this.extractParticipantPhoneJid(entry.message ?? undefined);
    if (byPayload) {
      return byPayload;
    }

    return remoteJid;
  }

  private rememberRecentOutgoingPeer(accountId: string, jid: string): void {
    if (!jid || !jid.includes("@s.whatsapp.net")) {
      return;
    }
    this.getRecentOutgoingPeerMap().set(accountId, {
      jid,
      at: Date.now(),
    });
  }

  markExpectedReplyTarget(accountId: string, chatId: string): void {
    if (!accountId || !chatId) {
      return;
    }
    this.getExpectedReplyTargetMap().set(accountId, {
      chatId,
      at: Date.now(),
    });
  }

  private async getExpectedReplyRemoteJid(accountId: string, maxAgeMs = 30 * 60 * 1000): Promise<string | undefined> {
    const target = this.getExpectedReplyTargetMap().get(accountId);
    if (!target) {
      return undefined;
    }
    if (Date.now() - target.at > maxAgeMs) {
      return undefined;
    }
    const chat = await chatsRepo.findChatByIdForAccount(target.chatId, accountId);
    if (!chat || !chat.remoteJid.includes("@s.whatsapp.net")) {
      return undefined;
    }
    return chat.remoteJid;
  }

  private getRecentOutgoingPeerFallback(accountId: string, maxAgeMs = 15 * 60 * 1000): string | undefined {
    const recent = this.getRecentOutgoingPeerMap().get(accountId);
    if (!recent) {
      return undefined;
    }
    if (Date.now() - recent.at > maxAgeMs) {
      return undefined;
    }
    return recent.jid;
  }

  private normalizeName(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  private async resolveLidFallbackByRecentChats(
    accountId: string,
    pushName?: string | null,
  ): Promise<string | undefined> {
    const recent = await chatsRepo.listRecentPhoneChatsForAccount(accountId, 15);
    if (recent.length === 0) {
      return undefined;
    }

    const normalizedPushName = pushName ? this.normalizeName(pushName) : "";
    if (normalizedPushName) {
      const byName = recent.find((chat) => chat.contactName && this.normalizeName(chat.contactName) === normalizedPushName);
      if (byName) {
        return byName.remoteJid;
      }
    }
    return undefined;
  }

  private bindMessagesUpsertListener(accountId: string, socket: WASocket): void {
    const listenerMap = this.getUpsertListenerMap();
    const existingListener = listenerMap.get(socket);
    if (existingListener) {
      socket.ev.off("messages.upsert", existingListener);
    }
    const upsertListener = (upsert: {
      messages?: Array<IncomingMessageEntry & { key?: { fromMe?: boolean | null } }>;
    }) => {
      const entries = upsert.messages ?? [];
      for (const entry of entries) {
        const incomingEntry = entry as IncomingMessageEntry;
        const remoteJid = this.resolveIncomingRemoteJid(incomingEntry);
        const fromMe = Boolean(entry.key?.fromMe);
        if (!remoteJid || fromMe || remoteJid.includes("@g.us")) {
          continue;
        }
        const ownPhoneDigits = jidDigits(socket.user?.id);
        if (ownPhoneDigits && jidDigits(remoteJid) === ownPhoneDigits) {
          continue;
        }
        const content = this.extractMessageText(entry.message as Record<string, unknown> | undefined);
        if (remoteJid.includes("@lid")) {
          void (async () => {
            const expectedReplyFallback = await this.getExpectedReplyRemoteJid(accountId);
            const fallbackJid =
              expectedReplyFallback ??
              (await this.resolveLidFallbackByRecentChats(accountId, incomingEntry.pushName));
            if (!fallbackJid) {
              // Sin correlacion confiable: evita mezclar respuestas de contactos distintos.
              return;
            }
            await chatsService.saveIncomingMessage({
              accountId,
              remoteJid: fallbackJid,
              content,
              payload: entry.message,
            });
          })();
          continue;
        }
        void chatsService.saveIncomingMessage({
          accountId,
          remoteJid,
          content,
          payload: entry.message,
        });
      }
    };
    socket.ev.on("messages.upsert", upsertListener);
    listenerMap.set(socket, upsertListener);
  }

  getState(accountId = DEFAULT_ACCOUNT_ID): SessionState {
    return this.getOrCreateRuntime(accountId).state;
  }

  isConnected(accountId = DEFAULT_ACCOUNT_ID): boolean {
    const runtime = this.getOrCreateRuntime(accountId);
    return runtime.state.status === "connected" && Boolean(runtime.socket);
  }

  ensureRealtimeListeners(accountId = DEFAULT_ACCOUNT_ID): void {
    const runtime = this.getOrCreateRuntime(accountId);
    if (runtime.socket) {
      this.bindMessagesUpsertListener(accountId, runtime.socket);
    }
  }

  onSessionUpdate(accountId: string, handler: (event: SessionEvent) => void): () => void {
    const eventName = `session.updated:${accountId}`;
    this.eventBus.on(eventName, handler);
    return () => {
      this.eventBus.off(eventName, handler);
    };
  }

  private emitUpdate(accountId: string): void {
    const event: SessionEvent = {
      type: "session.updated",
      accountId,
      state: this.getOrCreateRuntime(accountId).state,
    };
    this.eventBus.emit(`session.updated:${accountId}`, event);
  }

  setStatus(accountId: string, status: SessionStatus, partial?: Partial<SessionState>): SessionState {
    const runtime = this.getOrCreateRuntime(accountId);
    runtime.state = {
      ...runtime.state,
      ...partial,
      status,
      lastUpdatedAt: new Date().toISOString(),
    };
    this.emitUpdate(accountId);
    void this.syncAccountState(accountId, runtime.state);
    return runtime.state;
  }

  private async syncAccountState(accountId: string, state: SessionState): Promise<void> {
    try {
      await accountsRepo.updateStatus(accountId, state.status, {
        phoneNumber: state.connectedPhone ?? null,
        lastError: state.errorMessage ?? null,
        lastConnectedAt: state.status === "connected" ? new Date() : null,
      });
    } catch {
      // noop: el account puede no existir en escenarios legacy
    }
  }

  async connect(
    accountId = DEFAULT_ACCOUNT_ID,
    options?: { forceNewLogin?: boolean },
  ): Promise<SessionState> {
    const runtime = this.getOrCreateRuntime(accountId);
    if (runtime.socket) {
      this.bindMessagesUpsertListener(accountId, runtime.socket);
    }
    if (runtime.state.status === "connected") {
      return runtime.state;
    }
    if (runtime.isConnecting) {
      return runtime.state;
    }

    runtime.isConnecting = true;
    this.setStatus(accountId, "reconnecting", {
      errorMessage: undefined,
      qr: undefined,
      connectedPhone: undefined,
    });

    try {
      if (options?.forceNewLogin) {
        if (runtime.socket) {
          runtime.socket.end(new Error("Reinicio de sesion para nuevo QR"));
          runtime.socket = undefined;
        }
        await waAuthRepo.clearAccountAuth(accountId);
      }
      const { state, saveCreds } = await useSqliteAuthState(accountId);
      const { version } = await fetchLatestBaileysVersion();
      const socket = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false,
      });
      runtime.socket = socket;
      socket.ev.on("creds.update", saveCreds);
      this.bindMessagesUpsertListener(accountId, socket);

      socket.ev.on("connection.update", async (update) => {
        // Ignora eventos de sockets viejos para evitar que pisen
        // el estado del intento de conexion actual.
        if (runtime.socket !== socket) {
          return;
        }
        const { connection, qr, lastDisconnect } = update;
        if (qr) {
          const qrDataUrl = await QRCode.toDataURL(qr);
          this.setStatus(accountId, "qr_pending", { qr: qrDataUrl, errorMessage: undefined });
        }

        if (connection === "open") {
          const connectedPhone = socket.user?.id?.split(":")[0];
          this.setStatus(accountId, "connected", {
            qr: undefined,
            errorMessage: undefined,
            connectedPhone,
          });
          return;
        }

        if (connection === "close") {
          const boomError = lastDisconnect?.error as Boom | undefined;
          const statusCode = boomError?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          if (shouldReconnect) {
            this.setStatus(accountId, "reconnecting", {
              qr: undefined,
              errorMessage: "Conexion cerrada. Intentando reconectar.",
            });
            runtime.isConnecting = false;
            await this.connect(accountId);
            return;
          }

          this.setStatus(accountId, "disconnected", {
            qr: undefined,
            connectedPhone: undefined,
            errorMessage: "Sesion cerrada. Debes escanear QR nuevamente.",
          });
        }
      });

      return runtime.state;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo iniciar la sesion";
      return this.setStatus(accountId, "error", {
        errorMessage: message,
        qr: undefined,
      });
    } finally {
      runtime.isConnecting = false;
    }
  }

  async disconnect(accountId = DEFAULT_ACCOUNT_ID): Promise<SessionState> {
    const runtime = this.getOrCreateRuntime(accountId);
    if (runtime.socket) {
      await runtime.socket.logout();
      runtime.socket.end(new Error("Sesion cerrada por usuario"));
      runtime.socket = undefined;
    }
    this.getRecentOutgoingPeerMap().delete(accountId);
    this.getExpectedReplyTargetMap().delete(accountId);
    return this.reset(accountId);
  }

  async removeAccountSession(accountId = DEFAULT_ACCOUNT_ID): Promise<void> {
    const runtime = this.getOrCreateRuntime(accountId);
    if (runtime.socket) {
      runtime.socket.end(new Error("Sesion eliminada por usuario"));
      runtime.socket = undefined;
    }
    runtime.isConnecting = false;
    this.runtimes.delete(accountId);
    this.getRecentOutgoingPeerMap().delete(accountId);
    this.getExpectedReplyTargetMap().delete(accountId);
    await waAuthRepo.clearAccountAuth(accountId);
  }

  async sendMessage(input: {
    accountId?: string;
    jid: string;
    text: string;
    mediaType?: "image" | "video";
    mediaUrl?: string;
    skipPersistence?: boolean;
  }): Promise<void> {
    const accountId = input.accountId ?? DEFAULT_ACCOUNT_ID;
    const runtime = this.getOrCreateRuntime(accountId);
    if (!runtime.socket || runtime.state.status !== "connected") {
      throw new Error("No hay una sesion activa de WhatsApp.");
    }
    if (input.mediaType && input.mediaUrl) {
      if (input.mediaType === "image") {
        await runtime.socket.sendMessage(input.jid, {
          image: { url: input.mediaUrl },
          caption: input.text,
        });
        this.rememberRecentOutgoingPeer(accountId, input.jid);
        if (!input.skipPersistence) {
          await chatsService.saveOutgoingMessage({
            accountId,
            remoteJid: input.jid,
            content: input.text,
            payload: {
              mediaType: input.mediaType,
              mediaUrl: input.mediaUrl,
            },
          });
        }
        return;
      }
      await runtime.socket.sendMessage(input.jid, {
        video: { url: input.mediaUrl },
        caption: input.text,
      });
      this.rememberRecentOutgoingPeer(accountId, input.jid);
      if (!input.skipPersistence) {
        await chatsService.saveOutgoingMessage({
          accountId,
          remoteJid: input.jid,
          content: input.text,
          payload: {
            mediaType: input.mediaType,
            mediaUrl: input.mediaUrl,
          },
        });
      }
      return;
    }
    await runtime.socket.sendMessage(input.jid, { text: input.text });
    this.rememberRecentOutgoingPeer(accountId, input.jid);
    if (!input.skipPersistence) {
      await chatsService.saveOutgoingMessage({
        accountId,
        remoteJid: input.jid,
        content: input.text,
        payload: { text: input.text },
      });
    }
  }

  reset(accountId = DEFAULT_ACCOUNT_ID): SessionState {
    const runtime = this.getOrCreateRuntime(accountId);
    runtime.state = {
      status: "disconnected",
      qr: undefined,
      errorMessage: undefined,
      connectedPhone: undefined,
      lastUpdatedAt: new Date().toISOString(),
    };
    this.emitUpdate(accountId);
    return runtime.state;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __sessionManager: MultiSessionManager | undefined;
}

const existingManager = globalThis.__sessionManager;
const shouldReuseExisting =
  existingManager &&
  typeof (existingManager as MultiSessionManager).removeAccountSession === "function" &&
  typeof (existingManager as MultiSessionManager).sendMessage === "function";

if (shouldReuseExisting) {
  // Mantiene sockets/runtimes activos pero actualiza comportamiento al prototipo actual.
  Object.setPrototypeOf(existingManager, MultiSessionManager.prototype);
}

export const sessionManager = shouldReuseExisting ? existingManager : new MultiSessionManager();
globalThis.__sessionManager = sessionManager;
