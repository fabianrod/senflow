import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { accountsService } from "@/server/services";
import { sessionManager } from "@/server/session/session-manager";

type UpdateAccountBody = {
  name?: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const { accountId } = await params;
  const body = (await request.json().catch(() => ({}))) as UpdateAccountBody;
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Debes enviar un nombre valido." }, { status: 400 });
  }

  try {
    const updated = await accountsService.renameAccountForUser(accountId, user.id, name);
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo renombrar la cuenta." },
      { status: 404 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const { accountId } = await params;
  try {
    await sessionManager.removeAccountSession(accountId);
    await accountsService.deleteAccountForUser(accountId, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo eliminar la cuenta." },
      { status: 404 },
    );
  }
}
