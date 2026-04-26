export type SessionStatus =
  | "disconnected"
  | "qr_pending"
  | "connected"
  | "reconnecting"
  | "error";

export type CampaignStatus =
  | "idle"
  | "ready"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type ContactStatus = "pending" | "sent" | "failed" | "skipped" | "invalid" | "duplicate";

export interface SessionState {
  status: SessionStatus;
  qr?: string;
  lastUpdatedAt: string;
  errorMessage?: string;
  connectedPhone?: string;
}

export interface ContactRecord {
  id: string;
  rowIndex: number;
  name: string;
  phoneRaw: string;
  phoneNormalized?: string;
  status: ContactStatus;
  error?: string;
  attempts: number;
}

export interface CsvImportSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
}

export interface MessageConfig {
  template: string;
  variations: string[];
  mediaType?: "image" | "video";
  mediaUrl?: string;
  fallbackName: string;
}

export interface RenderedMessagePreview {
  contactId: string;
  name: string;
  phoneNormalized?: string;
  message: string;
  mediaType?: "image" | "video";
  mediaUrl?: string;
}

export interface CampaignProgress {
  total: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}

export interface CampaignLastResult {
  contactId: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
}

export interface ThrottleConfig {
  mode: "fixed" | "range";
  fixedSeconds?: number;
  minSeconds?: number;
  maxSeconds?: number;
  retryCount: 0 | 1;
}

export interface CampaignState {
  campaignId?: string;
  campaignName?: string;
  userId?: string;
  accountId?: string;
  status: CampaignStatus;
  currentIndex: number;
  progress: CampaignProgress;
  contacts: ContactRecord[];
  csvSummary?: CsvImportSummary;
  messageConfig?: MessageConfig;
  throttleConfig?: ThrottleConfig;
  lastResult?: CampaignLastResult;
  startedAt?: string;
  finishedAt?: string;
}
