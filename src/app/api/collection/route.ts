import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { collectionsService } from "@/server/services";

type CreateCollectionBody = {
  name?: string;
};

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }
  const data = await collectionsService.listCollections(user.id);
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }
  const body = (await request.json()) as CreateCollectionBody;
  try {
    const created = await collectionsService.createCollection(user.id, body.name?.trim() ?? "");
    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo crear la coleccion." },
      { status: 400 },
    );
  }
}
