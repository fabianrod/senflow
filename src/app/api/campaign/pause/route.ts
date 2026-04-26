import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { hydrateCampaignStateForUser } from "@/server/campaign/campaign-context";
import { campaignManager } from "@/server/campaign/campaign-manager";
import { campaignEventBus } from "@/server/campaign/campaign-events";
import { persistCampaignSnapshot } from "@/server/campaign/campaign-snapshot";
import { campaignRuntime } from "@/server/sender/campaign-runtime";

type PauseBody = { accountId?: string };

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as PauseBody;
  const accountId = body.accountId?.trim() || "default";
  await hydrateCampaignStateForUser(user.id, accountId);

  const state = campaignManager.getState();
  if (state.status !== "running") {
    return NextResponse.json(
      { ok: false, error: "Solo puedes pausar una campana en ejecucion." },
      { status: 409 },
    );
  }

  campaignRuntime.pause();
  campaignManager.transition("paused");
  await persistCampaignSnapshot(campaignManager.getState());
  campaignEventBus.emit("campaign.state.changed", campaignManager.getState());

  return NextResponse.json({
    ok: true,
    data: campaignManager.getState(),
  });
}
