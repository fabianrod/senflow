import { CampaignState } from "@/server/common/types";
import { campaignManager } from "@/server/campaign/campaign-manager";
import { readCampaignSnapshot } from "@/server/campaign/campaign-snapshot";

export async function hydrateCampaignStateForUser(
  userId: string,
  accountId = "default",
): Promise<CampaignState> {
  campaignManager.setContext({ userId, accountId });
  const snapshot = await readCampaignSnapshot(userId);
  if (snapshot) {
    campaignManager.setState(snapshot);
    return campaignManager.getState();
  }
  return campaignManager.getState();
}
