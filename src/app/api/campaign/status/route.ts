import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { hydrateCampaignStateForUser } from "@/server/campaign/campaign-context";
import { campaignManager } from "@/server/campaign/campaign-manager";
import { getCampaignStateFromDb } from "@/server/campaign/campaign-snapshot";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId")?.trim() || "default";
  await hydrateCampaignStateForUser(user.id, accountId);
  const memoryState = campaignManager.getState();
  const state = memoryState.campaignId
    ? ((await getCampaignStateFromDb(memoryState.campaignId)) ?? memoryState)
    : memoryState;

  return NextResponse.json({
    ok: true,
    data: state,
  });
}
