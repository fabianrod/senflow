import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { collectionsService } from "@/server/services";

type AssignContactsBody = {
  contactIds?: string[];
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }
  const { collectionId } = await params;
  try {
    const data = await collectionsService.listCollectionContacts(user.id, collectionId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo listar contactos." },
      { status: 404 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }
  const { collectionId } = await params;
  const body = (await request.json()) as AssignContactsBody;
  try {
    const assigned = await collectionsService.assignContacts(user.id, collectionId, body.contactIds ?? []);
    return NextResponse.json({ ok: true, data: { assigned } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo asignar contactos." },
      { status: 404 },
    );
  }
}
