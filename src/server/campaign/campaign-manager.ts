import { randomUUID } from "node:crypto";
import {
  CampaignLastResult,
  CampaignState,
  CampaignStatus,
  ContactRecord,
  CsvImportSummary,
  MessageConfig,
  RenderedMessagePreview,
  ThrottleConfig,
} from "@/server/common/types";
import { buildMessagePreview } from "@/server/message/message-renderer";

const initialCampaignState: CampaignState = {
  campaignId: undefined,
  campaignName: undefined,
  status: "idle",
  currentIndex: 0,
  progress: {
    total: 0,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  },
  contacts: [],
  csvSummary: undefined,
};

class CampaignManager {
  private state: CampaignState = initialCampaignState;

  getState(): CampaignState {
    return this.state;
  }

  setState(partial: Partial<CampaignState>): CampaignState {
    this.state = {
      ...this.state,
      ...partial,
      progress: {
        ...this.state.progress,
        ...partial.progress,
      },
    };

    return this.state;
  }

  setContext(input: { userId: string; accountId: string }): CampaignState {
    this.state = {
      ...this.state,
      userId: input.userId,
      accountId: input.accountId,
    };
    return this.state;
  }

  canTransition(to: CampaignStatus): boolean {
    const from = this.state.status;
    const allowed: Record<CampaignStatus, CampaignStatus[]> = {
      idle: ["ready"],
      ready: ["running", "idle"],
      running: ["paused", "cancelled", "completed", "failed"],
      paused: ["running", "cancelled"],
      completed: ["ready", "idle"],
      failed: ["ready", "idle"],
      cancelled: ["ready", "idle"],
    };

    return allowed[from].includes(to);
  }

  transition(to: CampaignStatus): CampaignState {
    if (!this.canTransition(to)) {
      throw new Error(`Transicion invalida: ${this.state.status} -> ${to}`);
    }

    this.state = {
      ...this.state,
      status: to,
      startedAt: to === "running" && !this.state.startedAt ? new Date().toISOString() : this.state.startedAt,
      finishedAt:
        to === "completed" || to === "failed" || to === "cancelled"
          ? new Date().toISOString()
          : undefined,
    };

    return this.state;
  }

  reset(): CampaignState {
    this.state = {
      ...initialCampaignState,
      campaignName: undefined,
      userId: this.state.userId,
      accountId: this.state.accountId,
    };

    return this.state;
  }

  loadContacts(contacts: ContactRecord[], csvSummary: CsvImportSummary): CampaignState {
    const validRows = contacts.filter((contact) => contact.status === "pending").length;

    this.state = {
      ...this.state,
      campaignId: randomUUID(),
      campaignName: undefined,
      status: validRows > 0 ? "ready" : "idle",
      currentIndex: 0,
      contacts,
      csvSummary,
      throttleConfig: undefined,
      messageConfig: undefined,
      lastResult: undefined,
      progress: {
        total: validRows,
        processed: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
      },
      startedAt: undefined,
      finishedAt: undefined,
    };

    return this.state;
  }

  getPreview(limit = 20): ContactRecord[] {
    return this.state.contacts.slice(0, limit);
  }

  setMessageConfig(config: MessageConfig): CampaignState {
    this.state = {
      ...this.state,
      messageConfig: config,
    };

    return this.state;
  }

  setThrottleConfig(config: ThrottleConfig): CampaignState {
    this.state = {
      ...this.state,
      throttleConfig: config,
    };

    return this.state;
  }

  getEligibleContactsCount(): number {
    return this.state.contacts.filter((contact) => contact.status === "pending").length;
  }

  getMessagePreview(limit = 5): RenderedMessagePreview[] {
    if (!this.state.messageConfig) {
      return [];
    }
    return buildMessagePreview(this.state.contacts, this.state.messageConfig, limit);
  }

  markContactResult(
    contactId: string,
    status: "sent" | "failed" | "skipped",
    error?: string,
    attemptsIncrement = 1,
  ): CampaignState {
    this.state = {
      ...this.state,
      contacts: this.state.contacts.map((contact) => {
        if (contact.id !== contactId) {
          return contact;
        }

        return {
          ...contact,
          status,
          error,
          attempts: contact.attempts + attemptsIncrement,
        };
      }),
      lastResult: {
        contactId,
        status,
        error,
      } satisfies CampaignLastResult,
      progress: this.recalculateProgress(
        this.state.contacts.map((contact) => {
          if (contact.id !== contactId) {
            return contact;
          }

          return {
            ...contact,
            status,
            error,
            attempts: contact.attempts + attemptsIncrement,
          };
        }),
      ),
    };

    return this.state;
  }

  setCurrentIndex(index: number): CampaignState {
    this.state = {
      ...this.state,
      currentIndex: index,
    };
    return this.state;
  }

  private recalculateProgress(contacts: ContactRecord[]) {
    const processed = contacts.filter(
      (contact) => contact.status === "sent" || contact.status === "failed" || contact.status === "skipped",
    ).length;
    const sent = contacts.filter((contact) => contact.status === "sent").length;
    const failed = contacts.filter((contact) => contact.status === "failed").length;
    const skipped = contacts.filter((contact) => contact.status === "skipped").length;

    return {
      ...this.state.progress,
      processed,
      sent,
      failed,
      skipped,
    };
  }

  getProgressSnapshot() {
    const total = this.state.progress.total;
    const processed = this.state.progress.processed;
    const remaining = Math.max(total - processed, 0);
    const percentage = total === 0 ? 0 : Number(((processed / total) * 100).toFixed(2));

    return {
      ...this.state.progress,
      remaining,
      percentage,
      lastResult: this.state.lastResult,
      status: this.state.status,
      campaignId: this.state.campaignId,
    };
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __campaignManager: CampaignManager | undefined;
}

export const campaignManager = globalThis.__campaignManager ?? new CampaignManager();

if (!globalThis.__campaignManager) {
  globalThis.__campaignManager = campaignManager;
}
