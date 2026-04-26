import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { collectionsService } from "@/server/services";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ collectionId: string; contactId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }
  const { collectionId, contactId } = await params;
  try {
    await collectionsService.unassignContact(user.id, collectionId, contactId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo desasignar contacto." },
      { status: 404 },
    );
  }
}
