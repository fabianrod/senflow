import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { buildMessagePreview, normalizeVariations, validateMessageConfig } from "@/server/message/message-renderer";
import { MessageConfig, ContactRecord } from "@/server/common/types";
import { collectionsService } from "@/server/services";

type PreviewBody = {
  accountId?: string;
  collectionId?: string;
  limit?: number;
  messageConfig?: {
    template?: string;
    variations?: string[];
    mediaType?: "image" | "video";
    mediaUrl?: string;
    fallbackName?: string;
  };
};

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PreviewBody;
  const collectionId = body.collectionId?.trim() ?? "";
  const limitParam = Number(body.limit ?? 5);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 20) : 5;

  if (!collectionId) {
    return NextResponse.json({ ok: false, error: "Debes seleccionar una colección." }, { status: 400 });
  }

  const config: MessageConfig = {
    template: body.messageConfig?.template?.trim() ?? "",
    variations: normalizeVariations(body.messageConfig?.variations ?? []),
    mediaType: body.messageConfig?.mediaType,
    mediaUrl: body.messageConfig?.mediaUrl?.trim() || undefined,
    fallbackName: body.messageConfig?.fallbackName?.trim() || "cliente",
  };
  const errors = validateMessageConfig(config);
  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: errors.join(" ") }, { status: 400 });
  }

  const contacts = await collectionsService.listCollectionContacts(user.id, collectionId);
  const mappedContacts: ContactRecord[] = contacts.map((contact, index) => ({
    id: contact.id,
    rowIndex: contact.rowIndex ?? index + 1,
    name: contact.name ?? "",
    phoneRaw: contact.phoneRaw ?? "",
    phoneNormalized: contact.phoneNormalized ?? undefined,
    status: contact.phoneNormalized ? "pending" : "invalid",
    attempts: 0,
  }));

  return NextResponse.json({
    ok: true,
    data: {
      preview: buildMessagePreview(mappedContacts, config, limit),
    },
  });
}
