import { Campaign } from "@prisma/client";
import { ContactStatus } from "@/server/common/types";
import { campaignsRepo } from "@/server/repositories/campaigns-repo";

export type CreateCampaignForUserInput = {
  userId: string;
  accountId: string;
  name: string;
  configurations: string;
  summary?: string | null;
};

export const campaignsService = {
  async createCampaignForUser(input: CreateCampaignForUserInput): Promise<Campaign> {
    const name = input.name.trim();
    if (!name) {
      throw new Error("El nombre de la campana es obligatorio.");
    }

    return campaignsRepo.create({
      userId: input.userId,
      accountId: input.accountId,
      name,
      status: "ready",
      configurations: input.configurations,
      summary: input.summary ?? null,
    });
  },

  async listUserCampaigns(userId: string, limit = 50, accountId?: string): Promise<Campaign[]> {
    return campaignsRepo.listByUserId(userId, limit, accountId);
  },

  async getCampaignForUser(campaignId: string, userId: string): Promise<Campaign | null> {
    return campaignsRepo.findByIdForUser(campaignId, userId);
  },

  async deleteCampaignForUser(campaignId: string, userId: string): Promise<boolean> {
    return campaignsRepo.deleteByIdForUser(campaignId, userId);
  },

  async updateCampaignStatus(campaignId: string, status: string): Promise<Campaign> {
    return campaignsRepo.updateStatus(campaignId, status);
  },

  async updateCampaignSummary(campaignId: string, summary: string): Promise<Campaign> {
    return campaignsRepo.updateSummary(campaignId, summary);
  },

  async updateCampaignContactStatus(input: {
    campaignId: string;
    contactId: string;
    status: ContactStatus;
    attempts?: number;
    error?: string | null;
    processedAt?: Date | null;
  }): Promise<void> {
    await campaignsRepo.upsertCampaignContact(input);
  },
};
