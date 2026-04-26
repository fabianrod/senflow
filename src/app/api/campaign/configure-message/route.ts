import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { hydrateCampaignStateForUser } from "@/server/campaign/campaign-context";
import { campaignManager } from "@/server/campaign/campaign-manager";
import { persistCampaignSnapshot } from "@/server/campaign/campaign-snapshot";
import { MessageConfig } from "@/server/common/types";
import { normalizeVariations, validateMessageConfig } from "@/server/message/message-renderer";

interface ConfigureMessageBody {
  accountId?: string;
  template?: string;
  variations?: string[];
  mediaType?: "image" | "video";
  mediaUrl?: string;
  fallbackName?: string;
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json()) as ConfigureMessageBody;
  const accountId = body.accountId?.trim() || "default";
  await hydrateCampaignStateForUser(user.id, accountId);
  const state = campaignManager.getState();

  if (!state.campaignId || state.contacts.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Debes cargar un CSV valido antes de configurar el mensaje.",
      },
      { status: 400 },
    );
  }

  const config: MessageConfig = {
    template: body.template?.trim() ?? "",
    variations: normalizeVariations(body.variations ?? []),
    mediaType: body.mediaType,
    mediaUrl: body.mediaUrl?.trim() || undefined,
    fallbackName: body.fallbackName?.trim() || "cliente",
  };

  const errors = validateMessageConfig(config);
  if (errors.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: errors.join(" "),
      },
      { status: 400 },
    );
  }

  const nextState = campaignManager.setMessageConfig(config);
  await persistCampaignSnapshot(nextState);
  return NextResponse.json({
    ok: true,
    data: {
      campaignId: nextState.campaignId,
      status: nextState.status,
      messageConfig: nextState.messageConfig,
    },
  });
}
