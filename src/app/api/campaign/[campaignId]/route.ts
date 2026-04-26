import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { campaignsService } from "@/server/services";
import { getCampaignSummaryFromDb } from "@/server/campaign/campaign-snapshot";

type Params = {
  params: Promise<{
    campaignId: string;
  }>;
};

export async function GET(_request: Request, context: Params) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const { campaignId } = await context.params;
  const campaign = await campaignsService.getCampaignForUser(campaignId, user.id);
  if (!campaign) {
    return NextResponse.json({ ok: false, error: "Campaña no encontrada." }, { status: 404 });
  }

  const contacts = await getCampaignSummaryFromDb(campaign.id, "all");
  const totals = contacts.reduce(
    (acc, contact) => {
      acc.total += 1;
      if (contact.status === "sent") {
        acc.sent += 1;
      } else if (contact.status === "failed") {
        acc.failed += 1;
      } else if (contact.status === "skipped") {
        acc.skipped += 1;
      } else {
        acc.pending += 1;
      }
      return acc;
    },
    {
      total: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
    },
  );

  return NextResponse.json({
    ok: true,
    data: {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        createdAt: campaign.createdAt,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
      },
      totals,
      contacts,
    },
  });
}

export async function DELETE(_request: Request, context: Params) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const { campaignId } = await context.params;
  const deleted = await campaignsService.deleteCampaignForUser(campaignId, user.id);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "Campaña no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
