import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { contactsService } from "@/server/services";

type UpdateContactBody = {
  name?: string;
  phoneRaw?: string;
  phoneNormalized?: string;
  data?: unknown;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const { contactId } = await params;
  const body = (await request.json()) as UpdateContactBody;

  try {
    const updated = await contactsService.updateUserContact(user.id, contactId, {
      name: body.name?.trim(),
      phoneRaw: body.phoneRaw?.trim(),
      phoneNormalized: body.phoneNormalized?.trim(),
      data: body.data !== undefined ? JSON.stringify(body.data) : undefined,
    });
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo actualizar el contacto." },
      { status: 404 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const { contactId } = await params;

  try {
    await contactsService.deleteUserContact(user.id, contactId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo eliminar el contacto." },
      { status: 404 },
    );
  }
}
