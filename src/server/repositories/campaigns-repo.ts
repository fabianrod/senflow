import { Campaign, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { ContactStatus } from "@/server/common/types";

export type CreateCampaignInput = {
  userId: string;
  accountId: string;
  name: string;
  status: string;
  configurations: string;
  summary?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
};

export type UpsertCampaignContactInput = {
  campaignId: string;
  contactId: string;
  status: ContactStatus;
  attempts?: number;
  error?: string | null;
  processedAt?: Date | null;
};

export const campaignsRepo = {
  async create(input: CreateCampaignInput): Promise<Campaign> {
    return prisma.campaign.create({
      data: input,
    });
  },

  async listByUserId(userId: string, limit = 50, accountId?: string): Promise<Campaign[]> {
    return prisma.campaign.findMany({
      where: {
        userId,
        ...(accountId ? { accountId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  async findByIdForUser(campaignId: string, userId: string): Promise<Campaign | null> {
    return prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId,
      },
    });
  },

  async deleteByIdForUser(campaignId: string, userId: string): Promise<boolean> {
    const existing = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId,
      },
      select: { id: true },
    });

    if (!existing) {
      return false;
    }

    await prisma.campaign.delete({
      where: { id: campaignId },
    });
    return true;
  },

  async updateStatus(campaignId: string, status: string): Promise<Campaign> {
    const data: Prisma.CampaignUpdateInput = {
      status,
    };

    if (status === "running") {
      data.startDate = new Date();
      data.endDate = null;
    }
    if (status === "completed" || status === "failed" || status === "cancelled") {
      data.endDate = new Date();
    }

    return prisma.campaign.update({
      where: { id: campaignId },
      data,
    });
  },

  async updateSummary(campaignId: string, summary: string): Promise<Campaign> {
    return prisma.campaign.update({
      where: { id: campaignId },
      data: { summary },
    });
  },

  async upsertCampaignContact(input: UpsertCampaignContactInput): Promise<void> {
    await prisma.campaignContact.upsert({
      where: {
        campaignId_contactId: {
          campaignId: input.campaignId,
          contactId: input.contactId,
        },
      },
      create: {
        campaignId: input.campaignId,
        contactId: input.contactId,
        status: input.status,
        attempts: input.attempts ?? 0,
        error: input.error ?? null,
        processedAt: input.processedAt ?? null,
      },
      update: {
        status: input.status,
        attempts: input.attempts,
        error: input.error ?? null,
        processedAt: input.processedAt ?? null,
      },
    });
  },
};
