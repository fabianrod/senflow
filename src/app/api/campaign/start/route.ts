import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { hydrateCampaignStateForUser } from "@/server/campaign/campaign-context";
import { campaignManager } from "@/server/campaign/campaign-manager";
import { persistCampaignSnapshot } from "@/server/campaign/campaign-snapshot";
import { ContactRecord, MessageConfig, ThrottleConfig } from "@/server/common/types";
import { normalizeVariations, validateMessageConfig } from "@/server/message/message-renderer";
import { campaignRuntime } from "@/server/sender/campaign-runtime";
import { validateThrottleConfig } from "@/server/sender/throttle";
import { collectionsService } from "@/server/services";

interface StartBody {
  accountId?: string;
  campaignName?: string;
  collectionId?: string;
  messageConfig?: {
    template?: string;
    variations?: string[];
    mediaType?: "image" | "video";
    mediaUrl?: string;
    fallbackName?: string;
  };
  throttleConfig?: ThrottleConfig;
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json()) as StartBody;
  const accountId = body.accountId?.trim() || "default";
  const campaignName = body.campaignName?.trim() ?? "";
  const collectionId = body.collectionId?.trim() ?? "";
  await hydrateCampaignStateForUser(user.id, accountId);
  const throttleConfig = body.throttleConfig;
  const messageConfigBody = body.messageConfig;

  if (!collectionId) {
    return NextResponse.json(
      { ok: false, error: "Debes seleccionar una colección para la campaña." },
      { status: 400 },
    );
  }

  if (!campaignName) {
    return NextResponse.json(
      { ok: false, error: "Debes escribir el nombre de la campaña." },
      { status: 400 },
    );
  }

  if (!throttleConfig || !messageConfigBody) {
    return NextResponse.json(
      { ok: false, error: "Debes enviar la configuración de mensaje y throttleConfig." },
      { status: 400 },
    );
  }

  const errors = validateThrottleConfig(throttleConfig);
  if (errors.length > 0) {
    return NextResponse.json(
      { ok: false, error: errors.join(" ") },
      { status: 400 },
    );
  }

  const messageConfig: MessageConfig = {
    template: messageConfigBody.template?.trim() ?? "",
    variations: normalizeVariations(messageConfigBody.variations ?? []),
    mediaType: messageConfigBody.mediaType,
    mediaUrl: messageConfigBody.mediaUrl?.trim() || undefined,
    fallbackName: messageConfigBody.fallbackName?.trim() || "cliente",
  };

  const messageErrors = validateMessageConfig(messageConfig);
  if (messageErrors.length > 0) {
    return NextResponse.json(
      { ok: false, error: messageErrors.join(" ") },
      { status: 400 },
    );
  }

  try {
    const collectionContacts = await collectionsService.listCollectionContacts(user.id, collectionId);
    const contacts: ContactRecord[] = collectionContacts.map((contact, index) => ({
      id: contact.id,
      rowIndex: contact.rowIndex ?? index + 1,
      name: contact.name ?? "",
      phoneRaw: contact.phoneRaw ?? "",
      phoneNormalized: contact.phoneNormalized ?? undefined,
      status: contact.phoneNormalized ? "pending" : "invalid",
      attempts: 0,
    }));
    const csvSummary = {
      totalRows: contacts.length,
      validRows: contacts.filter((contact) => contact.status === "pending").length,
      invalidRows: contacts.filter((contact) => contact.status === "invalid").length,
      duplicateRows: 0,
    };
    const nextState = campaignManager.loadContacts(contacts, csvSummary);
    campaignManager.setState({
      ...nextState,
      accountId,
      campaignName,
    });
    campaignManager.setMessageConfig(messageConfig);
    await persistCampaignSnapshot(campaignManager.getState());

    campaignRuntime.validateCanStart();
    void campaignRuntime.start(throttleConfig).catch(() => {
      // errores de runtime se publican por SSE y estado de campana
    });
    return NextResponse.json({
      ok: true,
      data: {
        campaignId: campaignManager.getState().campaignId,
        status: "running",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar la campana.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 409 },
    );
  }
}
