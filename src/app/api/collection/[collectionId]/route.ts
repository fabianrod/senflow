import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { collectionsService } from "@/server/services";

type UpdateCollectionBody = {
  name?: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }
  const { collectionId } = await params;
  const body = (await request.json()) as UpdateCollectionBody;
  try {
    const updated = await collectionsService.renameCollection(user.id, collectionId, body.name ?? "");
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo actualizar la coleccion." },
      { status: 404 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }
  const { collectionId } = await params;
  try {
    await collectionsService.deleteCollection(user.id, collectionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo eliminar la coleccion." },
      { status: 404 },
    );
  }
}
