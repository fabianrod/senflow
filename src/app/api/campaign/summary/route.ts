import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { hydrateCampaignStateForUser } from "@/server/campaign/campaign-context";
import { campaignManager } from "@/server/campaign/campaign-manager";
import { getCampaignSummaryFromDb } from "@/server/campaign/campaign-snapshot";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId")?.trim() || "default";
  await hydrateCampaignStateForUser(user.id, accountId);
  const filter = (url.searchParams.get("filter") ?? "all").toLowerCase() as "all" | "sent" | "failed";
  const state = campaignManager.getState();

  const contacts = state.campaignId
    ? await getCampaignSummaryFromDb(state.campaignId, filter)
    : state.contacts.filter((contact) => {
        if (filter === "sent") {
          return contact.status === "sent";
        }
        if (filter === "failed") {
          return contact.status === "failed";
        }
        return true;
      });

  return NextResponse.json({
    ok: true,
    data: {
      campaignId: state.campaignId,
      status: state.status,
      startedAt: state.startedAt,
      finishedAt: state.finishedAt,
      progress: state.progress,
      contacts,
    },
  });
}
