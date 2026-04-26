import { EventEmitter } from "node:events";

type CampaignEventName =
  | "campaign.state.changed"
  | "campaign.progress"
  | "campaign.contact.result"
  | "campaign.completed"
  | "campaign.failed";

export interface CampaignEvent {
  type: CampaignEventName;
  payload: unknown;
  timestamp: string;
}

class CampaignEventBus {
  private emitter = new EventEmitter();

  emit(type: CampaignEventName, payload: unknown): void {
    const event: CampaignEvent = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };
    this.emitter.emit("campaign.event", event);
  }

  subscribe(listener: (event: CampaignEvent) => void): () => void {
    this.emitter.on("campaign.event", listener);
    return () => {
      this.emitter.off("campaign.event", listener);
    };
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __campaignEventBus: CampaignEventBus | undefined;
}

export const campaignEventBus = globalThis.__campaignEventBus ?? new CampaignEventBus();

if (!globalThis.__campaignEventBus) {
  globalThis.__campaignEventBus = campaignEventBus;
}
