import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { campaignsService } from "@/server/services";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;
  const accountIdParam = url.searchParams.get("accountId");
  const accountId = accountIdParam?.trim() ? accountIdParam.trim() : undefined;

  const campaigns = await campaignsService.listUserCampaigns(user.id, limit, accountId);
  return NextResponse.json({ ok: true, data: campaigns });
}
