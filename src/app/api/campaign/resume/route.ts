import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { hydrateCampaignStateForUser } from "@/server/campaign/campaign-context";
import { campaignRuntime } from "@/server/sender/campaign-runtime";

type ResumeBody = { accountId?: string };

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as ResumeBody;
  const accountId = body.accountId?.trim() || "default";
  await hydrateCampaignStateForUser(user.id, accountId);

  try {
    campaignRuntime.validateCanResume();
    void campaignRuntime.continueFromPause().catch(() => {
      // errores de runtime se publican por SSE y estado de campana
    });
    return NextResponse.json({
      ok: true,
      data: {
        status: "running",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo reanudar la campana.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 409 },
    );
  }
}
