import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { hydrateCampaignStateForUser } from "@/server/campaign/campaign-context";
import { campaignManager } from "@/server/campaign/campaign-manager";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId")?.trim() || "default";
  await hydrateCampaignStateForUser(user.id, accountId);
  const limitParam = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 20;

  const state = campaignManager.getState();

  return NextResponse.json({
    ok: true,
    data: {
      campaignId: state.campaignId,
      status: state.status,
      summary: state.csvSummary,
      preview: campaignManager.getPreview(limit),
    },
  });
}
