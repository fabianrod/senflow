import { campaignEventBus } from "@/server/campaign/campaign-events";
import { campaignManager } from "@/server/campaign/campaign-manager";
import {
  clearCampaignSnapshot,
  hasCampaignSnapshot,
  persistCampaignSnapshot,
  readCampaignSnapshot,
} from "@/server/campaign/campaign-snapshot";
import { ThrottleConfig } from "@/server/common/types";
import { renderMessageForContact } from "@/server/message/message-renderer";
import { sessionManager } from "@/server/session/session-manager";

function toJid(phoneNormalized: string): string {
  return `${phoneNormalized.replace("+", "")}@s.whatsapp.net`;
}

function normalizeDigits(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value.replace(/[^\d]/g, "");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getDelayMs(config: ThrottleConfig): number {
  if (config.mode === "fixed") {
    return (config.fixedSeconds ?? 3) * 1000;
  }

  const min = config.minSeconds ?? 3;
  const max = config.maxSeconds ?? min;
  const random = Math.floor(Math.random() * (max - min + 1)) + min;
  return random * 1000;
}

class CampaignRuntime {
  private running = false;
  private paused = false;
  private cancelled = false;

  isRunning(): boolean {
    return this.running;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  cancel(): void {
    this.cancelled = true;
    this.paused = false;
  }

  validateCanStart(): void {
    if (this.running) {
      throw new Error("Ya hay una campana en ejecucion.");
    }

    const state = campaignManager.getState();
    if (!state.campaignId || state.contacts.length === 0) {
      throw new Error("No hay campana cargada.");
    }
    if (!state.messageConfig) {
      throw new Error("Debes configurar el mensaje antes de iniciar.");
    }
    if (!sessionManager.isConnected(state.accountId ?? "default")) {
      throw new Error("Debes conectar WhatsApp antes de iniciar.");
    }
    if (!campaignManager.canTransition("running")) {
      throw new Error(`No se puede iniciar desde estado ${state.status}.`);
    }
    if (campaignManager.getEligibleContactsCount() === 0) {
      throw new Error("No hay contactos pendientes para enviar.");
    }
  }

  async start(throttleConfig: ThrottleConfig): Promise<void> {
    this.validateCanStart();
    this.running = true;
    this.cancelled = false;
    this.paused = false;

    campaignManager.setThrottleConfig(throttleConfig);
    campaignManager.transition("running");
    campaignEventBus.emit("campaign.state.changed", campaignManager.getState());

    await this.runLoop();
  }

  async continueFromPause(): Promise<void> {
    if (this.running) {
      this.resume();
      return;
    }
    this.validateCanResume();
    const state = campaignManager.getState();
    if (!state.throttleConfig) {
      throw new Error("No existe configuracion de ritmo para continuar.");
    }

    this.running = true;
    this.paused = false;
    this.cancelled = false;

    campaignManager.transition("running");
    campaignEventBus.emit("campaign.state.changed", campaignManager.getState());
    await this.runLoop();
  }

  validateCanResume(): void {
    if (this.running) {
      return;
    }
    const state = campaignManager.getState();
    if (state.status !== "paused") {
      throw new Error("La campana no esta en pausa.");
    }
  }

  getFlags() {
    return {
      running: this.running,
      paused: this.paused,
      cancelled: this.cancelled,
    };
  }

  private async runLoop(): Promise<void> {
    let lastSendCompletedAt: number | null = null;
    try {
      while (true) {
        if (this.cancelled) {
          campaignManager.transition("cancelled");
          campaignEventBus.emit("campaign.state.changed", campaignManager.getState());
          await persistCampaignSnapshot(campaignManager.getState());
          return;
        }

        if (this.paused) {
          if (campaignManager.getState().status !== "paused") {
            campaignManager.transition("paused");
          }
          campaignEventBus.emit("campaign.state.changed", campaignManager.getState());
          await persistCampaignSnapshot(campaignManager.getState());
          return;
        }

        const state = campaignManager.getState();
        if (!state.throttleConfig || !state.messageConfig) {
          throw new Error("Configuracion de campana incompleta.");
        }

        if (state.currentIndex >= state.contacts.length) {
          campaignManager.transition("completed");
          campaignEventBus.emit("campaign.state.changed", campaignManager.getState());
          campaignEventBus.emit("campaign.completed", campaignManager.getState());
          if (state.campaignId) {
            await clearCampaignSnapshot(state.campaignId);
          }
          return;
        }

        const contact = state.contacts[state.currentIndex];
        if (!contact) {
          campaignManager.setCurrentIndex(state.currentIndex + 1);
          continue;
        }

        if (contact.status !== "pending" || !contact.phoneNormalized) {
          campaignManager.markContactResult(contact.id, "skipped", "Contacto no elegible.", 0);
          campaignManager.setCurrentIndex(state.currentIndex + 1);
          campaignEventBus.emit("campaign.contact.result", campaignManager.getState().lastResult);
          campaignEventBus.emit("campaign.progress", campaignManager.getProgressSnapshot());
          await persistCampaignSnapshot(campaignManager.getState());
          continue;
        }

        const accountId = state.accountId ?? "default";
        const connectedPhoneDigits = normalizeDigits(sessionManager.getState(accountId).connectedPhone);
        const contactPhoneDigits = normalizeDigits(contact.phoneNormalized);
        if (connectedPhoneDigits && contactPhoneDigits && connectedPhoneDigits === contactPhoneDigits) {
          campaignManager.markContactResult(
            contact.id,
            "skipped",
            "Se omitio porque coincide con el numero conectado.",
            0,
          );
          campaignManager.setCurrentIndex(state.currentIndex + 1);
          campaignEventBus.emit("campaign.contact.result", campaignManager.getState().lastResult);
          campaignEventBus.emit("campaign.progress", campaignManager.getProgressSnapshot());
          await persistCampaignSnapshot(campaignManager.getState());
          continue;
        }

        const renderedMessage = renderMessageForContact(
          contact,
          state.messageConfig,
          state.currentIndex,
        );

        // Garantiza el intervalo configurado entre envios efectivos de WhatsApp.
        if (lastSendCompletedAt !== null) {
          const targetDelayMs = getDelayMs(state.throttleConfig);
          const elapsedMs = Date.now() - lastSendCompletedAt;
          const remainingMs = targetDelayMs - elapsedMs;
          if (remainingMs > 0) {
            await delay(remainingMs);
          }
        }

        let success = false;
        let lastError: string | undefined;
        const maxAttempts = state.throttleConfig.retryCount + 1;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          try {
            await sessionManager.sendMessage({
              accountId,
              jid: toJid(contact.phoneNormalized),
              text: renderedMessage,
              mediaType: state.messageConfig.mediaType,
              mediaUrl: state.messageConfig.mediaUrl,
            });
            success = true;
            break;
          } catch (error) {
            lastError = error instanceof Error ? error.message : "Error desconocido al enviar.";
          }
        }

        if (success) {
          campaignManager.markContactResult(contact.id, "sent");
        } else {
          campaignManager.markContactResult(contact.id, "failed", lastError);
        }

        campaignManager.setCurrentIndex(state.currentIndex + 1);
        campaignEventBus.emit("campaign.contact.result", campaignManager.getState().lastResult);
        campaignEventBus.emit("campaign.progress", campaignManager.getProgressSnapshot());
        await persistCampaignSnapshot(campaignManager.getState());
        lastSendCompletedAt = Date.now();
      }
    } catch (error) {
      campaignManager.transition("failed");
      campaignEventBus.emit("campaign.state.changed", campaignManager.getState());
      campaignEventBus.emit("campaign.failed", {
        message: error instanceof Error ? error.message : "Error fatal en campana.",
      });
      await persistCampaignSnapshot(campaignManager.getState());
    } finally {
      this.running = false;
    }
  }

  async hasRecoverableCampaign(userId: string): Promise<boolean> {
    return hasCampaignSnapshot(userId);
  }

  async recover(userId: string): Promise<boolean> {
    const snapshot = await readCampaignSnapshot(userId);
    if (!snapshot?.campaignId) {
      return false;
    }

    campaignManager.setState(snapshot);
    if (snapshot.status === "running") {
      campaignManager.setState({ status: "paused" });
    }
    campaignEventBus.emit("campaign.state.changed", campaignManager.getState());
    return true;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __campaignRuntime: CampaignRuntime | undefined;
}

export const campaignRuntime = globalThis.__campaignRuntime ?? new CampaignRuntime();

if (!globalThis.__campaignRuntime) {
  globalThis.__campaignRuntime = campaignRuntime;
}
