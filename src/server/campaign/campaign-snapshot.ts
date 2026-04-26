import { CampaignState, CampaignStatus, ContactStatus } from "@/server/common/types";
import { prisma } from "@/server/db/client";

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toDbStatus(status: string): CampaignStatus {
  const allowed: CampaignStatus[] = ["idle", "ready", "running", "paused", "completed", "failed", "cancelled"];
  if (allowed.includes(status as CampaignStatus)) {
    return status as CampaignStatus;
  }
  return "idle";
}

export async function persistCampaignSnapshot(state: CampaignState): Promise<void> {
  if (!state.campaignId || !state.userId || !state.accountId) {
    return;
  }
  const campaignId = state.campaignId;

  await prisma.$transaction(async (tx) => {
    for (const contact of state.contacts) {
      await tx.contact.upsert({
        where: { id: contact.id },
        create: {
          id: contact.id,
          userId: state.userId!,
          name: contact.name || null,
          phoneRaw: contact.phoneRaw || null,
          phoneNormalized: contact.phoneNormalized || null,
          data: JSON.stringify(contact),
          rowIndex: contact.rowIndex,
        },
        update: {
          name: contact.name || null,
          phoneRaw: contact.phoneRaw || null,
          phoneNormalized: contact.phoneNormalized || null,
          data: JSON.stringify(contact),
          rowIndex: contact.rowIndex,
        },
      });
    }

    await tx.campaign.upsert({
      where: { id: campaignId },
      create: {
        id: campaignId,
        userId: state.userId!,
        accountId: state.accountId!,
        name: state.campaignName?.trim() || `Campana ${campaignId.slice(0, 8)}`,
        status: toDbStatus(state.status),
        startDate: state.startedAt ? new Date(state.startedAt) : null,
        endDate: state.finishedAt ? new Date(state.finishedAt) : null,
        configurations: JSON.stringify({
          csvSummary: state.csvSummary,
          messageConfig: state.messageConfig,
          throttleConfig: state.throttleConfig,
          currentIndex: state.currentIndex,
        }),
        summary: JSON.stringify({
          progress: state.progress,
          lastResult: state.lastResult,
          startedAt: state.startedAt,
          finishedAt: state.finishedAt,
        }),
      },
      update: {
        name: state.campaignName?.trim() || `Campana ${campaignId.slice(0, 8)}`,
        status: toDbStatus(state.status),
        startDate: state.startedAt ? new Date(state.startedAt) : null,
        endDate: state.finishedAt ? new Date(state.finishedAt) : null,
        configurations: JSON.stringify({
          csvSummary: state.csvSummary,
          messageConfig: state.messageConfig,
          throttleConfig: state.throttleConfig,
          currentIndex: state.currentIndex,
        }),
        summary: JSON.stringify({
          progress: state.progress,
          lastResult: state.lastResult,
          startedAt: state.startedAt,
          finishedAt: state.finishedAt,
        }),
      },
    });

    for (const contact of state.contacts) {
      await tx.campaignContact.upsert({
        where: {
          campaignId_contactId: {
            campaignId,
            contactId: contact.id,
          },
        },
        create: {
          campaignId,
          contactId: contact.id,
          status: contact.status,
          attempts: contact.attempts,
          error: contact.error ?? null,
          processedAt:
            contact.status === "sent" || contact.status === "failed" || contact.status === "skipped"
              ? new Date()
              : null,
        },
        update: {
          status: contact.status,
          attempts: contact.attempts,
          error: contact.error ?? null,
          processedAt:
            contact.status === "sent" || contact.status === "failed" || contact.status === "skipped"
              ? new Date()
              : null,
        },
      });
    }
  });
}

export async function readCampaignSnapshot(userId: string): Promise<CampaignState | null> {
  const campaign = await prisma.campaign.findFirst({
    where: {
      userId,
      status: {
        in: ["ready", "running", "paused", "failed", "cancelled"],
      },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      contacts: {
        include: {
          contact: true,
        },
        orderBy: {
          contact: {
            rowIndex: "asc",
          },
        },
      },
    },
  });

  if (!campaign) {
    return null;
  }

  const configurations = parseJson<{
    csvSummary?: CampaignState["csvSummary"];
    messageConfig?: CampaignState["messageConfig"];
    throttleConfig?: CampaignState["throttleConfig"];
    currentIndex?: number;
  }>(campaign.configurations, {});
  const summary = parseJson<{
    progress?: CampaignState["progress"];
    lastResult?: CampaignState["lastResult"];
    startedAt?: string;
    finishedAt?: string;
  }>(campaign.summary, {});

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    userId: campaign.userId,
    accountId: campaign.accountId,
    status: campaign.status as CampaignStatus,
    currentIndex: configurations.currentIndex ?? 0,
    progress: summary.progress ?? {
      total: campaign.contacts.filter((item) => item.status === "pending").length,
      processed: campaign.contacts.filter(
        (item) => item.status === "sent" || item.status === "failed" || item.status === "skipped",
      ).length,
      sent: campaign.contacts.filter((item) => item.status === "sent").length,
      failed: campaign.contacts.filter((item) => item.status === "failed").length,
      skipped: campaign.contacts.filter((item) => item.status === "skipped").length,
    },
    contacts: campaign.contacts.map((item) => ({
      id: item.contactId,
      rowIndex: item.contact.rowIndex ?? 0,
      name: item.contact.name ?? "",
      phoneRaw: item.contact.phoneRaw ?? "",
      phoneNormalized: item.contact.phoneNormalized ?? undefined,
      status: item.status as ContactStatus,
      error: item.error ?? undefined,
      attempts: item.attempts,
    })),
    csvSummary: configurations.csvSummary,
    messageConfig: configurations.messageConfig,
    throttleConfig: configurations.throttleConfig,
    lastResult: summary.lastResult,
    startedAt: summary.startedAt ?? campaign.startDate?.toISOString(),
    finishedAt: summary.finishedAt ?? campaign.endDate?.toISOString(),
  };
}

export async function clearCampaignSnapshot(campaignId: string): Promise<void> {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "completed" },
  });
}

export async function hasCampaignSnapshot(userId: string): Promise<boolean> {
  const campaign = await prisma.campaign.findFirst({
    where: {
      userId,
      status: {
        in: ["ready", "running", "paused", "failed", "cancelled"],
      },
    },
    select: { id: true },
  });
  return Boolean(campaign);
}

export async function getCampaignSummaryFromDb(campaignId: string, filter: "all" | "sent" | "failed" = "all") {
  const contacts = await prisma.campaignContact.findMany({
    where: {
      campaignId,
      ...(filter === "all" ? {} : { status: filter }),
    },
    include: {
      contact: true,
    },
    orderBy: {
      contact: {
        rowIndex: "asc",
      },
    },
  });

  return contacts.map((item) => ({
    id: item.contactId,
    rowIndex: item.contact.rowIndex ?? 0,
    name: item.contact.name ?? "",
    phoneRaw: item.contact.phoneRaw ?? "",
    phoneNormalized: item.contact.phoneNormalized ?? undefined,
    status: item.status,
    error: item.error ?? undefined,
    attempts: item.attempts,
  }));
}

export async function getCampaignStateFromDb(campaignId: string): Promise<CampaignState | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      contacts: {
        include: { contact: true },
      },
    },
  });
  if (!campaign) {
    return null;
  }

  const configurations = parseJson<{
    csvSummary?: CampaignState["csvSummary"];
    messageConfig?: CampaignState["messageConfig"];
    throttleConfig?: CampaignState["throttleConfig"];
    currentIndex?: number;
  }>(campaign.configurations, {});
  const summary = parseJson<{
    progress?: CampaignState["progress"];
    lastResult?: CampaignState["lastResult"];
    startedAt?: string;
    finishedAt?: string;
  }>(campaign.summary, {});

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    userId: campaign.userId,
    accountId: campaign.accountId,
    status: campaign.status as CampaignStatus,
    currentIndex: configurations.currentIndex ?? 0,
    progress: summary.progress ?? {
      total: 0,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    },
    contacts: campaign.contacts.map((item) => ({
      id: item.contactId,
      rowIndex: item.contact.rowIndex ?? 0,
      name: item.contact.name ?? "",
      phoneRaw: item.contact.phoneRaw ?? "",
      phoneNormalized: item.contact.phoneNormalized ?? undefined,
      status: item.status as ContactStatus,
      error: item.error ?? undefined,
      attempts: item.attempts,
    })),
    csvSummary: configurations.csvSummary,
    messageConfig: configurations.messageConfig,
    throttleConfig: configurations.throttleConfig,
    lastResult: summary.lastResult,
    startedAt: summary.startedAt ?? campaign.startDate?.toISOString(),
    finishedAt: summary.finishedAt ?? campaign.endDate?.toISOString(),
  };
}
