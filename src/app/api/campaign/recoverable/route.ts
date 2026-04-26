import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { campaignRuntime } from "@/server/sender/campaign-runtime";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const recoverable = await campaignRuntime.hasRecoverableCampaign(user.id);
  return NextResponse.json({
    ok: true,
    data: {
      recoverable,
    },
  });
}
